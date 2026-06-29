package com.ss.danceframe

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class ShareModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    // Required stubs for RN event emitter
    @ReactMethod fun addListener(eventName: String) {}
    @ReactMethod fun removeListeners(count: Int) {}

    @ReactMethod
    fun getPendingShareVideo(promise: Promise) {
        val uri = pendingUri
        pendingUri = null
        promise.resolve(uri)
    }

    companion object {
        const val NAME = "ShareModule"

        // Set by MainActivity before React initialises; cleared once consumed.
        @Volatile var pendingUri: String? = null

        fun storeAndEmit(reactContext: ReactApplicationContext?, uri: String) {
            pendingUri = uri
            reactContext ?: return
            if (!reactContext.hasActiveCatalystInstance()) return
            // React is running — fire a live event and clear the pending slot.
            val payload = Arguments.createMap().apply { putString("videoUri", uri) }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("onIncomingShare", payload)
            pendingUri = null
        }
    }
}
