package com.ss.danceframe.pose

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.media.MediaCodec
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.provider.MediaStore
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteOrder
import java.util.UUID
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToLong

private const val EVENT_PROGRESS = "onVideoExtractionProgress"
private const val PICK_VIDEO_REQUEST = 9832
private const val MAX_DURATION_MS = 90_000L

class VideoProcessorModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var pendingPickPromise: Promise? = null
  private var listenerCount = 0

  private val activityEventListener = object : ActivityEventListener {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != PICK_VIDEO_REQUEST) return
      val promise = pendingPickPromise ?: return
      pendingPickPromise = null

      if (resultCode != Activity.RESULT_OK || data == null) {
        promise.reject("E_PICKER_CANCELLED", "User cancelled video picker")
        return
      }

      val uri = data.data
      if (uri == null) {
        promise.reject("E_NO_URI", "No video URI returned from picker")
        return
      }

      // Copy to app-accessible temp file so the URI stays valid.
      try {
        val tempFile = createTempVideoFile(uri)
        promise.resolve(Uri.fromFile(tempFile).toString())
      } catch (e: Exception) {
        promise.reject("E_COPY_FAILED", e.message ?: "Failed to copy video file")
      }
    }

    override fun onNewIntent(intent: Intent) {}
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = NAME

  @ReactMethod
  fun addListener(eventName: String) { listenerCount++ }

  @ReactMethod
  fun removeListeners(count: Int) { listenerCount = (listenerCount - count).coerceAtLeast(0) }

  @ReactMethod
  fun pickVideo(promise: Promise) {
    if (pendingPickPromise != null) {
      promise.reject("E_PICKER_BUSY", "Another picker is already open")
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No current activity")
      return
    }

    pendingPickPromise = promise
    val intent = Intent(Intent.ACTION_PICK, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
    intent.type = "video/*"
    activity.startActivityForResult(intent, PICK_VIDEO_REQUEST)
  }

  @ReactMethod
  fun persistVideo(videoUriString: String, promise: Promise) {
    Thread {
      try {
        val srcUri = Uri.parse(videoUriString)
        val ext = reactContext.contentResolver.getType(srcUri)?.substringAfterLast('/')
          ?: srcUri.lastPathSegment?.substringAfterLast('.', "mp4")
          ?: "mp4"
        val permanentDir = File(reactContext.filesDir, "imported_videos").apply { mkdirs() }
        val destFile = File(permanentDir, "${UUID.randomUUID()}.$ext")
        val inputStream = reactContext.contentResolver.openInputStream(srcUri)
          ?: throw IllegalStateException("Cannot open input stream for URI")
        FileOutputStream(destFile).use { output -> inputStream.use { it.copyTo(output) } }
        promise.resolve(Uri.fromFile(destFile).toString())
      } catch (e: Exception) {
        promise.reject("E_PERSIST_FAILED", e.message ?: "Failed to persist video file")
      }
    }.start()
  }

  @ReactMethod
  fun extractPosesFromVideo(videoUriString: String, options: ReadableMap?, promise: Promise) {
    Thread {
      try {
        val uri = Uri.parse(videoUriString)
        val retriever = MediaMetadataRetriever()
        retriever.setDataSource(reactContext, uri)

        val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        val durationMs = durationStr?.toLongOrNull() ?: 0L
        if (durationMs <= 0L) {
          promise.reject("E_INVALID_VIDEO", "Could not read video duration")
          retriever.release()
          return@Thread
        }
        if (durationMs > MAX_DURATION_MS) {
          promise.reject("E_DURATION_EXCEEDED", "Video exceeds maximum duration of ${MAX_DURATION_MS / 1000} seconds")
          retriever.release()
          return@Thread
        }

        val intervalMs = options?.takeIf { it.hasKey("frameIntervalMs") }
          ?.getDouble("frameIntervalMs")?.toLong()?.coerceIn(50L, 1000L) ?: 200L

        val maxFrames = options?.takeIf { it.hasKey("maxFrames") }
          ?.getDouble("maxFrames")?.toInt() ?: 500

        val totalFrames = min(maxFrames, ((durationMs.toDouble() / intervalMs) + 0.5).roundToLong().toInt())

        // Single-image mode for offline extraction.
        val detectorOptions = PoseDetectorOptions.Builder()
          .setDetectorMode(PoseDetectorOptions.SINGLE_IMAGE_MODE)
          .build()
        val detector: PoseDetector = PoseDetection.getClient(detectorOptions)

        val poses = Arguments.createArray()
        var processed = 0

        for (i in 0 until totalFrames) {
          val timeUs = i * intervalMs * 1000L
          val bitmap = retriever.getFrameAtTime(timeUs, MediaMetadataRetriever.OPTION_CLOSEST_SYNC)
            ?: continue

          val scaledBitmap = scaleBitmapIfNeeded(bitmap, 480)
          if (scaledBitmap !== bitmap) bitmap.recycle()

          val inputImage = InputImage.fromBitmap(scaledBitmap, 0)

          try {
            val pose = Tasks.await(detector.process(inputImage), 2000L, java.util.concurrent.TimeUnit.MILLISECONDS)
            val frameWidth = scaledBitmap.width
            val frameHeight = scaledBitmap.height
            val timestampMs = (i * intervalMs).toDouble()
            val posePayload = buildPosePayload(pose, frameWidth, frameHeight, timestampMs)
            if (posePayload != null) poses.pushMap(posePayload)
          } catch (_: Exception) { /* skip frames that fail detection */ }

          scaledBitmap.recycle()
          processed++
          if (listenerCount > 0 && (processed % 5 == 0 || processed == totalFrames)) {
            val percent = processed.toDouble() / totalFrames.toDouble() * 100.0
            val progressPayload = Arguments.createMap().apply {
              putInt("current", processed)
              putInt("total", totalFrames)
              putDouble("percent", percent)
            }
            emitEvent(EVENT_PROGRESS, progressPayload)
          }
        }

        retriever.release()
        detector.close()

        val result = Arguments.createMap().apply {
          putArray("poses", poses)
          putDouble("durationMs", durationMs.toDouble())
          putInt("totalFrames", processed)
        }
        promise.resolve(result)
      } catch (e: Throwable) {
        promise.reject("E_EXTRACTION_FAILED", e.message ?: "Video pose extraction failed")
      }
    }.start()
  }

  @ReactMethod
  fun extractAudioEnvelope(videoUriString: String, options: ReadableMap?, promise: Promise) {
    Thread {
      val extractor = MediaExtractor()
      var codec: MediaCodec? = null
      try {
        val uri = Uri.parse(videoUriString)

        val retriever = MediaMetadataRetriever()
        retriever.setDataSource(reactContext, uri)
        val durationStr = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
        val durationMs = durationStr?.toLongOrNull() ?: 0L
        retriever.release()
        if (durationMs <= 0L) {
          promise.reject("E_INVALID_VIDEO", "Could not read video duration")
          return@Thread
        }
        if (durationMs > MAX_DURATION_MS) {
          promise.reject("E_DURATION_EXCEEDED", "Video exceeds maximum duration of ${MAX_DURATION_MS / 1000} seconds")
          return@Thread
        }

        extractor.setDataSource(reactContext, uri, null)

        var audioTrackIndex = -1
        var audioFormat: MediaFormat? = null
        for (i in 0 until extractor.trackCount) {
          val format = extractor.getTrackFormat(i)
          if (format.getString(MediaFormat.KEY_MIME)?.startsWith("audio/") == true) {
            audioTrackIndex = i
            audioFormat = format
            break
          }
        }
        if (audioTrackIndex < 0 || audioFormat == null) {
          promise.reject("E_NO_AUDIO_TRACK", "This video has no audio track")
          return@Thread
        }
        extractor.selectTrack(audioTrackIndex)

        // Window size in ms for RMS energy computation (default 25ms).
        val windowMs = options?.takeIf { it.hasKey("windowMs") }
          ?.getDouble("windowMs")?.coerceIn(10.0, 200.0) ?: 25.0

        val sampleRate = audioFormat.getInteger(MediaFormat.KEY_SAMPLE_RATE)
        val channelCount = audioFormat.getInteger(MediaFormat.KEY_CHANNEL_COUNT)
        val samplesPerWindow = maxOf(1, Math.round(sampleRate * (windowMs / 1000.0)).toInt())

        val mime = audioFormat.getString(MediaFormat.KEY_MIME)!!
        codec = MediaCodec.createDecoderByType(mime)
        codec.configure(audioFormat, null, null, 0)
        codec.start()

        // Accumulate decoded PCM samples into fixed-size windows and compute
        // RMS energy per window — a cheap, FFT-free onset-detection input
        // (broadband energy envelope). No spectral analysis needed for
        // strong-beat detection.
        val envelope = mutableListOf<Double>()
        var windowSumSquares = 0.0
        var windowSampleCount = 0
        var sawInputEOS = false
        var sawOutputEOS = false
        val bufferInfo = MediaCodec.BufferInfo()
        val timeoutUs = 10_000L

        while (!sawOutputEOS) {
          if (!sawInputEOS) {
            val inputIndex = codec.dequeueInputBuffer(timeoutUs)
            if (inputIndex >= 0) {
              val inputBuffer = codec.getInputBuffer(inputIndex)!!
              val sampleSize = extractor.readSampleData(inputBuffer, 0)
              if (sampleSize < 0) {
                codec.queueInputBuffer(inputIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                sawInputEOS = true
              } else {
                codec.queueInputBuffer(inputIndex, 0, sampleSize, extractor.sampleTime, 0)
                extractor.advance()
              }
            }
          }

          val outputIndex = codec.dequeueOutputBuffer(bufferInfo, timeoutUs)
          if (outputIndex >= 0) {
            if (bufferInfo.size > 0) {
              val outputBuffer = codec.getOutputBuffer(outputIndex)!!
              outputBuffer.position(bufferInfo.offset)
              outputBuffer.limit(bufferInfo.offset + bufferInfo.size)
              // Decoded PCM is 16-bit signed, interleaved by channelCount.
              val shortBuffer = outputBuffer.order(ByteOrder.nativeOrder()).asShortBuffer()
              var i = 0
              while (i < shortBuffer.limit()) {
                // Downmix to mono by averaging channels for this frame.
                var sum = 0.0
                for (c in 0 until channelCount) {
                  if (i + c < shortBuffer.limit()) sum += shortBuffer.get(i + c).toDouble()
                }
                val monoSample = (sum / channelCount) / 32768.0
                windowSumSquares += monoSample * monoSample
                windowSampleCount++
                if (windowSampleCount >= samplesPerWindow) {
                  envelope.add(Math.sqrt(windowSumSquares / windowSampleCount))
                  windowSumSquares = 0.0
                  windowSampleCount = 0
                }
                i += channelCount
              }
            }
            codec.releaseOutputBuffer(outputIndex, false)
            if (bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) {
              sawOutputEOS = true
            }
          }
        }

        if (windowSampleCount > 0) {
          envelope.add(Math.sqrt(windowSumSquares / windowSampleCount))
        }

        val envelopeArray = Arguments.createArray()
        envelope.forEach { envelopeArray.pushDouble(it) }

        val result = Arguments.createMap().apply {
          putArray("envelope", envelopeArray)
          putDouble("windowMs", windowMs)
          putDouble("durationMs", durationMs.toDouble())
        }
        promise.resolve(result)
      } catch (e: Throwable) {
        promise.reject("E_AUDIO_EXTRACTION_FAILED", e.message ?: "Audio envelope extraction failed")
      } finally {
        try { codec?.stop() } catch (_: Exception) {}
        try { codec?.release() } catch (_: Exception) {}
        extractor.release()
      }
    }.start()
  }

  private fun buildPosePayload(
    pose: com.google.mlkit.vision.pose.Pose,
    frameWidth: Int,
    frameHeight: Int,
    timestampMs: Double
  ): com.facebook.react.bridge.WritableMap? {
    val landmarks = pose.allPoseLandmarks
    if (landmarks.isEmpty()) return null

    val keypoints = Arguments.createArray()
    var confidenceSum = 0.0
    var confidentCount = 0

    KEYPOINT_MAPPING.forEach { (name, landmarkType) ->
      val landmark = pose.getPoseLandmark(landmarkType)
      val x = if (landmark != null && frameWidth > 0) clamp01(landmark.position.x.toDouble() / frameWidth) else 0.0
      val y = if (landmark != null && frameHeight > 0) clamp01(landmark.position.y.toDouble() / frameHeight) else 0.0
      val confidence = clamp01(landmark?.inFrameLikelihood?.toDouble() ?: 0.0)

      if (confidence >= 0.3) { confidenceSum += confidence; confidentCount++ }

      keypoints.pushMap(Arguments.createMap().apply {
        putString("name", name)
        putDouble("x", x)
        putDouble("y", y)
        putDouble("confidence", confidence)
      })
    }

    if (confidentCount == 0) return null

    return Arguments.createMap().apply {
      putArray("keypoints", keypoints)
      putDouble("timestamp", timestampMs)
      putDouble("confidence", confidenceSum / confidentCount)
      putInt("frameWidth", frameWidth)
      putInt("frameHeight", frameHeight)
    }
  }

  private fun createTempVideoFile(uri: Uri): File {
    val inputStream = reactContext.contentResolver.openInputStream(uri)
      ?: throw IllegalStateException("Cannot open input stream for URI")
    val ext = reactContext.contentResolver.getType(uri)?.substringAfterLast('/') ?: "mp4"
    val temp = File(reactContext.cacheDir, "imported_video_${System.currentTimeMillis()}.$ext")
    FileOutputStream(temp).use { out -> inputStream.copyTo(out) }
    inputStream.close()
    return temp
  }

  private fun scaleBitmapIfNeeded(bitmap: Bitmap, maxSide: Int): Bitmap {
    val w = bitmap.width
    val h = bitmap.height
    if (w <= maxSide && h <= maxSide) return bitmap
    val scale = maxSide.toFloat() / max(w, h).toFloat()
    return Bitmap.createScaledBitmap(bitmap, (w * scale).toInt(), (h * scale).toInt(), true)
  }

  private fun emitEvent(eventName: String, payload: com.facebook.react.bridge.WritableMap) {
    if (!reactContext.hasActiveCatalystInstance()) return
    reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(eventName, payload)
  }

  companion object {
    const val NAME = "VideoProcessorModule"

    private fun clamp01(v: Double) = max(0.0, min(1.0, v))

    private data class KpMap(val name: String, val landmarkType: Int)

    private val KEYPOINT_MAPPING = listOf(
      KpMap("nose",          PoseLandmark.NOSE),
      KpMap("leftEye",       PoseLandmark.LEFT_EYE),
      KpMap("rightEye",      PoseLandmark.RIGHT_EYE),
      KpMap("leftEar",       PoseLandmark.LEFT_EAR),
      KpMap("rightEar",      PoseLandmark.RIGHT_EAR),
      KpMap("leftShoulder",  PoseLandmark.LEFT_SHOULDER),
      KpMap("rightShoulder", PoseLandmark.RIGHT_SHOULDER),
      KpMap("leftElbow",     PoseLandmark.LEFT_ELBOW),
      KpMap("rightElbow",    PoseLandmark.RIGHT_ELBOW),
      KpMap("leftWrist",     PoseLandmark.LEFT_WRIST),
      KpMap("rightWrist",    PoseLandmark.RIGHT_WRIST),
      KpMap("leftHip",       PoseLandmark.LEFT_HIP),
      KpMap("rightHip",      PoseLandmark.RIGHT_HIP),
      KpMap("leftKnee",      PoseLandmark.LEFT_KNEE),
      KpMap("rightKnee",     PoseLandmark.RIGHT_KNEE),
      KpMap("leftAnkle",     PoseLandmark.LEFT_ANKLE),
      KpMap("rightAnkle",    PoseLandmark.RIGHT_ANKLE),
    )
  }
}
