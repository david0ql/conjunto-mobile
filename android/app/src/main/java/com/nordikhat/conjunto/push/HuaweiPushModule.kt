package com.nordikhat.conjunto.push

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import com.huawei.agconnect.config.AGConnectServicesConfig
import com.huawei.hms.aaid.HmsInstanceId
import com.huawei.hms.api.HuaweiApiAvailability
import com.nordikhat.conjunto.BuildConfig

class HuaweiPushModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  override fun getName(): String = "HuaweiPush"

  @ReactMethod
  fun getCapability(promise: Promise) {
    val result = WritableNativeMap()
    val available = HuaweiApiAvailability.getInstance().isHuaweiMobileServicesAvailable(context) == 0
    val appId = configuredAppId()
    result.putBoolean("hmsAvailable", available)
    result.putBoolean("configured", BuildConfig.HMS_PUSH_ENABLED && !appId.isNullOrBlank())
    result.putBoolean("enabled", BuildConfig.HMS_PUSH_ENABLED)
    promise.resolve(result)
  }

  @ReactMethod
  fun getToken(promise: Promise) {
    if (!BuildConfig.HMS_PUSH_ENABLED) {
      promise.reject("HMS_DISABLED", "HMS Push is not enabled for this build")
      return
    }
    val appId = configuredAppId()
    if (appId.isNullOrBlank()) {
      promise.reject("HMS_NOT_CONFIGURED", "Missing app_id in agconnect-services.json")
      return
    }
    Thread {
      try {
        promise.resolve(HmsInstanceId.getInstance(context).getToken(appId, "HCM"))
      } catch (error: Exception) {
        promise.reject("HMS_TOKEN_FAILED", error.message, error)
      }
    }.start()
  }

  @ReactMethod
  fun consumePendingMessage(promise: Promise) {
    val preferences = context.getSharedPreferences(HuaweiPushMessageService.PREFS, android.content.Context.MODE_PRIVATE)
    synchronized(HuaweiPushMessageService::class.java) {
      val payload = preferences.getString(HuaweiPushMessageService.KEY_PENDING_DATA, null)
      if (payload != null) preferences.edit().remove(HuaweiPushMessageService.KEY_PENDING_DATA).commit()
      promise.resolve(payload)
    }
  }

  private fun configuredAppId(): String? = try {
    AGConnectServicesConfig.fromContext(context).getString("client/app_id")
  } catch (_: Exception) {
    null
  }
}
