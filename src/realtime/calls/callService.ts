import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event as NotifeeEvent } from '@notifee/react-native';
import messaging, { type FirebaseMessagingTypes } from '@react-native-firebase/messaging';
import { AppState, PermissionsAndroid, Platform, type AppStateStatus } from 'react-native';
import InCallManager from 'react-native-incall-manager';
import VoipPushNotification from 'react-native-voip-push-notification';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from 'react-native-webrtc';
import { io, type Socket } from 'socket.io-client';
import { authStore } from '../../context/auth.store';
import {
  getCallPorters,
  getCallsIceConfig,
  REALTIME_URL,
  createCallTrace,
  registerCallDevice,
  unregisterCallDevice,
  type PorterAvailability,
} from '../../services/api';
import { callNative, CALL_END_REASONS } from './callNative';
import { callStore } from './callStore';
import type {
  CallSessionPayload,
  CallSignalEnvelope,
  IceConfigResponse,
  RealtimeIceServer,
} from './types';

type PendingCallRecord = {
  session: CallSessionPayload;
  source: 'socket' | 'fcm' | 'voip';
  persistedAt: number;
};

type ParsedCallPush = {
  event: 'incoming' | 'accepted' | 'ended' | 'missed' | 'rejected';
  callId: string | null;
  session: CallSessionPayload | null;
};

const PENDING_CALL_KEY = 'intercom_pending_call';
const DEVICE_ID_KEY = 'intercom_device_id';
const PENDING_CALL_TTL_MS = 90_000;

class CallService {
  private socket: Socket | null = null;
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private iceServers: RealtimeIceServer[] | null = null;
  private activeToken: string | null = null;
  private peerCallId: string | null = null;
  private pendingRemoteCandidates: NonNullable<CallSignalEnvelope['candidate']>[] = [];
  private porters: PorterAvailability[] = [];
  private porterListeners = new Set<(porters: PorterAvailability[]) => void>();
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: { remove: () => void } | null = null;
  private bootstrapped = false;
  private permissionsRequested = false;
  private micWarmupPromise: Promise<boolean> | null = null;
  private authBootstrapPromise: Promise<void> | null = null;
  private restorePendingCallPromise: Promise<void> | null = null;
  private deviceIdPromise: Promise<string> | null = null;
  private messageUnsubscribe: (() => void) | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private voipListenersBound = false;
  private deferredAnswerCallId: string | null = null;
  private deferredEndCallId: string | null = null;
  private registeredFcmToken: string | null = null;
  private registeredVoipToken: string | null = null;
  private waitingOfferCallId: string | null = null;
  private waitingOfferRetryTimer: ReturnType<typeof setTimeout> | null = null;
  private recentSystemAnswerByCallId = new Map<string, number>();
  private localMediaSetupPromise: Promise<boolean> | null = null;
  private localMediaSetupCallId: string | null = null;

