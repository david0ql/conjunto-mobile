package com.myapp

import com.facebook.react.PackageList
import com.facebook.react.ReactHost
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost
import com.facebook.react.ReactNativeHost
import com.reactnativenavigation.NavigationApplication
import com.reactnativenavigation.NavigationPackage
import com.reactnativenavigation.react.NavigationReactNativeHost

class MainApplication : NavigationApplication() {
  override val reactNativeHost: ReactNativeHost =
      object : NavigationReactNativeHost(this) {
        override fun getJSMainModuleName(): String = "index"

        override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

        override fun getPackages() =
            PackageList(this).packages.apply {
              add(NavigationPackage())
            }

        override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED

        override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
      }

  override val reactHost: ReactHost by lazy { getDefaultReactHost(this, reactNativeHost) }
}
