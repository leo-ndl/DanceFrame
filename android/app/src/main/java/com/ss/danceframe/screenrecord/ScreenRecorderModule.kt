package com.ss.danceframe.screenrecord

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScreenRecorderModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), ActivityEventListener {

  private var pendingStartPromise: Promise? = null
  private var isRecording = false

  init {
    reactContext.addActivityEventListener(this)
  }

  override fun getName() = "DFScreenRecorder"

  @ReactMethod
  fun isAvailable(promise: Promise) {
    promise.resolve(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
  }

  @ReactMethod
  fun requestPermissionAndStart(promise: Promise) {
    if (isRecording) {
      promise.resolve(Arguments.createMap().apply { putBoolean("started", true) })
      return
    }

    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("E_NO_ACTIVITY", "No current activity to request screen capture consent")
      return
    }

    pendingStartPromise?.reject("E_SUPERSEDED", "A newer screen recording request superseded this one")
    pendingStartPromise = promise

    val manager =
        reactContext.getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
    activity.startActivityForResult(manager.createScreenCaptureIntent(), REQUEST_CODE_SCREEN_CAPTURE)
  }

  @ReactMethod
  fun stopRecording(promise: Promise) {
    if (!isRecording) {
      promise.resolve(Arguments.createMap().apply { putBoolean("saved", false) })
      return
    }
    isRecording = false

    ScreenRecordService.resultCallback = { saved, error ->
      val result =
          Arguments.createMap().apply {
            putBoolean("saved", saved)
            if (error != null) putString("error", error)
          }
      promise.resolve(result)
    }

    val stopIntent =
        Intent(reactContext, ScreenRecordService::class.java).apply { action = ScreenRecordService.ACTION_STOP }
    ContextCompat.startForegroundService(reactContext, stopIntent)
  }

  override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
    if (requestCode != REQUEST_CODE_SCREEN_CAPTURE) return
    val promise = pendingStartPromise
    pendingStartPromise = null

    if (resultCode != Activity.RESULT_OK || data == null) {
      promise?.reject("E_PERMISSION_DENIED", "User denied screen capture consent")
      return
    }

    val startIntent =
        Intent(reactContext, ScreenRecordService::class.java).apply {
          action = ScreenRecordService.ACTION_START
          putExtra(ScreenRecordService.EXTRA_RESULT_CODE, resultCode)
          putExtra(ScreenRecordService.EXTRA_DATA, data)
        }
    ContextCompat.startForegroundService(reactContext, startIntent)
    isRecording = true
    promise?.resolve(Arguments.createMap().apply { putBoolean("started", true) })
  }

  override fun onNewIntent(intent: Intent) {}

  override fun invalidate() {
    pendingStartPromise = null
    ScreenRecordService.resultCallback = null
    super.invalidate()
  }

  companion object {
    private const val REQUEST_CODE_SCREEN_CAPTURE = 4201
  }
}
