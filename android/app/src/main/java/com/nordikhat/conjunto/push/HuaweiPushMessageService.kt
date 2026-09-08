package com.nordikhat.conjunto.push

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import androidx.core.app.NotificationCompat
import com.huawei.hms.push.HmsMessageService
import com.huawei.hms.push.RemoteMessage
import com.nordikhat.conjunto.MainActivity
import com.nordikhat.conjunto.R
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

/** Native HMS entry point; deliberately does not start the React Native runtime. */
class HuaweiPushMessageService : HmsMessageService() {
  override fun onNewToken(token: String) {
    super.onNewToken(token)
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_TOKEN, token).apply()
    sendBroadcast(Intent(ACTION_TOKEN_REFRESHED).setPackage(packageName))
  }

  override fun onMessageReceived(message: RemoteMessage) {
    super.onMessageReceived(message)
    val payload = validate(message.data) ?: return
    // Persist without logging; payloads may identify a resident or a call.
    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(KEY_PENDING_DATA, payload.raw).apply()
    if (payload.event == "incoming") showIncomingCall(payload) else cancelIncomingCall(payload.callId)
  }

  private fun validate(raw: String?): ValidCallPush? {
    if (raw.isNullOrBlank() || raw.length > MAX_PAYLOAD_BYTES) return null
    return try {
      val json = JSONObject(raw)
      if (json.optString("kind") != "call") return null
      val event = json.optString("event")
      if (event !in EVENTS) return null
      val callId = json.optString("callId")
      UUID.fromString(callId)
      val sentAt = Instant.parse(json.optString("timestamp")).toEpochMilli()
      val age = System.currentTimeMillis() - sentAt
      if (age !in -MAX_CLOCK_SKEW_MS..MESSAGE_TTL_MS) return null
      val caller = json.optString("callerName").trim().take(MAX_CALLER_LENGTH).ifBlank { "Porteria" }
      ValidCallPush(raw, callId, event, caller)
    } catch (_: Exception) {
      null
    }
  }

  private fun showIncomingCall(payload: ValidCallPush) {
    val manager = getSystemService(NotificationManager::class.java)
    val ringtone = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
      val attributes = AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Llamadas de porteria", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Avisos de llamadas entrantes"
        enableVibration(true)
        setSound(ringtone, attributes)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
      })
    }
    val openIntent = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
      putExtra("callId", payload.callId)
      putExtra("callEvent", payload.event)
    }
    val pendingIntent = PendingIntent.getActivity(
      this, payload.callId.hashCode(), openIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(this, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_intercom)
      .setContentTitle("Llamada de porteria")
      .setContentText(payload.callerName)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setSound(ringtone)
      .setVibrate(longArrayOf(0, 800, 500, 800))
      .setOngoing(true)
      .setAutoCancel(false)
      .setContentIntent(pendingIntent)
      .setFullScreenIntent(pendingIntent, true)
      .setTimeoutAfter(MESSAGE_TTL_MS)
      .build()
      .apply { flags = flags or android.app.Notification.FLAG_INSISTENT }
    manager.notify(payload.callId, NOTIFICATION_ID, notification)
  }

  private fun cancelIncomingCall(callId: String) {
    getSystemService(NotificationManager::class.java).cancel(callId, NOTIFICATION_ID)
  }

  companion object {
    const val ACTION_TOKEN_REFRESHED = "com.nordikhat.conjunto.HMS_TOKEN_REFRESHED"
    internal const val PREFS = "huawei_push"
    private const val KEY_TOKEN = "token"
    internal const val KEY_PENDING_DATA = "pending_data"
    private const val CHANNEL_ID = "incoming_calls_v1"
    private const val NOTIFICATION_ID = 7401
    private const val MAX_PAYLOAD_BYTES = 64_000
    private const val MAX_CALLER_LENGTH = 80
    // Keep the native alert within the backend's ringing-session deadline.
    private const val MESSAGE_TTL_MS = 45_000L
    private const val MAX_CLOCK_SKEW_MS = 300_000L
    private val EVENTS = setOf("incoming", "accepted", "ended", "missed", "rejected")
  }

  private data class ValidCallPush(val raw: String, val callId: String, val event: String, val callerName: String)
}
