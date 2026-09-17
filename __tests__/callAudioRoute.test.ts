/**
 * Speaker / mute behaviour of the call service.
 *
 * Bug: calls started "on speaker" (button highlighted) but audio came out of
 * the earpiece until the user toggled it off and on. Android's call service
 * resets the route when the call becomes active and iOS drops routes set
 * before CallKit activates the audio session; several code paths also forced
 * speaker back on, overriding the user's choice.
 */

declare const __dirname: string;

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (key: string) => store.get(key) ?? null),
      setItem: jest.fn(async (key: string, value: string) => void store.set(key, value)),
      removeItem: jest.fn(async (key: string) => void store.delete(key)),
    },
  };
});
jest.mock('@notifee/react-native', () => ({ __esModule: true, default: { displayNotification: jest.fn() } }));
jest.mock('@react-native-firebase/messaging', () => ({
  AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 },
  getAPNSToken: jest.fn(),
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(),
  hasPermission: jest.fn(),
  isDeviceRegisteredForRemoteMessages: jest.fn(),
  onMessage: jest.fn(() => () => undefined),
  onTokenRefresh: jest.fn(() => () => undefined),
  registerDeviceForRemoteMessages: jest.fn(),
  requestPermission: jest.fn(),
}));
jest.mock('react-native-incall-manager', () => ({
  __esModule: true,
  default: {
    start: jest.fn(),
    stop: jest.fn(),
    setKeepScreenOn: jest.fn(),
    setForceSpeakerphoneOn: jest.fn(),
    startRingtone: jest.fn(),
    stopRingtone: jest.fn(),
    startRingback: jest.fn(),
    stopRingback: jest.fn(),
  },
}));
jest.mock('react-native-navigation', () => ({
  Navigation: { showOverlay: jest.fn(() => Promise.resolve()), dismissOverlay: jest.fn(() => Promise.resolve()) },
}));
jest.mock('react-native-voip-push-notification', () => ({
  __esModule: true,
  default: { addEventListener: jest.fn(), registerVoipToken: jest.fn() },
}));
jest.mock('react-native-webrtc', () => ({
  mediaDevices: { getUserMedia: jest.fn() },
  RTCIceCandidate: jest.fn(),
  RTCPeerConnection: jest.fn(),
  RTCSessionDescription: jest.fn((value) => value),
}));
jest.mock('socket.io-client', () => ({ io: jest.fn() }));
jest.mock('../src/context/auth.store', () => ({
  authStore: {
    init: jest.fn(async () => undefined),
    getToken: jest.fn(() => null),
    getUser: jest.fn(() => ({ id: 'porter-1', type: 'employee' })),
    isInitialized: jest.fn(() => true),
  },
}));
jest.mock('../src/services/api', () => ({
  getCallPorters: jest.fn(async () => []),
  getCallsIceConfig: jest.fn(async () => ({ iceServers: [] })),
  REALTIME_URL: 'http://localhost',
  createCallTrace: jest.fn(async () => undefined),
  registerCallDevice: jest.fn(async () => undefined),
  unregisterCallDevice: jest.fn(async () => undefined),
}));
jest.mock('../src/services/pushProvider', () => ({
  consumePendingHuaweiMessage: jest.fn(async () => null),
  getHuaweiPushToken: jest.fn(async () => null),
  selectAndroidPushProvider: jest.fn(async () => 'fcm'),
}));
jest.mock('../src/realtime/calls/callNative', () => ({
  CALL_END_REASONS: { FAILED: 1, REMOTE_ENDED: 2, UNANSWERED: 3, ANSWERED_ELSEWHERE: 4, MISSED: 6 },
  callNative: {
    initialize: jest.fn(async () => undefined),
    markCallActive: jest.fn(async () => undefined),
    markCallConnecting: jest.fn(async () => undefined),
    answerIncomingCall: jest.fn(async () => undefined),
    syncSpeaker: jest.fn(async () => undefined),
    syncMuted: jest.fn(async () => undefined),
    endCall: jest.fn(async () => undefined),
    showIncomingCall: jest.fn(async () => true),
    showReadyNotification: jest.fn(async () => undefined),
    showOfflineNotification: jest.fn(async () => undefined),
    ensureReadinessPermissions: jest.fn(async () => undefined),
    teardownSystemState: jest.fn(async () => undefined),
  },
}));

import InCallManager from 'react-native-incall-manager';
import { mediaDevices } from 'react-native-webrtc';
import { callNative, type CallNativeHandlers } from '../src/realtime/calls/callNative';
import { callService } from '../src/realtime/calls/callService';
import { callStore } from '../src/realtime/calls/callStore';

