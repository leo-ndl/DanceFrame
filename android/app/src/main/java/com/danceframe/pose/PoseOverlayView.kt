package com.danceframe.pose

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.util.AttributeSet
import android.view.View
import kotlin.math.max

class PoseOverlayView @JvmOverloads constructor(
    context: Context,
    attrs: AttributeSet? = null,
) : View(context, attrs) {

  private val density = resources.displayMetrics.density

  private val pointPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(242, 61, 206, 102)
      }

  private val linePaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.argb(178, 61, 206, 102)
        strokeWidth = 2.5f * density
        strokeCap = Paint.Cap.ROUND
      }

  private val pointRadiusPx = 4f * density

  var overlayEnabled: Boolean = true
    set(value) {
      if (field == value) return
      field = value
      invalidate()
    }

  var mirrored: Boolean = false
    set(value) {
      if (field == value) return
      field = value
      invalidate()
    }

  private var poseFrame: PoseOverlayFrame? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    PoseOverlayRegistry.register(this)
  }

  override fun onDetachedFromWindow() {
    PoseOverlayRegistry.unregister(this)
    super.onDetachedFromWindow()
  }

  fun updatePoseFrame(frame: PoseOverlayFrame?) {
    poseFrame = frame
    invalidate()
  }

  override fun onDraw(canvas: Canvas) {
    super.onDraw(canvas)

    if (!overlayEnabled) return
    val frame = poseFrame ?: return
    if (width <= 0 || height <= 0 || frame.frameWidth <= 0 || frame.frameHeight <= 0) return

    val sourceWidth = frame.frameWidth.toFloat()
    val sourceHeight = frame.frameHeight.toFloat()
    val viewWidth = width.toFloat()
    val viewHeight = height.toFloat()

    val coverScale = max(viewWidth / sourceWidth, viewHeight / sourceHeight)
    val scaledWidth = sourceWidth * coverScale
    val scaledHeight = sourceHeight * coverScale
    val offsetX = (viewWidth - scaledWidth) * 0.5f
    val offsetY = (viewHeight - scaledHeight) * 0.5f

    val count = frame.keypoints.size
    val screenX = FloatArray(count)
    val screenY = FloatArray(count)
    val visible = BooleanArray(count)

    for (i in 0 until count) {
      val keypoint = frame.keypoints[i]
      if (keypoint.confidence <= 0.0) continue
      var srcX = (keypoint.x.coerceIn(0.0, 1.0) * sourceWidth).toFloat()
      val srcY = (keypoint.y.coerceIn(0.0, 1.0) * sourceHeight).toFloat()
      if (mirrored) srcX = sourceWidth - srcX
      screenX[i] = offsetX + srcX * coverScale
      screenY[i] = offsetY + srcY * coverScale
      visible[i] = true
    }

    // Draw skeleton lines behind the joints.
    for ((a, b) in SKELETON_CONNECTIONS) {
      if (a >= count || b >= count || !visible[a] || !visible[b]) continue
      canvas.drawLine(screenX[a], screenY[a], screenX[b], screenY[b], linePaint)
    }

    // Draw keypoint circles on top.
    for (i in 0 until count) {
      if (!visible[i]) continue
      canvas.drawCircle(screenX[i], screenY[i], pointRadiusPx, pointPaint)
    }
  }

  companion object {
    // Keypoint index pairs matching the KEYPOINT_MAPPING order in PoseInferenceModule.
    val SKELETON_CONNECTIONS = listOf(
      0 to 1,  0 to 2,   // nose → eyes
      1 to 3,  2 to 4,   // eyes → ears
      5 to 6,            // shoulder to shoulder
      5 to 7,  7 to 9,   // left arm
      6 to 8,  8 to 10,  // right arm
      5 to 11, 6 to 12,  // torso sides
      11 to 12,          // hips
      11 to 13, 13 to 15, // left leg
      12 to 14, 14 to 16, // right leg
    )
  }
}
