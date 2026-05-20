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

  private val pointPaint =
      Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.argb(242, 61, 206, 102)
      }

  private val pointRadiusPx = 4f * resources.displayMetrics.density

  var overlayEnabled: Boolean = true
    set(value) {
      if (field == value) {
        return
      }
      field = value
      invalidate()
    }

  var mirrored: Boolean = false
    set(value) {
      if (field == value) {
        return
      }
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

    if (!overlayEnabled) {
      return
    }

    val frame = poseFrame ?: return
    if (width <= 0 || height <= 0 || frame.frameWidth <= 0 || frame.frameHeight <= 0) {
      return
    }

    val sourceWidth = frame.frameWidth.toFloat()
    val sourceHeight = frame.frameHeight.toFloat()
    val viewWidth = width.toFloat()
    val viewHeight = height.toFloat()

    val coverScale = max(viewWidth / sourceWidth, viewHeight / sourceHeight)
    val scaledWidth = sourceWidth * coverScale
    val scaledHeight = sourceHeight * coverScale
    val offsetX = (viewWidth - scaledWidth) * 0.5f
    val offsetY = (viewHeight - scaledHeight) * 0.5f

    frame.keypoints.forEach { keypoint ->
      if (keypoint.confidence <= 0.0) {
        return@forEach
      }

      var sourceX = (keypoint.x.coerceIn(0.0, 1.0) * sourceWidth).toFloat()
      val sourceY = (keypoint.y.coerceIn(0.0, 1.0) * sourceHeight).toFloat()
      if (mirrored) {
        sourceX = sourceWidth - sourceX
      }

      val drawX = offsetX + (sourceX * coverScale)
      val drawY = offsetY + (sourceY * coverScale)
      canvas.drawCircle(drawX, drawY, pointRadiusPx, pointPaint)
    }
  }
}