  bootstrap() {
    if (this.bootstrapped) {
      return;
    }

    this.bootstrapped = true;
    void callNative
      .initialize({
        onAnswerCall: async (callId) => {
          await this.handleSystemAnswer(callId);
        },
        onEndCall: async (callId) => {
          await this.handleSystemEnd(callId);
        },
        onOpenCallUi: async () => {
          await this.handleOpenCallUi();
        },
      })
      .catch((error) => {
        console.warn('No fue posible inicializar CallKeep/Notifee', error);
      });

    this.bindPushListeners();
    void this.restorePendingIncomingCall();

    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      this.appState = nextState;
      if (nextState === 'active') {
        void this.updateIdleNotification().catch(() => undefined);
        void this.consumeDeferredSystemActions();
        const current = callStore.getState();
        if (
          current.session?.id &&
          ['connecting', 'active'].includes(current.phase) &&
          !this.localStream
        ) {
          void this.ensureLocalMediaReady(current.session.id).catch(() => undefined);
        }
      }
    });

    this.authBootstrapPromise = authStore
      .init()
      .then(() => {
        const token = authStore.getToken();
        if (token) {
          this.start(token);
        }
      })
      .catch((error) => {
        console.warn('No fue posible restaurar la sesión para llamadas', error);
      });
  }

  start(token: string) {
    this.bootstrap();

    if (this.socket && this.activeToken === token) {
      void this.registerPushTokens().catch(() => undefined);
      void this.ensureBackgroundReadiness().catch(() => undefined);
      void this.consumeDeferredSystemActions();
      return;
    }

    this.disconnectRealtime();
    this.activeToken = token;
    this.socket = io(REALTIME_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      void this.updateIdleNotification();
      void this.registerPushTokens().catch((error) => {
        console.warn('No fue posible registrar los tokens de llamadas', error);
      });
      void this.consumeDeferredSystemActions();
    });

    this.socket.on('disconnect', () => {
      void this.updateIdleNotification();
    });

    this.socket.on('calls:outgoing', (session: CallSessionPayload) => {
      void this.handleOutgoing(session);
    });

    this.socket.on('calls:incoming', (session: CallSessionPayload) => {
      void this.handleIncoming(session, 'socket');
    });

    this.socket.on('calls:accepted', (session: CallSessionPayload) => {
      void this.handleAccepted(session);
    });

    this.socket.on('calls:signal', (event: { callId: string; signal: CallSignalEnvelope }) => {
      void this.handleSignal(event.callId, event.signal);
    });

    this.socket.on('calls:request-offer', (event: { callId?: string }) => {
      void this.handleOfferRetryRequest(event.callId ?? null);
    });

    this.socket.on('calls:ended', (session: CallSessionPayload) => {
      void this.handleTerminal(session);
    });

    this.socket.on('calls:missed', (session: CallSessionPayload) => {
      void this.handleTerminal(session);
    });

    this.socket.on('calls:rejected', (session: CallSessionPayload) => {
      void this.handleTerminal(session);
    });

    this.socket.on('calls:porters-updated', (porters: PorterAvailability[]) => {
      this.setPorters(porters);
    });

    this.socket.on('calls:error', () => {
      const current = callStore.getState();
      if (current.session?.id) {
        this.traceCall(current.session.id, 'mobile.socket.error', 'Socket de llamadas reportó un error', 'error');
      }
      callStore.reset();
    });

    // NestJS emits 'exception' when a @SubscribeMessage handler throws WsException.
    // The most common case: calls:accept for a call that already ended on the server
    // (porter hung up manually while the mobile was starting from killed state).
    this.socket.on('exception', (data: unknown) => {
      const current = callStore.getState();
      if (current.phase !== 'connecting' && current.phase !== 'incoming') {
        return;
      }
      const callId = current.session?.id;
      const msg =
        data && typeof data === 'object' && 'message' in data
          ? String((data as { message?: unknown }).message)
          : 'Server exception';
      this.traceCall(callId ?? 'unknown', 'mobile.socket.exception', msg, 'error');
      this.teardownRtc();
      this.stopAudioModes();
      if (callId) {
        void this.clearPendingIncomingCall(callId);
        void callNative.endCall(callId, CALL_END_REASONS.FAILED).catch(() => undefined);
      }
      callStore.reset();
    });

    void this.refreshPorters().catch(() => undefined);
    void this.registerPushTokens().catch(() => undefined);
    void this.ensureBackgroundReadiness().catch((error) => {
      console.warn('No fue posible preparar el modo segundo plano', error);
    });
  }

  stop() {
    void this.unregisterPushTokens().catch(() => undefined);
    this.disconnectRealtime();
    this.activeToken = null;
    this.teardownRtc();
    this.stopAudioModes();
    this.deferredAnswerCallId = null;
    this.deferredEndCallId = null;
    callStore.reset();
    this.setPorters([]);
    void this.clearPendingIncomingCall();
    void callNative.teardownSystemState();
  }

  getCurrentPorters() {
    return this.porters;
  }

  subscribePorters(listener: (porters: PorterAvailability[]) => void) {
    this.porterListeners.add(listener);
    return () => {
      this.porterListeners.delete(listener);
    };
  }

  async refreshPorters() {
    try {
      const porters = await getCallPorters();
      this.setPorters(porters);
      return porters;
    } catch (error) {
      this.setPorters([]);
      throw error;
    }
  }

  async callPorter(employeeId: string) {
    const current = callStore.getState();
    if (current.phase !== 'idle') {
      throw new Error('Ya existe una llamada en curso');
    }

    await this.ensureRealtimeReady();
    if (!this.socket || this.socket.disconnected) {
      throw new Error('El canal en tiempo real no está conectado');
    }

    const hasPermission = await this.ensureMicrophonePermission();
    if (!hasPermission) {
      throw new Error('Debes habilitar el micrófono para llamar a portería');
    }

    callStore.setState({
      session: null,
      phase: 'requesting-media',
      muted: false,
      speaker: true,
      error: null,
      startedAt: null,
    });

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      // NOTE: InCallManager.start() is intentionally NOT called here.
      // On iOS, calling it before RNCallKeep.startCall() conflicts with
      // CallKit's AVAudioSession ownership and causes CallKit to fire endCall
      // ~1.25s later. InCallManager is started in handleAccepted() once
      // CallKit has already taken the audio session.

      this.socket.emit('calls:call-porter', { employeeId });
    } catch (error) {
      this.stopAudioModes();
      this.teardownRtc();
      callStore.reset();
      throw error;
    }
  }

  async acceptCurrentCall(fromSystem = false) {
    await this.restorePendingIncomingCall();
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    if (fromSystem) {
      this.traceCall(current.session.id, 'mobile.system.answer_processing', 'Procesando respuesta desde UI nativa');
    }

    try {
      if (!fromSystem) {
        await callNative.answerIncomingCall(current.session.id);
      }

      await this.ensureRealtimeReady();
      callStore.patch({
        phase: 'connecting',
        muted: false,
        speaker: true,
        error: null,
      });
      this.traceCall(current.session.id, 'mobile.accept.sent', 'Llamada aceptada en móvil, esperando oferta WebRTC');
      this.socket?.emit('calls:accept', {
        callId: current.session.id,
      });
      this.scheduleOfferRetryRequest(current.session.id);

      const mediaReady = await this.ensureLocalMediaReady(current.session.id);
      if (!mediaReady) {
        this.traceCall(
          current.session.id,
          'mobile.media.pending',
          'Llamada aceptada, pero el audio local aún no está listo',
          'warn',
        );
      }
    } catch (error) {
      this.traceCall(
        current.session.id,
        'mobile.accept.failed',
        error instanceof Error ? error.message : 'Error al contestar llamada',
        'error',
      );
      await callNative.endCall(current.session.id, CALL_END_REASONS.FAILED);
      callStore.reset();
    }
  }

  rejectCurrentCall() {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    this.recentSystemAnswerByCallId.delete(current.session.id);

    InCallManager.stopRingtone();
    callStore.patch({ phase: 'ending' });
    this.teardownRtc();
    this.stopAudioModes();
    void this.clearPendingIncomingCall(current.session.id);
    void callNative.endCall(current.session.id, CALL_END_REASONS.UNANSWERED);
    void this.ensureRealtimeReady()
      .then(() => {
        this.socket?.emit('calls:reject', {
          callId: current.session?.id,
        });
      })
      .catch(() => undefined);
  }

  endCurrentCall(reason?: string) {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    this.recentSystemAnswerByCallId.delete(current.session.id);

    callStore.patch({ phase: 'ending' });
    this.teardownRtc();
    this.stopAudioModes();
    void this.clearPendingIncomingCall(current.session.id);
    void callNative.endCall(current.session.id, CALL_END_REASONS.REMOTE_ENDED);
    void this.ensureRealtimeReady()
      .then(() => {
        this.socket?.emit('calls:end', {
          callId: current.session?.id,
          reason,
        });
      })
      .catch(() => undefined);
  }

  async handleFirebaseRemoteMessage(remoteMessage: FirebaseMessagingTypes.RemoteMessage | null | undefined) {
    const parsed = this.parseCallPush(remoteMessage?.data ?? null);
    if (!parsed) {
      return;
    }

    await this.applyPushEvent(parsed, 'fcm');
  }

  async handleNotifeeBackgroundEvent(event: NotifeeEvent) {
    this.bootstrap();
    await callNative.handleBackgroundNotificationEvent(event);
  }

  private async handleOutgoing(session: CallSessionPayload) {
    if (session.direction !== 'inbound') {
      return;
    }

    await callNative.startOutgoingCall(session);
    callStore.patch({
      session,
      phase: 'ringing',
      muted: false,
      speaker: true,
      error: null,
      startedAt: null,
    });
  }

  private async handleIncoming(
    session: CallSessionPayload,
    source: PendingCallRecord['source'],
    presentSystemCall = true,
  ) {
    if (session.direction !== 'outbound') {
      return;
    }

    const current = callStore.getState();
    if (
      current.session?.id === session.id &&
      ['incoming', 'connecting', 'active', 'ringing'].includes(current.phase)
    ) {
      return;
    }

    await this.persistPendingIncomingCall(session, source);
    callStore.setState({
      session,
      phase: 'incoming',
      muted: false,
      speaker: true,
      error: null,
      startedAt: null,
    });
    this.traceCall(
      session.id,
      'mobile.incoming.received',
      `Push/evento entrante recibido por ${source}`,
      'info',
      { source, presentSystemCall },
    );

    if (Platform.OS === 'android' && this.appState === 'active') {
      InCallManager.startRingtone('_DEFAULT_', [0, 800, 250], 'default', -1);
    }

    if (presentSystemCall) {
      try {
        const displayed = await callNative.showIncomingCall(session);
        if (displayed) {
          this.traceCall(session.id, 'mobile.incoming.system_presented', 'Llamada entrante presentada en sistema');
        } else {
          this.traceCall(
            session.id,
            'mobile.incoming.system_failed',
            'No se pudo mostrar llamada nativa; se mostró notificación fallback',
            'warn',
          );
        }
      } catch (error) {
        this.traceCall(
          session.id,
          'mobile.incoming.system_failed',
          error instanceof Error ? error.message : 'Fallo al presentar llamada nativa',
          'error',
        );
      }
    }

    await this.consumeDeferredSystemActions();
  }

  private async handleAccepted(session: CallSessionPayload) {
    const currentUser = authStore.getUser();
    const startedAt = this.getSessionStartedAt(session);

    if (session.direction === 'outbound') {
      if (currentUser?.id && session.acceptedByResidentId && session.acceptedByResidentId !== currentUser.id) {
        await this.handleTerminal({
          ...session,
          status: 'ended',
          endedReason: 'answered_elsewhere',
        });
        return;
      }

      callStore.patch({
        session,
        phase: session.acceptedByResidentId ? 'connecting' : 'incoming',
        error: null,
        startedAt,
      });
      await callNative.markCallConnecting(session, startedAt);
      this.traceCall(session.id, 'mobile.accept.confirmed', 'Evento accepted recibido para llamada outbound');
      return;
    }

    if (currentUser?.id && session.initiatedByResidentId && session.initiatedByResidentId !== currentUser.id) {
      return;
    }

    callStore.patch({
      session,
      phase: 'connecting',
      error: null,
      startedAt,
    });
    await callNative.markCallConnecting(session, startedAt);
    // Start audio routing now — CallKit already owns the audio session at this
    // point (reportConnectingOutgoingCallWithUUID was called in markCallConnecting),
    // so InCallManager won't conflict with it.
    InCallManager.start({ media: 'audio', auto: true });
    InCallManager.setKeepScreenOn(true);
    InCallManager.setForceSpeakerphoneOn(true);
    await this.startOfferForCall(session);
  }

  private async startOfferForCall(session: CallSessionPayload) {
    if (!this.localStream) {
      this.traceCall(session.id, 'mobile.offer.missing_stream', 'No hay stream local para crear oferta', 'error');
      return;
    }

    const peer = await this.ensurePeer(session.id);
    if (
      peer.localDescription?.type === 'offer' &&
      (peer as any).signalingState === 'have-local-offer'
    ) {
      await this.ensureRealtimeReady();
      this.socket?.emit('calls:signal', {
        callId: session.id,
        signal: {
          type: 'offer',
          sdp: peer.localDescription.sdp ?? undefined,
        },
      });
      this.traceCall(session.id, 'mobile.offer.resent', 'Reenvío de oferta local pendiente');
      return;
    }

    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
    });
    await peer.setLocalDescription(offer);

    await this.ensureRealtimeReady();
    this.socket?.emit('calls:signal', {
      callId: session.id,
      signal: {
        type: 'offer',
        sdp: offer.sdp,
      },
    });
    this.traceCall(session.id, 'mobile.offer.sent', 'Oferta enviada');
  }

  private async handleSignal(callId: string, signal: CallSignalEnvelope) {
    const current = callStore.getState();
    if (
      !current.session ||
      current.session.id !== callId ||
      current.phase === 'ending' ||
      current.phase === 'ended' ||
      current.phase === 'error'
    ) {
      return;
    }

    if (signal.type === 'offer' && signal.sdp) {
      this.clearOfferRetryRequest(callId);
      const mediaReady = await this.ensureLocalMediaReady(callId);
      if (!mediaReady) {
        this.traceCall(
          callId,
          'mobile.answer.no_local_media',
          'Se responderá oferta sin audio local listo todavía',
          'warn',
        );
      }
      this.traceCall(callId, 'mobile.answer.sending', 'Oferta recibida, enviando respuesta');
      const peer = await this.ensurePeer(callId);
      await peer.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: signal.sdp,
        }),
      );
      await this.flushPendingRemoteCandidates(peer);

      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await this.ensureRealtimeReady();
      this.socket?.emit('calls:signal', {
        callId,
        signal: {
          type: 'answer',
          sdp: answer.sdp,
        },
      });
      this.traceCall(callId, 'mobile.answer.sent', 'Respuesta enviada al originador');
      return;
    }

    if (signal.type === 'answer' && signal.sdp) {
      if (!this.peer || this.peerCallId !== callId) {
        return;
      }

      await this.peer.setRemoteDescription(
        new RTCSessionDescription({
          type: 'answer',
          sdp: signal.sdp,
        }),
      );
      await this.flushPendingRemoteCandidates(this.peer);
      const startedAt = current.startedAt ?? Date.now();
      callStore.patch({ phase: 'active', error: null, startedAt });
      await callNative.markCallActive(current.session, startedAt);
      this.clearOfferRetryRequest(callId);
      this.traceCall(callId, 'mobile.call.active', 'Respuesta remota recibida, llamada activa');
      return;
    }

    if (signal.type === 'ice-candidate' && signal.candidate) {
      if (!this.peer || this.peerCallId !== callId) {
        this.pendingRemoteCandidates.push(signal.candidate);
        return;
      }

      await this.addRemoteIceCandidate(this.peer, signal.candidate);
    }
  }

  private async ensurePeer(callId: string) {
    if (this.peer && this.peerCallId === callId) {
      return this.peer;
    }

    if (this.peer && this.peerCallId !== callId) {
      this.teardownRtc();
    }

    const peer = new RTCPeerConnection({
      iceServers: await this.ensureIceServers(),
    } as any);

    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        if (!this.localStream) return;
        peer.addTrack(track, this.localStream);
      });
    }

    (peer as any).onicecandidate = (event: any) => {
      if (!event.candidate) {
        return;
      }

      this.socket?.emit('calls:signal', {
        callId,
        signal: {
          type: 'ice-candidate',
          candidate: {
            candidate: event.candidate.candidate,
            sdpMid: event.candidate.sdpMid,
            sdpMLineIndex: event.candidate.sdpMLineIndex,
          },
        },
      });
    };

    (peer as any).onconnectionstatechange = () => {
      if (peer.connectionState === 'connected') {
        const current = callStore.getState();
        const startedAt = current.startedAt ?? Date.now();
        callStore.patch({ phase: 'active', error: null, startedAt });
        if (current.session) {
          void callNative.markCallActive(current.session, startedAt);
        }
      }

      if (peer.connectionState === 'failed') {
        callStore.patch({
          phase: 'error',
          error: 'La conexión de audio falló',
        });
        if (this.peerCallId) {
          void callNative.endCall(this.peerCallId, CALL_END_REASONS.FAILED);
        }
      }
    };

    this.peer = peer;
    this.peerCallId = callId;
    return peer;
  }

  private async handleTerminal(session: CallSessionPayload) {
    const current = callStore.getState();
    const currentSessionId = current.session?.id ?? null;
    const persisted = await this.getPersistedPendingIncomingCall();

    if (currentSessionId && currentSessionId !== session.id) {
      return;
    }

    if (!currentSessionId && persisted?.session.id !== session.id) {
      return;
    }

    InCallManager.stopRingtone();
    this.stopAudioModes();
    this.teardownRtc();
    await this.clearPendingIncomingCall(session.id);
    this.recentSystemAnswerByCallId.delete(session.id);

    const reason =
      session.endedReason === 'answered_elsewhere'
        ? 'La llamada fue atendida desde otro dispositivo'
        : session.status === 'missed'
          ? 'La llamada se perdió'
          : session.status === 'rejected'
            ? 'La llamada fue rechazada'
            : 'Llamada finalizada';

    this.traceCall(
      session.id,
      'mobile.call.terminal',
      reason,
      session.status === 'rejected' || session.status === 'missed' ? 'warn' : 'info',
      { endedReason: session.endedReason ?? null, status: session.status },
    );

    await callNative.endCall(session.id, this.mapEndReason(session));
    await this.updateIdleNotification();

    if (!currentSessionId) {
      return;
    }

    callStore.reset();
  }

  private async applyPushEvent(
    parsed: ParsedCallPush,
    source: 'fcm' | 'voip',
  ) {
    if (parsed.event === 'incoming') {
      if (!parsed.session) {
        return;
      }
      if (source === 'fcm' && Platform.OS === 'ios') {
        return;
      }
      await this.handleIncoming(parsed.session, source, source !== 'voip');
      return;
    }

    if (!parsed.callId || !parsed.session) {
      return;
    }

    const current = callStore.getState();
    const persisted = await this.getPersistedPendingIncomingCall();
    const matchesCurrent = current.session?.id === parsed.callId;
    const matchesPersisted = persisted?.session.id === parsed.callId;

    if (parsed.event === 'accepted') {
      if (matchesCurrent) {
        await this.handleAccepted(parsed.session);
        return;
      }

      if (matchesPersisted) {
        await this.clearPendingIncomingCall(parsed.callId);
        await callNative.endCall(parsed.callId, CALL_END_REASONS.ANSWERED_ELSEWHERE);
        await this.updateIdleNotification();
      }
      return;
    }

    if (matchesCurrent || matchesPersisted) {
      await this.handleTerminal(parsed.session);
    }
  }

  private async ensureIceServers() {
    if (this.iceServers) {
      return this.iceServers;
    }

    const response = (await getCallsIceConfig()) as IceConfigResponse;
    this.iceServers = response.iceServers;
    return response.iceServers;
  }

  private async ensureMicrophonePermission(isWarmup = false) {
    if (Platform.OS === 'android') {
      const alreadyGranted = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      if (alreadyGranted) {
        return true;
      }

      if (AppState.currentState !== 'active') {
        return false;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: 'Micrófono para intercom',
          message: 'Se necesita acceso al micrófono para contestar llamadas de portería.',
          buttonPositive: 'Permitir',
          buttonNegative: 'Cancelar',
        },
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    }

    if (!isWarmup) {
      return true;
    }

    if (this.micWarmupPromise) {
      return this.micWarmupPromise;
    }

    this.micWarmupPromise = mediaDevices
      .getUserMedia({ audio: true, video: false })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.micWarmupPromise = null;
      });

    return this.micWarmupPromise;
  }

  private stopAudioModes() {
    InCallManager.stop();
    InCallManager.setKeepScreenOn(false);
    InCallManager.setForceSpeakerphoneOn(false);
  }

  private teardownRtc() {
    this.peer?.close();
    this.peer = null;
    this.peerCallId = null;
    this.pendingRemoteCandidates = [];
    this.clearOfferRetryRequest();
    this.localMediaSetupCallId = null;
    this.localMediaSetupPromise = null;

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
  }

  private disconnectRealtime() {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
  }

  private async ensureLocalMediaReady(callId: string) {
    if (this.localStream) {
      return true;
    }

    if (this.localMediaSetupPromise && this.localMediaSetupCallId === callId) {
      return this.localMediaSetupPromise;
    }

    this.localMediaSetupCallId = callId;
    this.localMediaSetupPromise = (async () => {
      const hasPermission = await this.withTimeout(
        this.ensureMicrophonePermission(),
        4_500,
        false,
      );
      if (!hasPermission) {
        this.traceCall(
          callId,
          'mobile.permissions.microphone_unavailable',
          'Micrófono no disponible en este momento (requiere app activa o permiso)',
          'warn',
        );
        return false;
      }

      try {
        InCallManager.stopRingtone();
        const stream = await this.withTimeout(
          mediaDevices
            .getUserMedia({ audio: true, video: false })
            .then((value) => value as MediaStream | null),
          8_000,
          null,
        );
        if (!stream) {
          throw new Error('Timeout solicitando micrófono');
        }
        this.localStream = stream;
        InCallManager.start({ media: 'audio', auto: true });
        InCallManager.setKeepScreenOn(true);
        InCallManager.setForceSpeakerphoneOn(true);
        this.attachLocalStreamToCurrentPeer(callId);
        this.traceCall(callId, 'mobile.media.ready', 'Micrófono local listo para la llamada');
        return true;
      } catch (error) {
        this.traceCall(
          callId,
          'mobile.media.failed',
          error instanceof Error ? error.message : 'Error preparando micrófono local',
          'error',
        );
        return false;
      }
    })().finally(() => {
      if (this.localMediaSetupCallId === callId) {
        this.localMediaSetupCallId = null;
        this.localMediaSetupPromise = null;
      }
    });

    return this.localMediaSetupPromise;
  }

  private attachLocalStreamToCurrentPeer(callId: string) {
    if (!this.peer || this.peerCallId !== callId || !this.localStream) {
      return;
    }

    const existingTrackIds = new Set(
      this.peer
        .getSenders()
        .map((sender) => sender.track?.id ?? null)
        .filter((id): id is string => Boolean(id)),
    );

    this.localStream.getTracks().forEach((track) => {
      if (!this.localStream || existingTrackIds.has(track.id)) {
        return;
      }
      this.peer?.addTrack(track, this.localStream);
    });
  }

  private scheduleOfferRetryRequest(callId: string) {
    this.clearOfferRetryRequest();
    this.waitingOfferCallId = callId;
    this.waitingOfferRetryTimer = setTimeout(() => {
      void this.requestOfferRetry(callId);
    }, 4_500);
  }

  private clearOfferRetryRequest(callId?: string) {
    if (callId && this.waitingOfferCallId && this.waitingOfferCallId !== callId) {
      return;
    }

    if (this.waitingOfferRetryTimer) {
      clearTimeout(this.waitingOfferRetryTimer);
      this.waitingOfferRetryTimer = null;
    }
    this.waitingOfferCallId = null;
  }

  private async requestOfferRetry(callId: string) {
    const current = callStore.getState();
    if (!current.session || current.session.id !== callId || current.phase !== 'connecting') {
      return;
    }
    if (this.peer && this.peerCallId === callId && this.peer.remoteDescription) {
      return;
    }

    try {
      await this.ensureRealtimeReady();
      this.traceCall(callId, 'mobile.offer.retry_requested', 'Sin oferta inicial, solicitando reenvío de señal', 'warn');
      this.socket?.emit('calls:request-offer', { callId });
    } catch (error) {
      this.traceCall(
        callId,
        'mobile.offer.retry_failed',
        'No fue posible solicitar reenvío de oferta',
        'error',
        error instanceof Error ? { error: error.message } : null,
      );
    }
  }

  private async handleOfferRetryRequest(callId: string | null) {
    if (!callId) {
      return;
    }

    const current = callStore.getState();
    if (!current.session || current.session.id !== callId) {
      return;
    }

    const user = authStore.getUser();
    const shouldStartOffer =
      current.session.direction === 'inbound' ||
      (current.session.direction === 'internal' && user?.id === current.session.initiatedByEmployeeId);
    if (!shouldStartOffer) {
      return;
    }

    this.traceCall(callId, 'mobile.offer.retry_received', 'El remoto solicitó reintento de oferta');
    await this.startOfferForCall(current.session);
  }

  private traceCall(
    callId: string,
    stage: string,
    message: string,
    level: 'info' | 'warn' | 'error' = 'info',
    metadata: Record<string, unknown> | null = null,
  ) {
    void createCallTrace({
      callId,
      source: 'mobile',
      stage,
      message,
      level,
      metadata,
    }).catch(() => undefined);

    if (__DEV__) {
      console.info(`[CallTrace:${callId}] ${stage} - ${message}`, metadata ?? undefined);
    }
  }

  private async addRemoteIceCandidate(
    peer: RTCPeerConnection,
    candidate: NonNullable<CallSignalEnvelope['candidate']>,
  ) {
    if ((peer as any).signalingState === 'closed' || (peer as any).connectionState === 'closed') {
      return;
    }

    if (!peer.remoteDescription) {
      this.pendingRemoteCandidates.push(candidate);
      return;
    }

    try {
      await peer.addIceCandidate(
        new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMid: candidate.sdpMid ?? null,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
        }),
      );
    } catch (error) {
      const current = callStore.getState();
      if (current.phase === 'ending' || current.phase === 'ended' || current.phase === 'error') {
        return;
      }
      console.warn('Ignoring stale ICE candidate', error);
    }
  }

  private async flushPendingRemoteCandidates(peer: RTCPeerConnection) {
    if (!peer.remoteDescription || this.pendingRemoteCandidates.length === 0) {
      return;
    }

    const candidates = [...this.pendingRemoteCandidates];
    this.pendingRemoteCandidates = [];
    for (const candidate of candidates) {
      await this.addRemoteIceCandidate(peer, candidate);
    }
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race<T>([
        promise,
        new Promise<T>((resolve) => {
          timeout = setTimeout(() => resolve(fallback), timeoutMs);
        }),
      ]);
    } finally {
      if (timeout) {
        clearTimeout(timeout);
      }
    }
  }

  private setPorters(porters: PorterAvailability[]) {
    this.porters = porters;
    this.porterListeners.forEach((listener) => listener(porters));
  }

  private bindPushListeners() {
    if (!this.messageUnsubscribe) {
      this.messageUnsubscribe = messaging().onMessage((remoteMessage) => {
        void this.handleFirebaseRemoteMessage(remoteMessage);
      });
    }

    if (!this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe = messaging().onTokenRefresh((token) => {
        this.registeredFcmToken = token;
        void this.registerCallPushToken({
          token,
          channel: 'fcm',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
        }).catch(() => undefined);
      });
    }

    if (Platform.OS !== 'ios' || this.voipListenersBound) {
      return;
    }

    VoipPushNotification.addEventListener('register', (token: string) => {
      this.registeredVoipToken = token;
      void this.registerCallPushToken({
        token,
        channel: 'voip',
        platform: 'ios',
        environment: __DEV__ ? 'development' : 'production',
      }).catch(() => undefined);
    });

    VoipPushNotification.addEventListener('notification', (notification: object) => {
      void this.handleVoipNotification(notification as Record<string, unknown>);
    });

    VoipPushNotification.addEventListener('didLoadWithEvents', (events: Array<{ name: string; data: any }>) => {
      void this.handleVoipDidLoadEvents(events);
    });

    VoipPushNotification.registerVoipToken();
    this.voipListenersBound = true;
  }

  private async ensureBackgroundReadiness() {
    if (!this.permissionsRequested) {
      this.permissionsRequested = true;
      await callNative.ensureReadinessPermissions();
    }

    await this.updateIdleNotification();
  }

  private async updateIdleNotification() {
    const current = callStore.getState();
    if (!this.activeToken || current.phase === 'incoming' || current.phase === 'connecting' || current.phase === 'active' || current.phase === 'ringing') {
      return;
    }

    if (this.socket?.connected) {
      await callNative.showReadyNotification('ready');
    } else {
      await callNative.showOfflineNotification();
    }
  }

  private async handleSystemAnswer(callId: string) {
    this.traceCall(callId, 'mobile.system.answer_event', 'Evento nativo answer recibido');
    this.recentSystemAnswerByCallId.set(callId, Date.now());
    await this.restorePendingIncomingCall();
    const current = callStore.getState();
    if (current.session?.id !== callId) {
      this.deferredAnswerCallId = callId;
      this.traceCall(
        callId,
        'mobile.system.answer_deferred',
        'Respuesta nativa recibida antes de restaurar sesión local',
        'warn',
      );
      await this.ensureRealtimeReady().catch(() => undefined);
      return;
    }

    this.deferredAnswerCallId = null;
    await this.acceptCurrentCall(true);
  }

  private async handleSystemEnd(callId: string) {
    this.traceCall(callId, 'mobile.system.end_event', 'Evento nativo end recibido');
    await this.restorePendingIncomingCall();
    const current = callStore.getState();
    if (current.session?.id !== callId) {
      this.deferredEndCallId = callId;
      return;
    }

    const answerAt = this.recentSystemAnswerByCallId.get(callId) ?? 0;
    if (current.phase === 'incoming' && answerAt > 0 && Date.now() - answerAt <= 3_500) {
      this.traceCall(
        callId,
        'mobile.system.end_ignored_after_answer',
        'Se ignoró end inmediato tras answer para evitar rechazo espurio',
        'warn',
      );
      return;
    }

    this.deferredEndCallId = null;
    if (current.phase === 'incoming') {
      this.rejectCurrentCall();
      return;
    }

    this.endCurrentCall();
  }

  private async consumeDeferredSystemActions() {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    if (this.deferredEndCallId === current.session.id) {
      this.deferredEndCallId = null;
      await this.handleSystemEnd(current.session.id);
      return;
    }

    if (this.deferredAnswerCallId === current.session.id) {
      this.deferredAnswerCallId = null;
      await this.acceptCurrentCall(true);
    }
  }

  private async handleOpenCallUi() {
    await callNative.bringAppToFront();
  }

  private getSessionStartedAt(session: CallSessionPayload) {
    return session.acceptedAt ? new Date(session.acceptedAt).getTime() : null;
  }

  private mapEndReason(session: CallSessionPayload) {
    if (session.endedReason === 'answered_elsewhere') {
      return CALL_END_REASONS.ANSWERED_ELSEWHERE;
    }
    if (session.status === 'missed') {
      return CALL_END_REASONS.MISSED;
    }
    if (session.status === 'rejected') {
      return CALL_END_REASONS.UNANSWERED;
    }
    return CALL_END_REASONS.REMOTE_ENDED;
  }

  private async ensureRealtimeReady() {
    if (!this.activeToken) {
      if (this.authBootstrapPromise) {
        await this.authBootstrapPromise;
      } else {
        await authStore.init();
      }
      const token = authStore.getToken();
      if (token) {
        this.start(token);
      }
    }

    if (!this.socket && this.activeToken) {
      this.start(this.activeToken);
    }

    const socket = this.socket;
    if (!socket) {
      throw new Error('No hay una sesión autenticada para responder la llamada');
    }

    if (socket.connected) {
      return;
    }

    socket.connect();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('El canal en tiempo real tardó demasiado en reconectar'));
      }, 12_000);

      const onConnect = () => {
        cleanup();
        resolve();
      };

      const onError = (error: unknown) => {
        cleanup();
        reject(error instanceof Error ? error : new Error('No fue posible reconectar el socket'));
      };

      const cleanup = () => {
        clearTimeout(timeout);
        socket.off('connect', onConnect);
        socket.off('connect_error', onError as any);
      };

      socket.on('connect', onConnect);
      socket.on('connect_error', onError as any);
    });
  }

  private async unregisterPushTokens() {
    if (!this.activeToken) {
      return;
    }

    const deviceId = await this.getDeviceId().catch(() => null);
    const unregisterJobs: Array<Promise<unknown>> = [];

    if (this.registeredFcmToken) {
      unregisterJobs.push(
        unregisterCallDevice({
          token: this.registeredFcmToken,
          channel: 'fcm',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceId,
        }),
      );
    }

    if (Platform.OS === 'ios' && this.registeredVoipToken) {
      unregisterJobs.push(
        unregisterCallDevice({
          token: this.registeredVoipToken,
          channel: 'voip',
          platform: 'ios',
          deviceId,
        }),
      );
    }

    if (unregisterJobs.length === 0 && deviceId) {
      unregisterJobs.push(unregisterCallDevice({ deviceId }));
    }

    if (unregisterJobs.length === 0) {
      return;
    }

    await Promise.allSettled(unregisterJobs);
  }

  private async registerPushTokens() {
    if (!this.activeToken) {
      return;
    }

    const deviceId = await this.getDeviceId();

    try {
      if (Platform.OS === 'ios') {
        await messaging().registerDeviceForRemoteMessages();
      }
    } catch {}

    try {
      const token = await messaging().getToken();
      if (token) {
        this.registeredFcmToken = token;
        await this.registerCallPushToken({
          token,
          channel: 'fcm',
          platform: Platform.OS === 'ios' ? 'ios' : 'android',
          deviceId,
        });
      }
    } catch (error) {
      console.warn('No fue posible obtener el token FCM', error);
    }

    if (Platform.OS === 'ios') {
      if (this.registeredVoipToken) {
        await this.registerCallPushToken({
          token: this.registeredVoipToken,
          channel: 'voip',
          platform: 'ios',
          environment: __DEV__ ? 'development' : 'production',
          deviceId,
        });
      } else {
        try {
          VoipPushNotification.registerVoipToken();
        } catch {}
      }
    }
  }

  private async registerCallPushToken(input: {
    token: string;
    platform: 'android' | 'ios';
    channel: 'fcm' | 'voip';
    environment?: 'development' | 'production' | null;
    deviceId?: string | null;
  }) {
    if (!this.activeToken || !input.token) {
      return;
    }

    const deviceId = input.deviceId ?? (await this.getDeviceId());
    await registerCallDevice({
      token: input.token,
      platform: input.platform,
      channel: input.channel,
      environment: input.environment ?? null,
      deviceId,
      appVersion: null,
    });
  }

  private async handleVoipToken(token: string) {
    if (!token) {
      return;
    }

    this.registeredVoipToken = token;
    await this.registerCallPushToken({
      token,
      channel: 'voip',
      platform: 'ios',
      environment: __DEV__ ? 'development' : 'production',
    });
  }

  private async handleVoipDidLoadEvents(events: Array<{ name: string; data: any }> | null | undefined) {
    if (!Array.isArray(events)) {
      return;
    }

    for (const event of events) {
      if (event?.name === 'RNVoipPushRemoteNotificationsRegisteredEvent' && typeof event.data === 'string') {
        await this.handleVoipToken(event.data);
      }

      if (event?.name === 'RNVoipPushRemoteNotificationReceivedEvent' && event.data) {
        await this.handleVoipNotification(event.data);
      }
    }
  }

  private async handleVoipNotification(notification: Record<string, unknown>) {
    const parsed = this.parseCallPush(notification);
    if (!parsed) {
      return;
    }

    await this.applyPushEvent(parsed, 'voip');
  }

  private parseCallPush(data: Record<string, unknown> | null): ParsedCallPush | null {
    if (!data) {
      return null;
    }

    const kind = this.getStringField(data, 'kind');
    const event = this.getStringField(data, 'event');
    if (kind !== 'call' || !event || !['incoming', 'accepted', 'ended', 'missed', 'rejected'].includes(event)) {
      return null;
    }

    const sessionValue = data.session;
    let session: CallSessionPayload | null = null;
    if (typeof sessionValue === 'string') {
      try {
        session = JSON.parse(sessionValue) as CallSessionPayload;
      } catch {
        session = null;
      }
    } else if (sessionValue && typeof sessionValue === 'object') {
      session = sessionValue as CallSessionPayload;
    }

    const callId = this.getStringField(data, 'callId') ?? session?.id ?? null;
    return {
      event: event as ParsedCallPush['event'],
      callId,
      session,
    };
  }

  private getStringField(data: Record<string, unknown>, key: string) {
    const value = data[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private async restorePendingIncomingCall() {
    if (this.restorePendingCallPromise) {
      return this.restorePendingCallPromise;
    }

    this.restorePendingCallPromise = (async () => {
      const current = callStore.getState();
      if (current.session) {
        return;
      }

      const pending = await this.getPersistedPendingIncomingCall();
      if (!pending) {
        return;
      }

      callStore.setState({
        session: pending.session,
        phase: 'incoming',
        muted: false,
        speaker: true,
        error: null,
        startedAt: null,
      });
    })().finally(() => {
      this.restorePendingCallPromise = null;
    });

    return this.restorePendingCallPromise;
  }

  private async persistPendingIncomingCall(session: CallSessionPayload, source: PendingCallRecord['source']) {
    const record: PendingCallRecord = {
      session,
      source,
      persistedAt: Date.now(),
    };
    await AsyncStorage.setItem(PENDING_CALL_KEY, JSON.stringify(record));
  }

  private async getPersistedPendingIncomingCall(): Promise<PendingCallRecord | null> {
    try {
      const raw = await AsyncStorage.getItem(PENDING_CALL_KEY);
      if (!raw) {
        return null;
      }

      const parsed = JSON.parse(raw) as PendingCallRecord;
      if (!parsed?.session?.id || typeof parsed.persistedAt !== 'number') {
        await AsyncStorage.removeItem(PENDING_CALL_KEY);
        return null;
      }

      if (Date.now() - parsed.persistedAt > PENDING_CALL_TTL_MS) {
        await AsyncStorage.removeItem(PENDING_CALL_KEY);
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  private async clearPendingIncomingCall(callId?: string) {
    const pending = await this.getPersistedPendingIncomingCall();
    if (!callId || pending?.session.id === callId) {
      await AsyncStorage.removeItem(PENDING_CALL_KEY);
    }
  }

  private async getDeviceId() {
    if (this.deviceIdPromise) {
      return this.deviceIdPromise;
    }

    this.deviceIdPromise = (async () => {
      const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
      if (existing) {
        return existing;
      }

      const next = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      await AsyncStorage.setItem(DEVICE_ID_KEY, next);
      return next;
    })();

    return this.deviceIdPromise;
  }
}

export const callService = new CallService();
