package com.danceframe.pose

import java.util.Collections
import java.util.WeakHashMap

data class PoseOverlayKeypoint(
    val x: Double,
    val y: Double,
    val confidence: Double,
)

data class PoseOverlayFrame(
    val frameWidth: Int,
    val frameHeight: Int,
    val keypoints: List<PoseOverlayKeypoint>,
)

object PoseOverlayRegistry {
  private val views = Collections.newSetFromMap(WeakHashMap<PoseOverlayView, Boolean>())
  private val lock = Any()

  @Volatile private var latestFrame: PoseOverlayFrame? = null

  fun register(view: PoseOverlayView) {
    val frame = latestFrame
    synchronized(lock) {
      views.add(view)
    }
    view.post {
      view.updatePoseFrame(frame)
    }
  }

  fun unregister(view: PoseOverlayView) {
    synchronized(lock) {
      views.remove(view)
    }
  }

  fun publish(frame: PoseOverlayFrame?) {
    latestFrame = frame
    val snapshot: List<PoseOverlayView> =
        synchronized(lock) {
          views.toList()
        }

    snapshot.forEach { view ->
      view.post {
        view.updatePoseFrame(frame)
      }
    }
  }
}
