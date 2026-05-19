package com.danceframe.pose

import com.mrousavy.camera.frameprocessors.Frame
import com.mrousavy.camera.frameprocessors.FrameProcessorPlugin
import com.mrousavy.camera.frameprocessors.FrameProcessorPluginRegistry

class PoseFrameProcessorPlugin : FrameProcessorPlugin() {
  override fun callback(frame: Frame, params: MutableMap<String, Any>?): Any? {
    PoseInferenceModule.getActiveInstance()?.processFrame(frame, params)
    return null
  }

  companion object {
    @Volatile private var isRegistered = false

    @JvmStatic
    fun register() {
      if (isRegistered) {
        return
      }

      FrameProcessorPluginRegistry.addFrameProcessorPlugin("poseFrameProcessor") { _, _ ->
        PoseFrameProcessorPlugin()
      }
      isRegistered = true
    }
  }
}
