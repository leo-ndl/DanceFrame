package com.ss.danceframe

import android.app.Application
import com.ss.danceframe.pose.PoseFrameProcessorPlugin
import com.ss.danceframe.pose.PoseInferencePackage
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(PoseInferencePackage())
          add(KeepAwakePackage())
          add(SharePackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    PoseFrameProcessorPlugin.register()
    loadReactNative(this)
  }
}
