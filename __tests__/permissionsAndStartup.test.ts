/**
 * Crash on porter login / when permissions were cancelled, and permissions
 * requested again at the moment they are needed.
 *
 * Crash: "CannotPostForegroundServiceNotificationException: Bad notification
 * for startForeground — invalid channel for service notification
 * (channel=intercom-ready)". The notification channels were created in the
 * same try block as RNCallKeep.setup(); on Android that call blocks on an
 * Alert whose "Cancelar" rejects, so a fresh install where the user cancelled
 * never created the channels and the "Intercom activo" foreground service
 * killed the app right after login.
 */

jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => undefined),
    getChannel: jest.fn(async () => ({ id: 'channel' })),
    displayNotification: jest.fn(async () => undefined),
    registerForegroundService: jest.fn(),
    onForegroundEvent: jest.fn(),
    requestPermission: jest.fn(async () => ({ authorizationStatus: 1 })),
    isBatteryOptimizationEnabled: jest.fn(async () => false),
    stopForegroundService: jest.fn(async () => undefined),
    cancelNotification: jest.fn(async () => undefined),
  },
  AndroidCategory: { CALL: 'call', SERVICE: 'service' },
  AndroidForegroundServiceType: {
    FOREGROUND_SERVICE_TYPE_DATA_SYNC: 1,
    FOREGROUND_SERVICE_TYPE_PHONE_CALL: 4,
    FOREGROUND_SERVICE_TYPE_MICROPHONE: 128,
  },
  AndroidImportance: { LOW: 2, HIGH: 4 },
  AndroidVisibility: { PUBLIC: 1 },
  AuthorizationStatus: { DENIED: 0, AUTHORIZED: 1 },
  EventType: { PRESS: 1, ACTION_PRESS: 2 },
}));

jest.mock('react-native-callkeep', () => ({
  __esModule: true,
  default: {
    setup: jest.fn(),
    setReachable: jest.fn(),
    addEventListener: jest.fn(),
    getInitialEvents: jest.fn(async () => []),
    clearInitialEvents: jest.fn(async () => undefined),
    checkPhoneAccountEnabled: jest.fn(async () => true),
    registerPhoneAccount: jest.fn(),
  },
  AudioSessionCategoryOption: { allowBluetooth: 1, allowBluetoothA2DP: 2, defaultToSpeaker: 4 },
  AudioSessionMode: { voiceChat: 'voiceChat' },
  CONSTANTS: { END_CALL_REASONS: { FAILED: 1, REMOTE_ENDED: 2 } },
}));

import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';
import {
  PermissionPromptError,
  requestPermission,
  showPermissionSettingsAlert,
} from '../src/services/permissions';

const { GRANTED, DENIED, NEVER_ASK_AGAIN } = PermissionsAndroid.RESULTS;

