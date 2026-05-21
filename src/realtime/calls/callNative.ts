import { Alert, AppState, Linking, PermissionsAndroid, Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidForegroundServiceType,
  AndroidImportance,
  AndroidVisibility,
  AuthorizationStatus,
  type Event as NotifeeEvent,
  EventType,
} from '@notifee/react-native';
import RNCallKeep, {
  AudioSessionCategoryOption,
  AudioSessionMode,
  CONSTANTS,
} from 'react-native-callkeep';
import type { CallSessionPayload } from './types';

type NativeAction =
  | { type: 'answer'; callId: string }
  | { type: 'end'; callId: string }
  | { type: 'open' };

export interface CallNativeHandlers {
  onAnswerCall: (callId: string) => Promise<void> | void;
  onEndCall: (callId: string) => Promise<void> | void;
  onOpenCallUi: () => Promise<void> | void;
}

const READY_CHANNEL_ID = 'intercom-ready';
const CALL_CHANNEL_ID = 'intercom-live';
// Separate channel for incoming-call ring alert — needs sound+vibration.
// CALL_CHANNEL_ID was created without sound/vibration and Android channels
// are immutable after first creation, so a new ID is required.
const INCOMING_RING_CHANNEL_ID = 'incoming-call-ring';
const SERVICE_NOTIFICATION_ID = 'intercom-service';
const INCOMING_FALLBACK_NOTIFICATION_PREFIX = 'incoming-';
const ACTION_OPEN_CALL = 'open-call';
const ACTION_ANSWER_CALL = 'answer-call';
const ACTION_REJECT_CALL = 'reject-call';

const CALLKEEP_OPTIONS = {
  ios: {
    appName: 'Reserva de la Loma',
    includesCallsInRecents: false,
    maximumCallGroups: '1',
    maximumCallsPerCallGroup: '1',
    supportsVideo: false,
    audioSession: {
      categoryOptions:
        AudioSessionCategoryOption.allowBluetooth |
        AudioSessionCategoryOption.allowBluetoothA2DP |
        AudioSessionCategoryOption.defaultToSpeaker,
      mode: AudioSessionMode.voiceChat,
    },
  },
  android: {
    alertTitle: 'Llamadas del intercom',
    alertDescription:
      'Activa el servicio de llamadas y las notificaciones para recibir portería incluso cuando salgas de la app.',
    cancelButton: 'Cancelar',
    okButton: 'Abrir',
    imageName: 'ic_stat_intercom',
    additionalPermissions: [],
    foregroundService: {
      channelId: CALL_CHANNEL_ID,
      channelName: 'Llamadas activas',
      notificationTitle: 'Llamada del intercom en segundo plano',
      notificationIcon: 'ic_stat_intercom',
    },
  },
} as const;

class CallNativeManager {
  private initialized = false;
  private initializePromise: Promise<void> | null = null;
  private listenersBound = false;
  private foregroundServiceRegistered = false;
  private handlers: CallNativeHandlers | null = null;
  private pendingActions: NativeAction[] = [];
  private backgroundServiceResolver: (() => void) | null = null;
  private hasPromptedBatteryOptimization = false;
  private hasPromptedPhoneAccount = false;
  private actionExecution: Promise<void> = Promise.resolve();

  async initialize(handlers: CallNativeHandlers) {
    this.handlers = handlers;

    if (!this.initialized) {
      if (!this.initializePromise) {
        this.initializePromise = this.doInitialize();
      }
      await this.initializePromise;
    }

    await this.flushPendingActions();
  }

  private async doInitialize() {
    try {
      if (Platform.OS === 'android') {
        await this.setupAndroidCallKeep();
      } else {
        await RNCallKeep.setup(CALLKEEP_OPTIONS as any);
      }
      RNCallKeep.setReachable();
      await this.ensureChannels();
    } catch (error) {
      console.warn('callNative initialization parcialmente fallida', error);
    }
    this.registerForegroundService();
    this.bindListeners();
    await this.consumeInitialNativeEvents();
    this.initialized = true;
  }

