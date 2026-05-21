import { Platform } from 'react-native';
import { authStore } from '../context/auth.store';
import { API_URL } from './api';

interface ErrorLogPayload {
  message: string;
  stack?: string;
  screen?: string;
  deviceInfo?: string;
  appVersion?: string;
  userId?: string;
  userType?: string;
}

const queue: ErrorLogPayload[] = [];
let flushing = false;

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  const batch = queue.splice(0);
  try {
    await fetch(`${API_URL}/error-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(batch.length === 1 ? batch[0] : batch),
    });
  } catch {
    // silently fail — can't log errors about error logging
  } finally {
    flushing = false;
    if (queue.length > 0) flush();
  }
}

function enqueue(payload: ErrorLogPayload) {
  queue.push(payload);
  flush();
}

function getDeviceInfo(): string {
  const info: Record<string, unknown> = {
    platform: Platform.OS,
    version: Platform.Version,
    brand: Platform.constants?.Brand,
    model: Platform.constants?.Model,
  };
  try {
    return JSON.stringify(info);
  } catch {
    return '';
  }
}

export const errorLogger = {
  report(error: unknown, screen?: string) {
    const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
    const stack = error instanceof Error ? error.stack : undefined;
    const user = authStore.getUser();
    enqueue({
      message,
      stack,
      screen,
      deviceInfo: getDeviceInfo(),
      userId: user?.id,
      userType: user?.type,
    });
  },

  init() {
    const origError = console.error;
    console.error = (...args: unknown[]) => {
      origError.apply(console, args);
      const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      enqueue({ message, deviceInfo: getDeviceInfo() });
    };

    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      origWarn.apply(console, args);
      const message = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (message.includes('call') || message.includes('socket') || message.includes('webrtc')) {
        enqueue({ message, deviceInfo: getDeviceInfo() });
      }
    };

    if (ErrorUtils?.setGlobalHandler) {
      ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        enqueue({
          message: error.message,
          stack: error.stack,
          deviceInfo: getDeviceInfo(),
        });
        if (isFatal) {
          origError('[FATAL]', error);
        }
      });
    }

    if (typeof globalThis.__ErrorUtils !== 'undefined') {
      globalThis.__ErrorUtils.setGlobalHandler((error: Error, isFatal?: boolean) => {
        enqueue({
          message: error.message,
          stack: error.stack,
          deviceInfo: getDeviceInfo(),
        });
      });
    }
  },
};
