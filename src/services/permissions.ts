import { Alert, Linking, PermissionsAndroid, Platform, type Permission } from 'react-native';

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