type Internals = {
  scheduleAudioRouteReapply: () => void;
  handleSignal: (callId: string, signal: { type: string; sdp?: string }) => Promise<void>;
  ensureLocalMediaReady: (callId: string) => Promise<boolean>;
  stopAudioModes: () => void;
  peer: unknown;
  peerCallId: string | null;
  localStream: unknown;
  audioRouteAppliedAt: number;
};
const service = callService as unknown as Internals;

const session = {
  id: 'call-1',
  direction: 'inbound',
  status: 'active',
  targetEmployeeIds: ['porter-1'],
  targetResidentIds: [],
} as never;

const speakerCalls = () => (InCallManager.setForceSpeakerphoneOn as jest.Mock).mock.calls.map(([value]) => value);
const routeCalls = () => (callNative.syncSpeaker as jest.Mock).mock.calls;

function activeCall(overrides: Partial<ReturnType<typeof callStore.getState>> = {}) {
  callStore.setState({ session, phase: 'active', muted: false, speaker: true, error: null, startedAt: Date.now(), ...overrides });
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  callStore.reset();
  service.peer = null;
  service.peerCallId = null;
  service.localStream = null;
  service.audioRouteAppliedAt = 0;
});

afterEach(() => {
  service.stopAudioModes();
  jest.useRealTimers();
});