  async ensureReadinessPermissions() {
    await this.ensureNotificationPermission();

    if (Platform.OS === 'android') {
      await this.requestAndroidRuntimePermissions();
      await this.maybePromptBatteryOptimization();
      await this.maybePromptPhoneAccount();
    }
  }

  async showIncomingCall(session: CallSessionPayload): Promise<boolean> {
    await this.ensureInitialized();

    if (Platform.OS === 'android') {
      try {
        const enabled = await RNCallKeep.checkPhoneAccountEnabled();
        if (!enabled) {
          await this.showIncomingFallbackNotification(session);
          return false;
        }
      } catch {}
    }

    try {
      RNCallKeep.displayIncomingCall(
        session.id,
        this.getHandle(session),
        this.getCallerName(session),
        'generic',
        false,
        {
          supportsHolding: false,
          supportsGrouping: false,
          supportsUngrouping: false,
          supportsDTMF: false,
        },
      );
      return true;
    } catch {
      if (Platform.OS === 'android') {
        await this.showIncomingFallbackNotification(session);
        return false;
      }
      throw new Error('No fue posible mostrar la llamada entrante');
    }
  }

  async showIncomingFallbackNotification(session: CallSessionPayload) {
    if (Platform.OS !== 'android') {
      return;
    }

    await this.ensureInitialized();
    await notifee.displayNotification({
      id: `${INCOMING_FALLBACK_NOTIFICATION_PREFIX}${session.id}`,
      title: 'Llamada entrante de portería',
      body: this.getCallerName(session),
      android: {
        channelId: INCOMING_RING_CHANNEL_ID,
        smallIcon: 'ic_stat_intercom',
        category: AndroidCategory.CALL,
        color: '#d4af37',
        colorized: true,
        ongoing: false,
        autoCancel: true,
        pressAction: { id: ACTION_OPEN_CALL, launchActivity: 'default' },
        fullScreenAction: { id: ACTION_OPEN_CALL, launchActivity: 'default' },
        actions: [
          {
            title: 'Rechazar',
            pressAction: { id: ACTION_REJECT_CALL, launchActivity: 'default' },
          },
          {
            title: 'Contestar',
            pressAction: { id: ACTION_ANSWER_CALL, launchActivity: 'default' },
          },
        ],
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
      },
    });
  }

  async startOutgoingCall(session: CallSessionPayload) {
    await this.ensureInitialized();

    // On Android, only attempt startCall if the phone account is enabled.
    // If not, TelecomManager.placeCall() fails silently and fires endCall ~1.25s
    // later — which our handler treats as a user cancellation.
    let useNativeCall = true;
    if (Platform.OS === 'android') {
      try {
        useNativeCall = await RNCallKeep.checkPhoneAccountEnabled();
      } catch {
        useNativeCall = false;
      }
    }

    if (useNativeCall) {
      RNCallKeep.startCall(
        session.id,
        this.getHandle(session),
        this.getCallerName(session),
        'generic',
        false,
      );
      // iOS CallKit expects this immediately after startCall to mark the call as
      // connecting; without it CallKit can fire endCall back after a short timeout.
      if (Platform.OS === 'ios') {
        try {
          RNCallKeep.reportConnectingOutgoingCallWithUUID(session.id);
        } catch {}
      }
    }

    await this.showReadyNotification('calling', session);
  }

  async answerIncomingCall(callId: string) {
    try {
      RNCallKeep.answerIncomingCall(callId);
    } catch {}
  }

  async markCallConnecting(session: CallSessionPayload, startedAt: number | null) {
    await this.ensureInitialized();

    if (Platform.OS === 'ios' && session.direction === 'inbound') {
      try {
        RNCallKeep.reportConnectingOutgoingCallWithUUID(session.id);
      } catch {}
    }

    await this.showCallNotification(session, startedAt ?? Date.now(), false);
  }

