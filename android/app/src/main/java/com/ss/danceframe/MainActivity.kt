package com.ss.danceframe

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  override fun getMainComponentName(): String = "DanceFrame"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (intent?.action != Intent.ACTION_SEND) return
    @Suppress("DEPRECATION")
    val uri: Uri = intent.getParcelableExtra(Intent.EXTRA_STREAM) ?: return

    // Eagerly copy to a stable file:// path on a background thread.
    // The content:// grant from TikTok may expire once this activity finishes,
    // so we copy before handing the URI off to JS.
    Thread {
      try {
        val inputStream = contentResolver.openInputStream(uri) ?: return@Thread
        val ext = contentResolver.getType(uri)?.substringAfterLast('/') ?: "mp4"
        val temp = java.io.File(cacheDir, "share_import_${System.currentTimeMillis()}.$ext")
        java.io.FileOutputStream(temp).use { out -> inputStream.copyTo(out) }
        inputStream.close()

        val fileUri = Uri.fromFile(temp).toString()
        val reactContext = (application as? MainApplication)
            ?.reactHost
            ?.currentReactContext
            as? com.facebook.react.bridge.ReactApplicationContext
        ShareModule.storeAndEmit(reactContext, fileUri)
      } catch (_: Exception) {}
    }.start()
  }
}