let alertSpy: jest.SpyInstance;
let checkSpy: jest.SpyInstance;
let requestMultipleSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  checkSpy = jest.spyOn(PermissionsAndroid, 'check').mockResolvedValue(false);
  requestMultipleSpy = jest.spyOn(PermissionsAndroid, 'requestMultiple');
  jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('requestPermission (asks again when needed)', () => {
  it('does not prompt when the permission is already granted', async () => {
    checkSpy.mockResolvedValue(true);
    await expect(requestPermission('microphone')).resolves.toBe('granted');
    expect(requestMultipleSpy).not.toHaveBeenCalled();
  });

  it('asks again when it was denied before, and reports the answer', async () => {
    requestMultipleSpy.mockResolvedValueOnce({ 'android.permission.RECORD_AUDIO': GRANTED });
    await expect(requestPermission('microphone')).resolves.toBe('granted');

    requestMultipleSpy.mockResolvedValueOnce({ 'android.permission.CAMERA': DENIED });
    await expect(requestPermission('camera')).resolves.toBe('denied');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('when Android blocked the dialog ("never ask again") it offers opening settings', async () => {
    requestMultipleSpy.mockResolvedValueOnce({ 'android.permission.CAMERA': NEVER_ASK_AGAIN });

    await expect(requestPermission('camera')).resolves.toBe('blocked');

    expect(alertSpy).toHaveBeenCalledTimes(1);
    const buttons = alertSpy.mock.calls[0][2] as Array<{ text: string; onPress?: () => void }>;
    buttons.find((button) => button.text === 'Abrir ajustes')!.onPress!();
    expect(Linking.openSettings).toHaveBeenCalled();
  });

  it('can skip the settings prompt for optional permissions', async () => {
    requestMultipleSpy.mockResolvedValueOnce({
      'android.permission.CALL_PHONE': NEVER_ASK_AGAIN,
      'android.permission.READ_PHONE_NUMBERS': NEVER_ASK_AGAIN,
    });
    await expect(requestPermission('phone', { promptSettingsIfBlocked: false })).resolves.toBe('blocked');
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it('phone permission covers placing calls and the phone number/state permission', async () => {
    requestMultipleSpy.mockResolvedValueOnce({});
    await requestPermission('phone');
    const requested = requestMultipleSpy.mock.calls[0][0] as string[];
    expect(requested).toContain('android.permission.CALL_PHONE');
    expect(requested.some((item) => /READ_PHONE_(NUMBERS|STATE)/.test(item))).toBe(true);
  });

  it('never throws (a failing native module counts as denied)', async () => {
    checkSpy.mockRejectedValueOnce(new Error('native'));
    await expect(requestPermission('microphone')).resolves.toBe('denied');
  });

  it('is a no-op on iOS (the system prompts when the feature is used)', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await expect(requestPermission('camera')).resolves.toBe('granted');
    expect(checkSpy).not.toHaveBeenCalled();
  });

  it('exposes the settings alert and a typed error for already-informed failures', () => {
    showPermissionSettingsAlert('microphone');
    expect(alertSpy.mock.calls[0][0]).toMatch(/micrófono/i);
    expect(new PermissionPromptError('x')).toBeInstanceOf(Error);
  });
});

describe('call service startup on Android (the login crash)', () => {
  /**
   * callNative is a singleton: every test loads a fresh registry and takes
   * react-native / notifee / callkeep from that same registry, so spies watch
   * exactly the instances callNative uses.
   */
  const load = () => {
    jest.resetModules();
    const rn = require('react-native') as typeof import('react-native');
    jest.replaceProperty(rn.Platform, 'OS', 'android');
    rn.NativeModules.RNCallKeep = { setup: jest.fn(), openPhoneAccounts: jest.fn() };
    const env = {
      rn,
      alert: jest.spyOn(rn.Alert, 'alert').mockImplementation(() => undefined),
      check: jest.spyOn(rn.PermissionsAndroid, 'check').mockResolvedValue(false),
      notifee: (require('@notifee/react-native') as { default: Record<string, jest.Mock> }).default,
      callKeep: (require('react-native-callkeep') as { default: Record<string, jest.Mock> }).default,
      callNative: (require('../src/realtime/calls/callNative') as typeof import('../src/realtime/calls/callNative')).callNative,
    };
    return env;
  };
  const handlers = { onAnswerCall: jest.fn(), onEndCall: jest.fn(), onOpenCallUi: jest.fn() };

  it('creates the notification channels even when the CallKeep setup fails', async () => {
    const env = load();
    env.rn.NativeModules.RNCallKeep.setup.mockImplementation(() => {
      throw new Error('no connection service');
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);

    await env.callNative.initialize(handlers);

    const channels = env.notifee.createChannel.mock.calls.map(([channel]) => channel.id);
    expect(channels).toEqual(expect.arrayContaining(['intercom-ready', 'intercom-live', 'incoming-call-ring']));
  });

  it('creates the channels before touching CallKeep', async () => {
    const env = load();
    await env.callNative.initialize(handlers);

    const firstChannel = env.notifee.createChannel.mock.invocationCallOrder[0];
    const setupOrder = env.rn.NativeModules.RNCallKeep.setup.mock.invocationCallOrder[0];
    expect(firstChannel).toBeLessThan(setupOrder);
  });

  it('does not use the blocking RNCallKeep.setup dialog on Android and finishes initializing', async () => {
    const env = load();

    await expect(env.callNative.initialize(handlers)).resolves.toBeUndefined();

    expect(env.callKeep.setup).not.toHaveBeenCalled();
    expect(env.rn.NativeModules.RNCallKeep.setup).toHaveBeenCalledWith(
      expect.objectContaining({ alertTitle: 'Llamadas del intercom' }),
    );
    expect(env.alert).not.toHaveBeenCalled();
  });

  it('never starts the foreground service on a missing channel', async () => {
    const env = load();
    await env.callNative.initialize(handlers);
    env.notifee.getChannel.mockResolvedValueOnce(null);

    await env.callNative.showReadyNotification('ready');

    expect(env.notifee.displayNotification).not.toHaveBeenCalled();
  });

  it('shows the "Intercom activo" service notification when the channel exists', async () => {
    const env = load();
    await env.callNative.initialize(handlers);

    await env.callNative.showReadyNotification('ready');

    expect(env.notifee.displayNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        android: expect.objectContaining({ channelId: 'intercom-ready', asForegroundService: true }),
      }),
    );
  });

  it('during a call without microphone permission the service drops the microphone type (would throw)', async () => {
    const env = load();
    await env.callNative.initialize(handlers);
    env.check.mockResolvedValue(false);

    await env.callNative.showCallNotification({ id: 'c1', direction: 'inbound' } as never, Date.now(), true);

    const types = env.notifee.displayNotification.mock.calls[0][0].android.foregroundServiceTypes;
    expect(types).toEqual([4]);
  });

  it('keeps the microphone type when the permission is granted', async () => {
    const env = load();
    await env.callNative.initialize(handlers);
    env.check.mockResolvedValue(true);

    await env.callNative.showCallNotification({ id: 'c1', direction: 'inbound' } as never, Date.now(), true);

    const types = env.notifee.displayNotification.mock.calls[0][0].android.foregroundServiceTypes;
    expect(types).toEqual([4, 128]);
  });

  it('the phone-account prompt is non-blocking, offers the settings, and only once per session', async () => {
    const env = load();
    await env.callNative.initialize(handlers);
    env.callKeep.checkPhoneAccountEnabled.mockResolvedValue(false);
    // The react-native jest preset mocks AppState; the app reads the property.
    (env.rn.AppState as unknown as { currentState: string }).currentState = 'active';

    await env.callNative.promptPhoneAccountIfNeeded();
    await env.callNative.promptPhoneAccountIfNeeded();

    expect(env.alert).toHaveBeenCalledTimes(1);
    const [title, , buttons] = env.alert.mock.calls[0];
    expect(title).toBe('Activa llamadas del sistema');
    (buttons as Array<{ text: string; onPress?: () => void }>).find((b) => b.text === 'Abrir ajustes')!.onPress!();
    expect(env.rn.NativeModules.RNCallKeep.openPhoneAccounts).toHaveBeenCalled();
  });
});