  async markCallActive(session: CallSessionPayload, startedAt: number | null) {
    await this.ensureInitialized();

    if (Platform.OS === 'android') {
      try {
        await RNCallKeep.setCurrentCallActive(session.id);
      } catch {}
    }

    if (Platform.OS === 'ios' && session.direction === 'inbound') {
      try {
        RNCallKeep.reportConnectedOutgoingCallWithUUID(session.id);
      } catch {}
    }

    await this.showCallNotification(session, startedAt ?? Date.now(), true);
  }

  async syncMuted(callId: string, muted: boolean) {
    if (!callId || Platform.OS !== 'ios') {
      return;
    }

    try {
      RNCallKeep.setMutedCall(callId, muted);
    } catch {}
  }

  async syncSpeaker(callId: string, speaker: boolean) {
    if (!callId || Platform.OS !== 'android') {
      return;
    }

    try {
      await RNCallKeep.toggleAudioRouteSpeaker(callId, speaker);
    } catch {}
  }

  async endCall(
    callId: string,
    reason: number = CONSTANTS.END_CALL_REASONS.REMOTE_ENDED,
  ) {
    if (!callId) {
      return;
    }

    try {
      RNCallKeep.reportEndCallWithUUID(callId, reason);
    } catch {
      try {
        RNCallKeep.endCall(callId);
      } catch {}
    }
  }

