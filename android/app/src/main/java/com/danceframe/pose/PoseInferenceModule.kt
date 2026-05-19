package com.danceframe.pose

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.pose.Pose
import com.google.mlkit.vision.pose.PoseDetection
import com.google.mlkit.vision.pose.PoseDetector
import com.google.mlkit.vision.pose.PoseLandmark
import com.google.mlkit.vision.pose.accurate.AccuratePoseDetectorOptions
import com.google.mlkit.vision.pose.defaults.PoseDetectorOptions
import com.mrousavy.camera.core.types.Orientation
import com.mrousavy.camera.frameprocessors.Frame
import java.util.concurrent.TimeUnit
import java.util.concurrent.TimeoutException
import kotlin.math.max
import kotlin.math.min

class PoseInferenceModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  private var isInitialized = false
  private var isRunning = false
  private var listenerCount = 0
  private var selectedModelType: String = "lightning"
  private var targetFps = 30
  private var minKeypointConfidence = 0.3
  private var minFrameIntervalMs: Long = 33L
  private var lastAttemptTimestampMs: Long = 0L
  private var lastErrorEmitTimestampMs: Long = 0L
  private var poseDetector: PoseDetector? = null

  init {
    activeInstance = this
  }

  override fun getName(): String = NAME

  override fun getConstants(): MutableMap<String, Any> =
      hashMapOf(
          "EVENT_POSE" to EVENT_POSE,
          "EVENT_ERROR" to EVENT_ERROR,
          "EVENT_STATE" to EVENT_STATE,
      )

  @ReactMethod
  @Synchronized
  fun initialize(options: ReadableMap?, promise: Promise) {
    try {
      targetFps = options?.takeIf { it.hasKey("targetFps") }?.getDouble("targetFps")?.toInt() ?: 30
      targetFps = targetFps.coerceIn(5, 60)
      minFrameIntervalMs = max(1, 1000 / targetFps).toLong()

      minKeypointConfidence =
          options?.takeIf { it.hasKey("minKeypointConfidence") }?.getDouble("minKeypointConfidence")
              ?: 0.3
      minKeypointConfidence = min(1.0, max(0.05, minKeypointConfidence))

      val requestedModelType =
          options?.takeIf { it.hasKey("modelType") }?.getString("modelType")?.lowercase()
      selectedModelType = if (requestedModelType == "thunder") "thunder" else "lightning"

      poseDetector?.close()
      poseDetector = createPoseDetector(selectedModelType)

      isInitialized = true
      isRunning = false
      lastAttemptTimestampMs = 0L
      emitState()
      promise.resolve(true)
    } catch (error: Throwable) {
      emitError("E_INITIALIZE", error.message ?: "Failed to initialize pose inference")
      promise.reject("E_INITIALIZE", error)
    }
  }

  @ReactMethod
  @Synchronized
  fun start(promise: Promise) {
    if (!isInitialized) {
      promise.reject("E_NOT_INITIALIZED", "PoseInferenceModule not initialized. Call initialize() first.")
      return
    }

    isRunning = true
    emitState()
    promise.resolve(null)
  }

  @ReactMethod
  @Synchronized
  fun stop(promise: Promise) {
    isRunning = false
    emitState()
    promise.resolve(null)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    listenerCount += 1
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    listenerCount = (listenerCount - count).coerceAtLeast(0)
  }

  @Synchronized
  override fun invalidate() {
    isRunning = false
    isInitialized = false
    lastAttemptTimestampMs = 0L
    poseDetector?.close()
    poseDetector = null
    if (activeInstance === this) {
      activeInstance = null
    }
    super.invalidate()
  }

  @Synchronized
  fun processFrame(frame: Frame, params: Map<String, Any>?) {
    try {
      if (!isInitialized || !isRunning) {
        return
      }

      val timestampMs = frame.timestamp / 1_000_000L
      if (timestampMs - lastAttemptTimestampMs < minFrameIntervalMs) {
        return
      }
      lastAttemptTimestampMs = timestampMs

      val detector = poseDetector ?: return
      val mediaImage = frame.image
      val rotationDegrees = orientationToRotationDegrees(frame.orientation)
      val inputImage = InputImage.fromMediaImage(mediaImage, rotationDegrees)
      val poseTask = detector.process(inputImage)
      val pose = Tasks.await(poseTask, MLKIT_TIMEOUT_MS, TimeUnit.MILLISECONDS)

      val frameWidth = frame.width
      val frameHeight = frame.height
      val payload = buildPosePayloadFromPose(pose, frameWidth, frameHeight, timestampMs, params)
      if (payload != null) {
        emitPose(payload)
      }
    } catch (_: TimeoutException) {
      // Drop overloaded frames silently to keep realtime loop stable.
    } catch (error: Throwable) {
      emitErrorThrottled("E_FRAME_PROCESS", error.message ?: "Failed to process camera frame")
    }
  }

  private fun createPoseDetector(modelType: String): PoseDetector {
    return if (modelType == "thunder") {
      val options =
          AccuratePoseDetectorOptions.Builder()
              .setDetectorMode(AccuratePoseDetectorOptions.STREAM_MODE)
              .build()
      PoseDetection.getClient(options)
    } else {
      val options =
          PoseDetectorOptions.Builder()
              .setDetectorMode(PoseDetectorOptions.STREAM_MODE)
              .build()
      PoseDetection.getClient(options)
    }
  }

  private fun buildPosePayloadFromPose(
      pose: Pose,
      frameWidth: Int,
      frameHeight: Int,
      timestampMs: Long,
      params: Map<String, Any>?
  ): WritableMap? {
    val landmarks = pose.allPoseLandmarks
    if (landmarks.isEmpty()) {
      return null
    }

    val confidenceBias = (params?.get("confidenceBias") as? Number)?.toDouble() ?: 0.0
    val keypoints = Arguments.createArray()
    var confidenceSum = 0.0
    var confidentCount = 0

    KEYPOINT_MAPPING.forEach { mapping ->
      val landmark = pose.getPoseLandmark(mapping.landmarkType)
      val x =
          if (landmark != null && frameWidth > 0) {
            clamp01(landmark.position.x.toDouble() / frameWidth.toDouble())
          } else {
            0.0
          }
      val y =
          if (landmark != null && frameHeight > 0) {
            clamp01(landmark.position.y.toDouble() / frameHeight.toDouble())
          } else {
            0.0
          }
      val confidence =
          ((landmark?.inFrameLikelihood?.toDouble() ?: 0.0) + confidenceBias).coerceIn(0.0, 1.0)

      if (confidence >= minKeypointConfidence) {
        confidenceSum += confidence
        confidentCount += 1
      }

      keypoints.pushMap(
          Arguments.createMap().apply {
            putString("name", mapping.name)
            putDouble("x", x)
            putDouble("y", y)
            putDouble("confidence", confidence)
          }
      )
    }

    val overallConfidence = if (confidentCount > 0) confidenceSum / confidentCount.toDouble() else 0.0
    if (overallConfidence <= 0.0) {
      return null
    }

    return Arguments.createMap().apply {
      putArray("keypoints", keypoints)
      putDouble("timestamp", timestampMs.toDouble())
      putDouble("confidence", overallConfidence)
      putInt("frameWidth", frameWidth)
      putInt("frameHeight", frameHeight)
    }
  }

  private fun emitState() {
    if (listenerCount <= 0) {
      return
    }

    val payload =
        Arguments.createMap().apply {
          putBoolean("isInitialized", isInitialized)
          putBoolean("isRunning", isRunning)
        }

    emitEvent(EVENT_STATE, payload)
  }

  private fun emitError(code: String, message: String) {
    if (listenerCount <= 0) {
      return
    }

    val payload =
        Arguments.createMap().apply {
          putString("code", code)
          putString("message", message)
        }

    emitEvent(EVENT_ERROR, payload)
  }

  private fun emitErrorThrottled(code: String, message: String) {
    val nowMs = System.currentTimeMillis()
    if (nowMs - lastErrorEmitTimestampMs < ERROR_THROTTLE_MS) {
      return
    }
    lastErrorEmitTimestampMs = nowMs
    emitError(code, message)
  }

  fun emitPose(payload: WritableMap) {
    if (!isInitialized || !isRunning || listenerCount <= 0) {
      return
    }

    emitEvent(EVENT_POSE, payload)
  }

  private fun emitEvent(eventName: String, payload: WritableMap) {
    if (!reactContext.hasActiveCatalystInstance()) {
      return
    }

    reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(eventName, payload)
  }

  companion object {
    private data class KeypointMapping(val name: String, val landmarkType: Int)

    @Volatile private var activeInstance: PoseInferenceModule? = null

    private val KEYPOINT_MAPPING =
        listOf(
            KeypointMapping("nose", PoseLandmark.NOSE),
            KeypointMapping("leftEye", PoseLandmark.LEFT_EYE),
            KeypointMapping("rightEye", PoseLandmark.RIGHT_EYE),
            KeypointMapping("leftEar", PoseLandmark.LEFT_EAR),
            KeypointMapping("rightEar", PoseLandmark.RIGHT_EAR),
            KeypointMapping("leftShoulder", PoseLandmark.LEFT_SHOULDER),
            KeypointMapping("rightShoulder", PoseLandmark.RIGHT_SHOULDER),
            KeypointMapping("leftElbow", PoseLandmark.LEFT_ELBOW),
            KeypointMapping("rightElbow", PoseLandmark.RIGHT_ELBOW),
            KeypointMapping("leftWrist", PoseLandmark.LEFT_WRIST),
            KeypointMapping("rightWrist", PoseLandmark.RIGHT_WRIST),
            KeypointMapping("leftHip", PoseLandmark.LEFT_HIP),
            KeypointMapping("rightHip", PoseLandmark.RIGHT_HIP),
            KeypointMapping("leftKnee", PoseLandmark.LEFT_KNEE),
            KeypointMapping("rightKnee", PoseLandmark.RIGHT_KNEE),
            KeypointMapping("leftAnkle", PoseLandmark.LEFT_ANKLE),
            KeypointMapping("rightAnkle", PoseLandmark.RIGHT_ANKLE),
        )

    @JvmStatic
    fun getActiveInstance(): PoseInferenceModule? = activeInstance

    private const val MLKIT_TIMEOUT_MS = 300L
    private const val ERROR_THROTTLE_MS = 1000L

    private fun clamp01(value: Double): Double = max(0.0, min(1.0, value))
    private fun orientationToRotationDegrees(orientation: Orientation): Int =
        when (orientation) {
          Orientation.PORTRAIT -> 0
          Orientation.LANDSCAPE_RIGHT -> 90
          Orientation.PORTRAIT_UPSIDE_DOWN -> 180
          Orientation.LANDSCAPE_LEFT -> 270
        }

    const val NAME = "PoseInferenceModule"
    const val EVENT_POSE = "onPose"
    const val EVENT_ERROR = "onPoseError"
    const val EVENT_STATE = "onPoseState"
  }
}
