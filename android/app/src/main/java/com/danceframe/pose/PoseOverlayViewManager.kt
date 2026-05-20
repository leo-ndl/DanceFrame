package com.danceframe.pose

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp

class PoseOverlayViewManager : SimpleViewManager<PoseOverlayView>() {
  override fun getName(): String = "PoseOverlayView"

  override fun createViewInstance(reactContext: ThemedReactContext): PoseOverlayView {
    return PoseOverlayView(reactContext)
  }

  @ReactProp(name = "enabled", defaultBoolean = true)
  fun setEnabled(view: PoseOverlayView, enabled: Boolean) {
    view.overlayEnabled = enabled
  }

  @ReactProp(name = "mirrored", defaultBoolean = false)
  fun setMirrored(view: PoseOverlayView, mirrored: Boolean) {
    view.mirrored = mirrored
  }
}