  async bringAppToFront() {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      await RNCallKeep.backToForeground();
    } catch {}
  }

  async showReadyNotification(
    kind: 'ready' | 'calling' | 'offline',
    session?: CallSessionPayload | null,
  ) {
    if (Platform.OS !== 'android') {
      return;
    }

    await this.ensureInitialized();

    const title =
      kind === 'calling'
        ? 'Portería conectando'
        : kind === 'offline'
          ? 'Intercom sin conexión'
          : 'Intercom activo';
    const body =
      kind === 'calling'
        ? `${this.getCallerName(session)} está respondiendo la llamada`
        : kind === 'offline'
          ? 'Mantén la app autorizada en segundo plano para no perder llamadas.'
          : 'Mantén esta notificación activa para recibir llamadas de portería en segundo plano.';

    await this.displayForegroundNotification({
      channelId: READY_CHANNEL_ID,
      title,
      body,
      category: AndroidCategory.SERVICE,
      colorized: false,
      ongoing: true,
      showChronometer: false,
      foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_DATA_SYNC],
    });
  }

  async showOfflineNotification() {
    await this.showReadyNotification('offline');
  }

  async showCallNotification(
    session: CallSessionPayload,
    startedAt: number,
    active: boolean,
  ) {
    if (Platform.OS !== 'android') {
      return;
    }

    await this.ensureInitialized();

    const title = active ? 'Llamada en curso' : 'Conectando llamada';
    const body =
      session.direction === 'inbound'
        ? `${this.getCallerName(session)} · Portería`
        : session.apartment
          ? `Apartamento ${session.apartment.number}${session.apartment.tower ? ` · ${session.apartment.tower.name}` : ''}`
          : this.getCallerName(session);

    await this.displayForegroundNotification({
      channelId: CALL_CHANNEL_ID,
      title,
      body,
      category: AndroidCategory.CALL,
      colorized: true,
      ongoing: true,
      showChronometer: true,
      timestamp: startedAt,
      foregroundServiceTypes: [
        AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
        AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
      ],
    });
  }

  async stopForegroundNotification() {
    if (Platform.OS !== 'android') {
      return;
    }

    try {
      await notifee.stopForegroundService();
    } catch {}

    if (this.backgroundServiceResolver) {
      this.backgroundServiceResolver();
      this.backgroundServiceResolver = null;
    }

    try {
      await notifee.cancelNotification(SERVICE_NOTIFICATION_ID);
    } catch {}
  }

  async teardownSystemState() {
    try {
      RNCallKeep.endAllCalls();
    } catch {}
    await this.stopForegroundNotification();
  }

  private async ensureInitialized() {
    if (this.initialized) {
      return;
    }
    if (this.initializePromise) {
      try {
        await this.initializePromise;
      } catch {
        this.initializePromise = this.doInitialize();
        await this.initializePromise;
      }
      return;
    }
    this.initializePromise = this.doInitialize();
    await this.initializePromise;
  }

  private async ensureChannels() {
    if (Platform.OS !== 'android') {
      return;
    }

    await notifee.createChannel({
      id: READY_CHANNEL_ID,
      name: 'Intercom en segundo plano',
      importance: AndroidImportance.LOW,
      vibration: false,
      lights: false,
      sound: undefined,
      badge: false,
    });

    await notifee.createChannel({
      id: CALL_CHANNEL_ID,
      name: 'Llamadas del intercom',
      importance: AndroidImportance.HIGH,
      vibration: false,
      lights: false,
      sound: undefined,
      badge: false,
    });

    // Ring channel for the incoming-call fallback notification.
    // Needs sound + vibration so the user actually hears the call.
    await notifee.createChannel({
      id: INCOMING_RING_CHANNEL_ID,
      name: 'Llamada entrante de portería',
      importance: AndroidImportance.HIGH,
      vibration: true,
      vibrationPattern: [400, 250, 400, 250],
      lights: true,
      sound: 'default',
      badge: false,
    });
  }

  private registerForegroundService() {
    if (Platform.OS !== 'android' || this.foregroundServiceRegistered) {
      return;
    }

    notifee.registerForegroundService(() => {
      return new Promise<void>((resolve) => {
        this.backgroundServiceResolver = resolve;
      });
    });

    this.foregroundServiceRegistered = true;
  }

  private bindListeners() {
    if (this.listenersBound) {
      return;
    }

    RNCallKeep.addEventListener('answerCall', ({ callUUID }) => {
      this.enqueueAction({ type: 'answer', callId: callUUID });
    });

    RNCallKeep.addEventListener('endCall', ({ callUUID }) => {
      this.enqueueAction({ type: 'end', callId: callUUID });
    });

    RNCallKeep.addEventListener('didLoadWithEvents', (events) => {
      events.forEach((event) => {
        this.handleDeferredCallKeepEvent(event);
      });
    });

    if (Platform.OS === 'android') {
      RNCallKeep.addEventListener('showIncomingCallUi', () => {
        this.enqueueAction({ type: 'open' });
      });
    }

    RNCallKeep.addEventListener('checkReachability', () => {
      RNCallKeep.setReachable();
    });

    notifee.onForegroundEvent((event) => {
      void this.handleNotifeeInteraction(event);
    });

    this.listenersBound = true;
  }

  async handleBackgroundNotificationEvent(event: NotifeeEvent) {
    await this.handleNotifeeInteraction(event);
  }

  private async dispatchAction(action: NativeAction) {
    if (!this.handlers) {
      this.pendingActions.push(action);
      return;
    }

    if (action.type === 'open') {
      await this.handlers.onOpenCallUi();
      return;
    }

    if (action.type === 'answer') {
      await this.handlers.onOpenCallUi();
      await this.handlers.onAnswerCall(action.callId);
      return;
    }

    await this.handlers.onEndCall(action.callId);
  }

  private enqueueAction(action: NativeAction) {
    this.actionExecution = this.actionExecution
      .then(async () => {
        await this.dispatchAction(action);
      })
      .catch(() => undefined);
  }

  private async flushPendingActions() {
    const actions = [...this.pendingActions];
    this.pendingActions = [];

    for (const action of actions) {
      await this.dispatchAction(action);
    }
  }

  private async ensureNotificationPermission() {
    const settings = await notifee.requestPermission();

    if (
      settings.authorizationStatus === AuthorizationStatus.DENIED &&
      AppState.currentState === 'active'
    ) {
      Alert.alert(
        'Permite notificaciones',
        'Sin notificaciones la app no podrá avisarte a tiempo cuando portería te llame.',
        [
          { text: 'Ahora no', style: 'cancel' },
          {
            text: 'Abrir ajustes',
            onPress: () => {
              void Linking.openSettings();
            },
          },
        ],
      );
    }
  }

  private async requestAndroidRuntimePermissions() {
    const androidVersion = Number(Platform.Version);
    const permissions = [
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      PermissionsAndroid.PERMISSIONS.CALL_PHONE,
    ] as Parameters<typeof PermissionsAndroid.requestMultiple>[0];

    if (androidVersion >= 30) {
      permissions.push('android.permission.READ_PHONE_NUMBERS' as any);
    } else {
      permissions.push(PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE);
    }

    if (androidVersion >= 33) {
      permissions.push('android.permission.POST_NOTIFICATIONS' as any);
    }

    if (androidVersion >= 31) {
      permissions.push('android.permission.BLUETOOTH_CONNECT' as any);
    }

    await PermissionsAndroid.requestMultiple(permissions);
  }

  private async maybePromptBatteryOptimization() {
    if (this.hasPromptedBatteryOptimization || AppState.currentState !== 'active') {
      return;
    }

    const enabled = await notifee.isBatteryOptimizationEnabled();
    if (!enabled) {
      return;
    }

    this.hasPromptedBatteryOptimization = true;
    Alert.alert(
      'Permite segundo plano',
      'Android está optimizando batería y puede cerrar la escucha de portería. Desactiva esa optimización para no perder llamadas.',
      [
        { text: 'Luego', style: 'cancel' },
        {
          text: 'Abrir ajustes',
          onPress: () => {
            void notifee.openBatteryOptimizationSettings();
          },
        },
      ],
    );
  }

  private async maybePromptPhoneAccount() {
    if (this.hasPromptedPhoneAccount || Platform.OS !== 'android' || AppState.currentState !== 'active') {
      return;
    }

    try {
      const enabled = await RNCallKeep.checkPhoneAccountEnabled();
      if (enabled) {
        return;
      }
    } catch {
      return;
    }

    this.hasPromptedPhoneAccount = true;
    try {
      RNCallKeep.registerPhoneAccount(CALLKEEP_OPTIONS as any);
    } catch {}
    Alert.alert(
      'Activa llamadas del sistema',
      'Para que la llamada entrante aparezca como una llamada real, acepta el servicio de llamadas del intercom cuando Android lo pida.',
      [{ text: 'Entendido' }],
    );
  }

  private async setupAndroidCallKeep() {
    try {
      await RNCallKeep.setup(CALLKEEP_OPTIONS as any);
      return;
    } catch (error) {
      if (!this.isMissingCurrentActivityError(error)) {
        throw error;
      }
    }

    RNCallKeep.setSettings(CALLKEEP_OPTIONS as any);
    RNCallKeep.registerPhoneAccount(CALLKEEP_OPTIONS as any);
    RNCallKeep.registerAndroidEvents();
  }

  private isMissingCurrentActivityError(error: unknown) {
    if (typeof error === 'string') {
      return error.toLowerCase().includes("activity doesn't exist");
    }

    if (error instanceof Error) {
      return error.message.toLowerCase().includes("activity doesn't exist");
    }

    if (error && typeof error === 'object' && 'code' in error) {
      return String((error as { code?: unknown }).code) === 'E_ACTIVITY_DOES_NOT_EXIST';
    }

    return false;
  }

  private async displayForegroundNotification(options: {
    channelId: string;
    title: string;
    body: string;
    category: AndroidCategory;
    colorized: boolean;
    ongoing: boolean;
    showChronometer: boolean;
    timestamp?: number;
    foregroundServiceTypes: AndroidForegroundServiceType[];
  }) {
    await notifee.displayNotification({
      id: SERVICE_NOTIFICATION_ID,
      title: options.title,
      body: options.body,
      android: {
        channelId: options.channelId,
        smallIcon: 'ic_stat_intercom',
        category: options.category,
        color: '#d4af37',
        colorized: options.colorized,
        asForegroundService: true,
        ongoing: options.ongoing,
        onlyAlertOnce: true,
        pressAction: { id: ACTION_OPEN_CALL },
        showChronometer: options.showChronometer,
        timestamp: options.timestamp,
        visibility: AndroidVisibility.PUBLIC,
        foregroundServiceTypes: options.foregroundServiceTypes,
      },
    });
  }

  private getCallerName(session?: CallSessionPayload | null) {
    if (!session) {
      return 'Portería';
    }

    if (session.direction === 'outbound') {
      if (session.initiatedByEmployee) {
        return `${session.initiatedByEmployee.name} ${session.initiatedByEmployee.lastName}`.trim();
      }
      return 'Portería';
    }

    if (session.acceptedByEmployee) {
      return `${session.acceptedByEmployee.name} ${session.acceptedByEmployee.lastName}`.trim();
    }

    return 'Portería';
  }

  private getHandle(session?: CallSessionPayload | null) {
    if (!session) {
      return 'Portería';
    }

    if (session.apartment) {
      return `Apartamento ${session.apartment.number}`;
    }

    return 'Portería';
  }

  private async handleNotifeeInteraction(event: NotifeeEvent) {
    if (event.type !== EventType.PRESS && event.type !== EventType.ACTION_PRESS) {
      return;
    }

    const actionId = event.detail.pressAction?.id ?? null;
    const notificationId = event.detail.notification?.id ?? null;
    const callId = this.extractCallIdFromNotification(notificationId);

    if (callId && actionId === ACTION_ANSWER_CALL) {
      this.enqueueAction({ type: 'answer', callId });
    } else if (callId && actionId === ACTION_REJECT_CALL) {
      this.enqueueAction({ type: 'end', callId });
    } else {
      this.enqueueAction({ type: 'open' });
    }

    if (notificationId) {
      try {
        await notifee.cancelNotification(notificationId);
      } catch {}
    }
  }

  private extractCallIdFromNotification(notificationId: string | null) {
    if (!notificationId || !notificationId.startsWith(INCOMING_FALLBACK_NOTIFICATION_PREFIX)) {
      return null;
    }

    const callId = notificationId.slice(INCOMING_FALLBACK_NOTIFICATION_PREFIX.length);
    return callId || null;
  }

  private handleDeferredCallKeepEvent(event: any) {
    if (!event?.name) {
      return;
    }

    const callUUID = typeof event.data?.callUUID === 'string' ? event.data.callUUID : null;
    if (event.name === 'RNCallKeepPerformAnswerCallAction' && callUUID) {
      this.enqueueAction({ type: 'answer', callId: callUUID });
      return;
    }
    if (event.name === 'RNCallKeepPerformEndCallAction' && callUUID) {
      this.enqueueAction({ type: 'end', callId: callUUID });
      return;
    }
    if (Platform.OS === 'android' && event.name === 'RNCallKeepShowIncomingCallUi') {
      this.enqueueAction({ type: 'open' });
    }
  }

  private async consumeInitialNativeEvents() {
    try {
      const events = await RNCallKeep.getInitialEvents();
      if (Array.isArray(events)) {
        events.forEach((event) => {
          this.handleDeferredCallKeepEvent(event);
        });
      }
      await RNCallKeep.clearInitialEvents();
    } catch {}
  }
}

export const callNative = new CallNativeManager();
export const CALL_END_REASONS = CONSTANTS.END_CALL_REASONS;