describe('speaker route', () => {
  it('applies speaker to the real call route (Android call service + InCallManager) while audio settles', () => {
    activeCall();
    service.scheduleAudioRouteReapply();
    jest.advanceTimersByTime(3_100);

    expect(speakerCalls()).toEqual([true, true, true, true]);
    expect(routeCalls()).toEqual([
      ['call-1', true],
      ['call-1', true],
      ['call-1', true],
      ['call-1', true],
    ]);
  });

  it('re-applies speaker after the call becomes active (the moment Android resets it to the earpiece)', async () => {
    activeCall({ phase: 'connecting' });
    service.peer = {
      signalingState: 'have-local-offer',
      setRemoteDescription: jest.fn(async () => undefined),
      addIceCandidate: jest.fn(async () => undefined),
    };
    service.peerCallId = 'call-1';

    await service.handleSignal('call-1', { type: 'answer', sdp: 'v=0' });
    const markActiveOrder = (callNative.markCallActive as jest.Mock).mock.invocationCallOrder[0];
    jest.advanceTimersByTime(3_100);

    expect(callStore.getState().phase).toBe('active');
    const routeOrders = (callNative.syncSpeaker as jest.Mock).mock.invocationCallOrder;
    expect(routeOrders.length).toBeGreaterThanOrEqual(4);
    expect(routeOrders.every((order) => order > markActiveOrder)).toBe(true);
    expect(routeCalls().every(([, speaker]) => speaker === true)).toBe(true);
  });

  it('keeps the user choice: after turning speaker off, later re-applies do not force it back on', async () => {
    activeCall();
    callService.toggleSpeaker();
    expect(callStore.getState().speaker).toBe(false);
    (InCallManager.setForceSpeakerphoneOn as jest.Mock).mockClear();
    (callNative.syncSpeaker as jest.Mock).mockClear();

    // e.g. the microphone stream is recreated when the app returns to foreground
    (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue({ getAudioTracks: () => [], getTracks: () => [] });
    await service.ensureLocalMediaReady('call-1');
    jest.advanceTimersByTime(3_100);

    expect(speakerCalls().length).toBeGreaterThan(0);
    expect(speakerCalls().every((value) => value === false)).toBe(true);
    expect(routeCalls().every(([, speaker]) => speaker === false)).toBe(true);
  });

  it('toggling speaker updates both the app route and the Android call route', () => {
    activeCall({ speaker: false });
    callService.toggleSpeaker();

    expect(callStore.getState().speaker).toBe(true);
    expect(speakerCalls()).toEqual([true]);
    expect(routeCalls()).toEqual([['call-1', true]]);
  });

  it('stops re-applying once the call ends', () => {
    activeCall();
    service.scheduleAudioRouteReapply();
    jest.advanceTimersByTime(10);
    service.stopAudioModes();
    callStore.reset();
    (callNative.syncSpeaker as jest.Mock).mockClear();
    jest.advanceTimersByTime(5_000);

    expect(routeCalls()).toEqual([]);
  });

  it('does nothing for a call that is not ringing, connecting or active', () => {
    callStore.setState({ session, phase: 'incoming', muted: false, speaker: true, error: null, startedAt: null });
    service.scheduleAudioRouteReapply();
    jest.advanceTimersByTime(3_100);

    expect(routeCalls()).toEqual([]);
  });
});

describe('native events', () => {
  let wired: CallNativeHandlers;

  beforeAll(() => {
    callService.bootstrap();
    wired = (callNative.initialize as jest.Mock).mock.calls[0][0] as CallNativeHandlers;
  });

  it('bootstrap wires audio-session, route and mute events from the system call UI', () => {
    expect(wired).toEqual(
      expect.objectContaining({
        onAudioSessionActivated: expect.any(Function),
        onAudioRouteChanged: expect.any(Function),
        onMutedChanged: expect.any(Function),
      }),
    );
  });

  it('iOS: when CallKit activates the audio session the speaker preference is applied again', () => {
    activeCall();
    wired.onAudioSessionActivated!();
    jest.advanceTimersByTime(3_100);

    expect(speakerCalls()).toEqual([true, true, true, true]);
  });

  it('reflects a route change made outside the app (Bluetooth / system screen) in the button', () => {
    activeCall();
    service.audioRouteAppliedAt = Date.now() - 10_000;

    wired.onAudioRouteChanged!('BLUETOOTH', 'call-1');
    expect(callStore.getState().speaker).toBe(false);

    service.audioRouteAppliedAt = Date.now() - 10_000;
    wired.onAudioRouteChanged!('Speaker', 'call-1');
    expect(callStore.getState().speaker).toBe(true);
  });

  it('ignores the echo of its own route changes and events for other calls', () => {
    activeCall();
    service.scheduleAudioRouteReapply();
    jest.advanceTimersByTime(10);

    wired.onAudioRouteChanged!('EARPIECE', 'call-1');
    expect(callStore.getState().speaker).toBe(true);

    service.audioRouteAppliedAt = Date.now() - 10_000;
    wired.onAudioRouteChanged!('EARPIECE', 'other-call');
    expect(callStore.getState().speaker).toBe(true);
  });

  it('mute from the system call screen mutes the microphone and the button', () => {
    const track = { enabled: true };
    service.localStream = { getAudioTracks: () => [track], getTracks: () => [track] };
    activeCall();

    wired.onMutedChanged!('call-1', true);
    expect(callStore.getState().muted).toBe(true);
    expect(track.enabled).toBe(false);

    wired.onMutedChanged!('call-1', false);
    expect(track.enabled).toBe(true);
  });
});

describe('mute', () => {
  it('a recreated microphone stream stays muted when the call is muted', async () => {
    activeCall({ muted: true });
    const track = { enabled: true, stop: jest.fn() };
    (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue({ getAudioTracks: () => [track], getTracks: () => [track] });

    await service.ensureLocalMediaReady('call-1');

    expect(track.enabled).toBe(false);
  });

  it('toggling mute syncs the system call (Android and iOS)', () => {
    const track = { enabled: true };
    service.localStream = { getAudioTracks: () => [track], getTracks: () => [track] };
    activeCall();

    callService.toggleMute();

    expect(track.enabled).toBe(false);
    expect(callNative.syncMuted).toHaveBeenCalledWith('call-1', true);
  });
});

describe('outgoing ringback tone', () => {
  // The app project has no Node typings; only these helpers are needed.
  const fs = jest.requireActual('fs') as {
    existsSync: (file: string) => boolean;
    statSync: (file: string) => { size: number };
    readFileSync: (file: string, encoding: 'utf8') => string;
  };
  const path = jest.requireActual('path') as { join: (...parts: string[]) => string };
  const root = path.join(__dirname, '..');

  it('the caller hears a ringback tone, not the phone ringtone, and it follows the speaker button', async () => {
    type WithOutgoing = { handleOutgoing: (s: unknown) => Promise<void> };
    (callNative as unknown as { startOutgoingCall: jest.Mock }).startOutgoingCall = jest.fn(async () => undefined);

    await (callService as unknown as WithOutgoing).handleOutgoing({ ...(session as object), status: 'ringing' });
    jest.advanceTimersByTime(3_100);

    expect(InCallManager.startRingback).toHaveBeenCalledWith('_BUNDLE_');
    expect(InCallManager.startRingback).not.toHaveBeenCalledWith('_DEFAULT_');
    expect(callStore.getState().phase).toBe('ringing');
    expect(routeCalls().length).toBeGreaterThan(0);
    expect(routeCalls().every(([, speaker]) => speaker === true)).toBe(true);
  });

  it.each([
    'android/app/src/main/res/raw/incallmanager_ringback.mp3',
    'ios/MyApp/incallmanager_ringback.mp3',
  ])('ships the ringback file %s (without it InCallManager falls back to the ringtone)', (file) => {
    const absolute = path.join(root, file);
    expect(fs.existsSync(absolute)).toBe(true);
    expect(fs.statSync(absolute).size).toBeGreaterThan(1_000);
  });

  it('the iOS project copies the ringback file into the app bundle', () => {
    const project = fs.readFileSync(path.join(root, 'ios/MyApp.xcodeproj/project.pbxproj'), 'utf8');
    expect(project).toMatch(/incallmanager_ringback\.mp3 in Resources \*\/,\n\t\t\t\);/);
  });
});

describe('permissions asked again when placing or answering a call (Android)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const RN = require('react-native') as typeof import('react-native');
  const { PermissionPromptError } = require('../src/services/permissions') as typeof import('../src/services/permissions');
  type WithSocket = { socket: unknown; activeToken: string | null };
  let emit: jest.Mock;

  beforeEach(() => {
    jest.replaceProperty(RN.Platform, 'OS', 'android');
    (RN.AppState as unknown as { currentState: string }).currentState = 'active';
    jest.spyOn(RN.Alert, 'alert').mockImplementation(() => undefined);
    emit = jest.fn();
    (callService as unknown as WithSocket).socket = { connected: true, disconnected: false, emit, connect: jest.fn(), on: jest.fn(), off: jest.fn() };
    (callService as unknown as WithSocket).activeToken = 'token';
    (callNative as unknown as { promptPhoneAccountIfNeeded: jest.Mock }).promptPhoneAccountIfNeeded = jest.fn(async () => undefined);
    (mediaDevices.getUserMedia as jest.Mock).mockResolvedValue({ getAudioTracks: () => [], getTracks: () => [] });
  });

  afterEach(() => {
    (callService as unknown as WithSocket).socket = null;
    (callService as unknown as WithSocket).activeToken = null;
    jest.restoreAllMocks();
  });

  const permissionResults = (values: Record<string, string>) => {
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    return jest.spyOn(RN.PermissionsAndroid, 'requestMultiple').mockImplementation(async (list) =>
      Object.fromEntries(list.map((item) => [item, values[item] ?? RN.PermissionsAndroid.RESULTS.GRANTED])) as never,
    );
  };

  it('microphone blocked by Android: offers settings, does not start the call, no duplicate error alert', async () => {
    permissionResults({ 'android.permission.RECORD_AUDIO': RN.PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN });

    await expect(callService.startApartmentCall('apt-1')).rejects.toBeInstanceOf(PermissionPromptError);

    expect(RN.Alert.alert).toHaveBeenCalledWith(expect.stringMatching(/micrófono/i), expect.any(String), expect.any(Array));
    expect(emit).not.toHaveBeenCalled();
    expect(callStore.getState().phase).toBe('idle');
  });

  it('microphone denied again: explains it and does not start the call', async () => {
    permissionResults({ 'android.permission.RECORD_AUDIO': RN.PermissionsAndroid.RESULTS.DENIED });

    await expect(callService.callPorter('porter-1')).rejects.toThrow('Debes permitir el micrófono');
    expect(emit).not.toHaveBeenCalled();
  });

  it('microphone granted: re-asks the phone permission, offers system calls, and places the call even if phone is denied', async () => {
    const request = permissionResults({ 'android.permission.CALL_PHONE': RN.PermissionsAndroid.RESULTS.DENIED });

    await callService.startEmployeeCall('porter-2');

    const asked = request.mock.calls.map(([list]) => list).flat();
    expect(asked).toEqual(expect.arrayContaining(['android.permission.RECORD_AUDIO', 'android.permission.CALL_PHONE']));
    expect((callNative as unknown as { promptPhoneAccountIfNeeded: jest.Mock }).promptPhoneAccountIfNeeded).toHaveBeenCalled();
    expect(emit).toHaveBeenCalledWith('calls:initiate-porter', { employeeId: 'porter-2' });
  });

  it('answering from the app asks again for the microphone and answers anyway', async () => {
    const request = permissionResults({ 'android.permission.RECORD_AUDIO': RN.PermissionsAndroid.RESULTS.DENIED });
    callStore.setState({ session, phase: 'incoming', muted: false, speaker: true, error: null, startedAt: null });

    await callService.acceptCurrentCall();

    expect(request.mock.calls.map(([list]) => list).flat()).toContain('android.permission.RECORD_AUDIO');
    expect(emit).toHaveBeenCalledWith('calls:accept', { callId: 'call-1' });
  });

  it('does not answer if the call ended while the permission dialog was open', async () => {
    jest.spyOn(RN.PermissionsAndroid, 'check').mockResolvedValue(false);
    jest.spyOn(RN.PermissionsAndroid, 'requestMultiple').mockImplementation(async (list) => {
      callStore.reset(); // the caller hung up meanwhile
      return Object.fromEntries(list.map((item) => [item, RN.PermissionsAndroid.RESULTS.GRANTED])) as never;
    });
    callStore.setState({ session, phase: 'incoming', muted: false, speaker: true, error: null, startedAt: null });

    await callService.acceptCurrentCall();

    expect(emit).not.toHaveBeenCalledWith('calls:accept', expect.anything());
  });
});
