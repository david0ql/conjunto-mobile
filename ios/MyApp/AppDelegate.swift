import UIKit
import PushKit
import React
import ReactNativeNavigation
import FirebaseCore
import RNCallKeep
import RNVoipPushNotification

@main
class AppDelegate: RNNAppDelegate, PKPushRegistryDelegate {
  override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    if FirebaseApp.app() == nil {
      FirebaseApp.configure()
    }

    RNVoipPushNotificationManager.voipRegistration()
    self.reactNativeDelegate = ReactNativeDelegate()
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  func pushRegistry(_ registry: PKPushRegistry, didUpdate credentials: PKPushCredentials, for type: PKPushType) {
    RNVoipPushNotificationManager.didUpdate(credentials, forType: type.rawValue)
  }

  func pushRegistry(_ registry: PKPushRegistry, didInvalidatePushTokenFor type: PKPushType) {
    // iOS invalidates the old token automatically; the JS side can re-register when a new token arrives.
  }

  func pushRegistry(
    _ registry: PKPushRegistry,
    didReceiveIncomingPushWith payload: PKPushPayload,
    for type: PKPushType,
    completion: @escaping () -> Void
  ) {
    RNVoipPushNotificationManager.didReceiveIncomingPush(with: payload, forType: type.rawValue)

    let payloadData = payload.dictionaryPayload
    let uuid = self.stringValue(from: payloadData["uuid"]) ?? self.stringValue(from: payloadData["callId"]) ?? UUID().uuidString.lowercased()
    let callerName = self.stringValue(from: payloadData["callerName"]) ?? "Portería"
    let handle = self.stringValue(from: payloadData["handle"]) ?? "Portería"
    let extra = self.normalizeDictionary(payloadData)

    RNCallKeep.reportNewIncomingCall(
      uuid,
      handle: handle,
      handleType: "generic",
      hasVideo: false,
      localizedCallerName: callerName,
      supportsHolding: false,
      supportsDTMF: false,
      supportsGrouping: false,
      supportsUngrouping: false,
      fromPushKit: true,
      payload: extra,
      withCompletionHandler: completion
    )
  }

  private func stringValue(from value: Any?) -> String? {
    if let string = value as? String, !string.isEmpty {
      return string
    }
    return nil
  }

  private func normalizeDictionary(_ value: [AnyHashable: Any]) -> [String: Any] {
    var normalized: [String: Any] = [:]
    for (key, nestedValue) in value {
      guard let stringKey = key as? String else {
        continue
      }
      if let nestedDictionary = nestedValue as? [AnyHashable: Any] {
        normalized[stringKey] = normalizeDictionary(nestedDictionary)
      } else {
        normalized[stringKey] = nestedValue
      }
    }
    return normalized
  }
}

// The iOS 27 SDK requires the UIScene lifecycle (an app without it crashes on
// launch). react-native-navigation creates its window in didFinishLaunching,
// before any scene exists, so attach that same window to the scene here.
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(
    _ scene: UIScene,
    willConnectTo session: UISceneSession,
    options connectionOptions: UIScene.ConnectionOptions
  ) {
    guard let windowScene = scene as? UIWindowScene else {
      return
    }
    let appDelegate = UIApplication.shared.delegate as? AppDelegate
    let window = appDelegate?.window ?? UIWindow(windowScene: windowScene)
    window.windowScene = windowScene
    appDelegate?.window = window
    self.window = window
    window.makeKeyAndVisible()
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
