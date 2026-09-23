/**
 * Secure storage for login credentials, backed by the OS keychain
 * (iOS Keychain / Android Keystore via react-native-keychain).
 *
 * Two separate keychain entries are kept:
 * - SERVICE: plain "remember password" credentials, unlocked by the app.
 * - BIOMETRIC_SERVICE: same shape but gated behind Face ID / fingerprint
 *   (BIOMETRY_CURRENT_SET), so retrieving it always triggers the OS prompt.
 */
import * as Keychain from 'react-native-keychain';

const SERVICE = 'nordikhat_saved_login';
const BIOMETRIC_SERVICE = 'nordikhat_biometric_login';

export type SavedCredentials = { identifier: string; password: string };

export const credentialsStore = {
  async save(identifier: string, password: string): Promise<void> {
    await Keychain.setGenericPassword(identifier, password, { service: SERVICE });
  },

  async get(): Promise<SavedCredentials | null> {
    try {
      const result = await Keychain.getGenericPassword({ service: SERVICE });
      if (!result) return null;
      return { identifier: result.username, password: result.password };
    } catch {
      return null;
    }
  },

  async clear(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE });
  },

  async getSupportedBiometryType(): Promise<Keychain.BIOMETRY_TYPE | null> {
    try {
      return await Keychain.getSupportedBiometryType();
    } catch {
      return null;
    }
  },

  async hasBiometricCredentials(): Promise<boolean> {
    try {
      return await Keychain.hasGenericPassword({ service: BIOMETRIC_SERVICE });
    } catch {
      return false;
    }
  },

  async saveBiometric(identifier: string, password: string): Promise<void> {
    await Keychain.setGenericPassword(identifier, password, {
      service: BIOMETRIC_SERVICE,
      accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_CURRENT_SET,
      accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },

  async getBiometric(promptMessage: string): Promise<SavedCredentials | null> {
    try {
      const result = await Keychain.getGenericPassword({
        service: BIOMETRIC_SERVICE,
        authenticationPrompt: { title: promptMessage },
      });
      if (!result) return null;
      return { identifier: result.username, password: result.password };
    } catch {
      return null;
    }
  },

  async clearBiometric(): Promise<void> {
    await Keychain.resetGenericPassword({ service: BIOMETRIC_SERVICE });
  },
};
