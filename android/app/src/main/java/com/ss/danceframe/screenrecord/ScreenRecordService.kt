package com.ss.danceframe.screenrecord

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.ContentValues
import android.content.Intent
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.MediaRecorder
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import java.io.File

class ScreenRecordService : Service() {

  private var mediaProjection: MediaProjection? = null
  private var virtualDisplay: VirtualDisplay? = null
  private var mediaRecorder: MediaRecorder? = null
  private var outputFile: File? = null
  private var isCapturing = false

  private val projectionCallback =
      object : MediaProjection.Callback() {
        override fun onStop() {
          // System revoked capture (e.g. user stopped it from the system's
          // own screen-record quick-settings tile) — tear down the same way
          // a JS-initiated stop would.
          stopCapture()
        }
      }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_START -> {
        val resultCode = intent.getIntExtra(EXTRA_RESULT_CODE, android.app.Activity.RESULT_CANCELED)
        val data = intent.getParcelableExtra<Intent>(EXTRA_DATA)
        if (data == null) {
          resultCallback?.invoke(false, "Missing screen capture consent data")
          resultCallback = null
          stopSelf()
          return START_NOT_STICKY
        }
        startForeground(NOTIFICATION_ID, buildNotification())
        startCapture(resultCode, data)
      }
      ACTION_STOP -> stopCapture()
    }
    return START_NOT_STICKY
  }

  private fun startCapture(resultCode: Int, data: Intent) {
    val metrics = resources.displayMetrics
    val dir = cacheDir
    outputFile = File(dir, "dfrecording-${System.currentTimeMillis()}.mp4")

    val recorder =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          MediaRecorder(applicationContext)
        } else {
          @Suppress("DEPRECATION") MediaRecorder()
        }

    try {
      recorder.apply {
        setVideoSource(MediaRecorder.VideoSource.SURFACE)
        setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
        setVideoEncoder(MediaRecorder.VideoEncoder.H264)
        setVideoSize(metrics.widthPixels, metrics.heightPixels)
        setVideoFrameRate(30)
        setVideoEncodingBitRate(8_000_000)
        setOutputFile(outputFile!!.absolutePath)
        prepare()
      }
    } catch (error: Exception) {
      resultCallback?.invoke(false, error.message ?: "Failed to configure recorder")
      resultCallback = null
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }
    mediaRecorder = recorder

    val projectionManager =
        getSystemService(MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    val projection = projectionManager.getMediaProjection(resultCode, data)
    if (projection == null) {
      resultCallback?.invoke(false, "Failed to obtain MediaProjection")
      resultCallback = null
      releaseResources()
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }
    mediaProjection = projection
    projection.registerCallback(projectionCallback, Handler(Looper.getMainLooper()))

    virtualDisplay =
        projection.createVirtualDisplay(
            "DFScreenRecord",
            metrics.widthPixels,
            metrics.heightPixels,
            metrics.densityDpi,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            recorder.surface,
            null,
            null,
        )

    try {
      recorder.start()
      isCapturing = true
    } catch (error: Exception) {
      resultCallback?.invoke(false, error.message ?: "Failed to start recording")
      resultCallback = null
      releaseResources()
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
    }
  }

  private fun stopCapture() {
    if (!isCapturing) {
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }
    isCapturing = false

    try {
      mediaRecorder?.stop()
    } catch (_: Exception) {
      // stop() can throw if called too soon after start() with no frames captured yet.
    }
    releaseResources()

    val file = outputFile
    outputFile = null
    if (file == null || !file.exists()) {
      resultCallback?.invoke(false, "Recording file was not created")
      resultCallback = null
      stopForeground(STOP_FOREGROUND_REMOVE)
      stopSelf()
      return
    }

    saveToMediaStore(file)
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
  }

  private fun releaseResources() {
    mediaRecorder?.reset()
    mediaRecorder?.release()
    mediaRecorder = null
    virtualDisplay?.release()
    virtualDisplay = null
    mediaProjection?.unregisterCallback(projectionCallback)
    mediaProjection?.stop()
    mediaProjection = null
  }

  private fun saveToMediaStore(file: File) {
    try {
      val values =
          ContentValues().apply {
            put(MediaStore.Video.Media.DISPLAY_NAME, file.name)
            put(MediaStore.Video.Media.MIME_TYPE, "video/mp4")
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
              put(
                  MediaStore.Video.Media.RELATIVE_PATH,
                  Environment.DIRECTORY_MOVIES + "/DanceFrame",
              )
              put(MediaStore.Video.Media.IS_PENDING, 1)
            }
          }

      val resolver = applicationContext.contentResolver
      val uri = resolver.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, values)
      if (uri == null) {
        resultCallback?.invoke(false, "Could not create MediaStore entry")
        resultCallback = null
        return
      }

      resolver.openOutputStream(uri)?.use { out -> file.inputStream().use { it.copyTo(out) } }

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
        values.clear()
        values.put(MediaStore.Video.Media.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
      }

      file.delete()
      resultCallback?.invoke(true, null)
    } catch (error: Exception) {
      resultCallback?.invoke(false, error.message ?: "Failed to save recording")
    } finally {
      resultCallback = null
    }
  }

  private fun buildNotification(): Notification {
    val manager = getSystemService(NotificationManager::class.java)
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      manager.createNotificationChannel(
          NotificationChannel(CHANNEL_ID, "Screen Recording", NotificationManager.IMPORTANCE_LOW),
      )
    }

    return NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("DanceFrame is recording your screen")
        .setSmallIcon(applicationInfo.icon)
        .setOngoing(true)
        .build()
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onDestroy() {
    if (isCapturing) {
      releaseResources()
    }
    super.onDestroy()
  }

  companion object {
    const val ACTION_START = "com.ss.danceframe.screenrecord.action.START"
    const val ACTION_STOP = "com.ss.danceframe.screenrecord.action.STOP"
    const val EXTRA_RESULT_CODE = "resultCode"
    const val EXTRA_DATA = "data"

    private const val NOTIFICATION_ID = 4201
    private const val CHANNEL_ID = "screen_recording"

    // Set by ScreenRecorderModule before sending a start/stop command, invoked
    // once the capture pipeline has actually finished and (attempted to) save —
    // simple in-process callback registry, same pattern as PoseOverlayRegistry,
    // avoids pulling in a broadcast-manager dependency for a same-process signal.
    @Volatile var resultCallback: ((saved: Boolean, error: String?) -> Unit)? = null
  }
}
