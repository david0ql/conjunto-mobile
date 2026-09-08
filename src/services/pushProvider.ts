import {NativeModules, Platform} from 'react-native';

export type AndroidPushProvider = 'fcm' | 'hms' | 'none';

export interface HuaweiPushCapability {
  enabled: boolean;
  configured: boolean;
  hmsAvailable: boolean;
}

interface HuaweiPushNativeModule {
  getCapability(): Promise<HuaweiPushCapability>;
  getToken(): Promise<string>;
  consumePendingMessage(): Promise<string | null>;
}

const huaweiPush = NativeModules.HuaweiPush as HuaweiPushNativeModule | undefined;
const unavailable: HuaweiPushCapability = {enabled: false, configured: false, hmsAvailable: false};

export async function getHuaweiPushCapability(): Promise<HuaweiPushCapability> {
  if (Platform.OS !== 'android' || !huaweiPush) return unavailable;
  try {
    return await huaweiPush.getCapability();
  } catch {
    return unavailable;
  }
}

export async function selectAndroidPushProvider(): Promise<AndroidPushProvider> {
  if (Platform.OS !== 'android') return 'none';
  const capability = await getHuaweiPushCapability();
  return capability.enabled && capability.configured && capability.hmsAvailable ? 'hms' : 'fcm';
}

export async function getHuaweiPushToken(): Promise<string | null> {
  const capability = await getHuaweiPushCapability();
  if (!huaweiPush || !capability.enabled || !capability.configured || !capability.hmsAvailable) return null;
  return (await huaweiPush.getToken()) || null;
}

export async function consumePendingHuaweiMessage(): Promise<Record<string, unknown> | null> {
  if (!huaweiPush) return null;
  const raw = await huaweiPush.consumePendingMessage();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}
