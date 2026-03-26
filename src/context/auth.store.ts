/**
 * Simple module-level auth store for React Native Navigation.
 * Since RNN renders each screen in its own React tree, a module-level
 * singleton is the cleanest way to share auth state across screens.
 *
 * Persistence is handled via @react-native-async-storage/async-storage.
 * If AsyncStorage is not available (pre-link), falls back to in-memory only.
 */

import type { SessionUser } from '../services/api';

let AsyncStorage: any = null;
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default;
} catch {}

const TOKEN_KEY = 'monolith_access_token';
const USER_KEY = 'monolith_user';

let _token: string | null = null;
let _user: SessionUser | null = null;
let _initialized = false;
const _listeners: Array<() => void> = [];

function notify() {
  _listeners.forEach((fn) => fn());
}

export const authStore = {
  isInitialized(): boolean {
    return _initialized;
  },

  getToken(): string | null {
    return _token;
  },

  getUser(): SessionUser | null {
    return _user;
  },

  isAuthenticated(): boolean {
    return !!_token;
  },

  subscribe(listener: () => void): () => void {
    _listeners.push(listener);
    return () => {
      const idx = _listeners.indexOf(listener);
      if (idx >= 0) _listeners.splice(idx, 1);
    };
  },

  async init(): Promise<void> {
    if (_initialized) return;
    if (AsyncStorage) {
      try {
        const token = await AsyncStorage.getItem(TOKEN_KEY);
        const userJson = await AsyncStorage.getItem(USER_KEY);
        if (token) _token = token;
        if (userJson) _user = JSON.parse(userJson);
      } catch (e) {
        console.warn('[authStore] init failed:', e);
      }
    }
    _initialized = true;
    notify();
  },

  async setSession(token: string, user: SessionUser): Promise<void> {
    _token = token;
    _user = user;
    if (AsyncStorage) {
      try {
        await AsyncStorage.setItem(TOKEN_KEY, token);
        await AsyncStorage.setItem(USER_KEY, JSON.stringify(user));
      } catch (e) {
        console.warn('[authStore] setSession failed:', e);
      }
    }
    notify();
  },

  async clearSession(): Promise<void> {
    _token = null;
    _user = null;
    if (AsyncStorage) {
      try {
        await AsyncStorage.removeItem(TOKEN_KEY);
        await AsyncStorage.removeItem(USER_KEY);
      } catch (e) {
        console.warn('[authStore] clearSession failed:', e);
      }
    }
    notify();
  },
};
