# HMS Push (Huawei Android)

HMS support is opt-in and contains no credentials in source control.

1. Create `com.nordikhat.conjunto` in AppGallery Connect, enable Push Kit, and configure the
   release signing certificate fingerprint.
2. Download `agconnect-services.json` into `android/app/` (the path is gitignored).
3. Build with `-PenableHmsPush=true`, for example `cd android && ./gradlew assembleRelease
   -PenableHmsPush=true`.

Without both the property and configuration file, `BuildConfig.HMS_PUSH_ENABLED` is false and
FCM remains selected. `HuaweiPushMessageService` validates call UUID, event, timestamp and TTL
before showing a native high-importance incoming-call notification. Terminal events cancel it.
The last valid event can be read once through `consumePendingHuaweiMessage()` after JS starts.
