import { Alert, Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaDevices } from 'react-native-webrtc';

/**
 * Asks again for a permission at the moment it is needed (a call, a photo).
 *
 * Android stops showing the system dialog after the user denies twice
 * ("never ask again"); in that case the only way back is the app settings, so
 * we explain it and offer to open them instead of failing silently.
 */

export type AppPermission = 'microphone' | 'camera' | 'phone';

export type PermissionOutcome = 'granted' | 'denied' | 'blocked';

/** Thrown when the user was already told what to do (no extra error alert needed). */
export class PermissionPromptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PermissionPromptError';
  }
}

const COPY: Record<AppPermission, { title: string; rationale: string; blocked: string }> = {
  microphone: {
    title: 'Micrófono',
    rationale: 'Se necesita el micrófono para hablar en las llamadas del intercom.',
    blocked: 'El micrófono está bloqueado para la app. Actívalo en Ajustes > Permisos > Micrófono para poder hablar en las llamadas.',
  },
  camera: {
    title: 'Cámara',
    rationale: 'Se necesita la cámara para tomar la foto.',
    blocked: 'La cámara está bloqueada para la app. Actívala en Ajustes > Permisos > Cámara para poder tomar fotos.',
  },
  phone: {
    title: 'Llamadas',
    rationale: 'Permite que las llamadas del intercom se muestren como llamadas del teléfono.',
    blocked: 'El permiso de llamadas está bloqueado. Actívalo en Ajustes > Permisos > Teléfono para que las llamadas se muestren como llamadas del teléfono.',
  },
};

function androidPermissions(permission: AppPermission): Permission[] {
  if (permission === 'microphone') return [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
  if (permission === 'camera') return [PermissionsAndroid.PERMISSIONS.CAMERA];
  const phone: Permission[] = [PermissionsAndroid.PERMISSIONS.CALL_PHONE];
  phone.push(
    Number(Platform.Version) >= 30
      ? ('android.permission.READ_PHONE_NUMBERS' as Permission)
      : PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
  );
  return phone;
}

export function showPermissionSettingsAlert(permission: AppPermission) {
  const copy = COPY[permission];
  Alert.alert(`Permiso de ${copy.title.toLowerCase()} bloqueado`, copy.blocked, [
    { text: 'Ahora no', style: 'cancel' },
    {
      text: 'Abrir ajustes',
      onPress: () => {
        void Linking.openSettings();
      },
    },
  ]);
}

export type EssentialPermissionCheck = {
  key: AppPermission | 'notifications' | 'battery';
  label: string;
  granted: boolean;
};

async function isMicrophoneGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
}

async function isCameraGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  return PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CAMERA);
}

async function isPhoneGranted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const checks = await Promise.all(androidPermissions('phone').map((item) => PermissionsAndroid.check(item)));
  return checks.every(Boolean);
}

async function isNotificationsGranted(): Promise<boolean> {
  try {
    const settings = await notifee.getNotificationSettings();
    return settings.authorizationStatus >= AuthorizationStatus.AUTHORIZED;
  } catch {
    return true;
  }
}

async function isBatteryUnrestricted(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  try {
    const restricted = await notifee.isBatteryOptimizationEnabled();
    return !restricted;
  } catch {
    return true;
  }
}

/**
 * Reads the current status of every permission the app needs to reliably
 * place/receive intercom calls, send notifications and take photos. This
 * only checks — it never pops a system prompt — so it's safe to run on
 * every app open, even offline.
 */
export async function checkEssentialPermissions(): Promise<EssentialPermissionCheck[]> {
  const [microphone, camera, phone, notifications, battery] = await Promise.all([
    isMicrophoneGranted(),
    isCameraGranted(),
    isPhoneGranted(),
    isNotificationsGranted(),
    isBatteryUnrestricted(),
  ]);

  return [
    { key: 'microphone', label: COPY.microphone.title, granted: microphone },
    { key: 'camera', label: COPY.camera.title, granted: camera },
    { key: 'phone', label: COPY.phone.title, granted: phone },
    { key: 'notifications', label: 'Notificaciones', granted: notifications },
    { key: 'battery', label: 'Ahorro de batería desactivado', granted: battery },
  ];
}

/**
 * Shows a single summary alert listing every permission still missing for
 * the app to work correctly (calls, notifications, photos). Meant to run
 * once per app open so the user always knows what to fix, instead of
 * stumbling into a silent failure (e.g. a call that never rings) later.
 */
const IOS_MIC_PROMPTED_KEY = 'permissions.iosMicrophonePrompted';

/**
 * iOS only shows the microphone prompt the first time the mic is opened, which
 * otherwise happens mid-call (after answering from CallKit). Open it briefly
 * once at app start so the prompt appears up front; after the first answer
 * iOS never prompts again, so it is not repeated.
 */
async function promptIosMicrophoneOnce(): Promise<void> {
  if (Platform.OS !== 'ios') return;
  try {
    if (await AsyncStorage.getItem(IOS_MIC_PROMPTED_KEY)) return;
  } catch {
    // Storage unavailable: prompting again is harmless.
  }
  try {
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach((track) => track.stop());
  } catch {
    // Denied: the call flow offers the settings when it is needed.
  }
  try {
    await AsyncStorage.setItem(IOS_MIC_PROMPTED_KEY, '1');
  } catch {
    // Ignore.
  }
}

export async function warnAboutMissingPermissions(): Promise<void> {
  await promptIosMicrophoneOnce();
  const checks = await checkEssentialPermissions();
  const missing = checks.filter((c) => !c.granted);
  if (missing.length === 0) return;

  const list = missing.map((c) => `• ${c.label}`).join('\n');
  Alert.alert(
    'Permisos pendientes',
    `Para que la app reciba llamadas, avisos de portería y funcione sin interrupciones, activa:\n\n${list}\n\nSin esto la app puede no sonar cuando te llamen.`,
    [
      { text: 'Ahora no', style: 'cancel' },
      {
        text: 'Abrir ajustes',
        onPress: () => {
          if (missing.some((c) => c.key === 'battery') && Platform.OS === 'android') {
            notifee.openBatteryOptimizationSettings().catch(() => void Linking.openSettings());
          } else {
            void Linking.openSettings();
          }
        },
      },
    ],
  );
}

/**
 * Checks the permission and requests it again if missing. On iOS the system
 * prompts when the feature is used, so this resolves 'granted'.
 */
export async function requestPermission(
  permission: AppPermission,
  options: { promptSettingsIfBlocked?: boolean } = {},
): Promise<PermissionOutcome> {
  if (Platform.OS !== 'android') {
    return 'granted';
  }

  const permissions = androidPermissions(permission);
  try {
    const current = await Promise.all(permissions.map((item) => PermissionsAndroid.check(item)));
    if (current.every(Boolean)) {
      return 'granted';
    }

    const results = await PermissionsAndroid.requestMultiple(permissions);
    const values = permissions.map((item) => results[item]);
    if (values.every((value) => value === PermissionsAndroid.RESULTS.GRANTED)) {
      return 'granted';
    }
    if (values.some((value) => value === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN)) {
      if (options.promptSettingsIfBlocked ?? true) {
        showPermissionSettingsAlert(permission);
      }
      return 'blocked';
    }
    return 'denied';
  } catch {
    return 'denied';
  }
}
