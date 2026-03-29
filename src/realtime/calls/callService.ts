import { AppState, PermissionsAndroid, Platform, type AppStateStatus } from 'react-native';
import { Navigation } from 'react-native-navigation';
import InCallManager from 'react-native-incall-manager';
import {
  mediaDevices,
  RTCIceCandidate,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStream,
} from 'react-native-webrtc';
import { io, type Socket } from 'socket.io-client';
import { authStore } from '../../context/auth.store';
import { COMPONENTS } from '../../navigation/componentNames';
import { getCallPorters, getCallsIceConfig, REALTIME_URL, type PorterAvailability } from '../../services/api';
import { callNative, CALL_END_REASONS } from './callNative';
import { callStore } from './callStore';
import type {
  CallSessionPayload,
  CallSignalEnvelope,
  IceConfigResponse,
  RealtimeIceServer,
} from './types';

class CallService {
  private socket: Socket | null = null;
  private modalId: string | null = null;
  private peer: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private iceServers: RealtimeIceServer[] | null = null;
  private activeToken: string | null = null;
  private teardownTimer: ReturnType<typeof setTimeout> | null = null;
  private peerCallId: string | null = null;
  private pendingRemoteCandidates: NonNullable<CallSignalEnvelope['candidate']>[] = [];
  private porters: PorterAvailability[] = [];
  private porterListeners = new Set<(porters: PorterAvailability[]) => void>();
  private appState: AppStateStatus = AppState.currentState;
  private appStateSubscription: { remove: () => void } | null = null;
  private bootstrapped = false;
  private micWarmupPromise: Promise<boolean> | null = null;

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

    this.appStateSubscription = AppState.addEventListener('change', (nextState) => {
      this.appState = nextState;
      if (nextState === 'active') {
        void this.ensureBackgroundReadiness().catch(() => undefined);
        void this.ensureModalIfNeeded();
      }
    });
  }

  start(token: string) {
    this.bootstrap();

    if (this.socket && this.activeToken === token) {
      void this.ensureBackgroundReadiness().catch(() => undefined);
      return;
    }

    this.stop();
    this.activeToken = token;
    this.socket = io(REALTIME_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
    });

    this.socket.on('connect', () => {
      void callNative.showReadyNotification('ready');
    });
    this.socket.on('disconnect', () => {
      if (this.activeToken) {
        void callNative.showOfflineNotification();
      }
    });
    this.socket.on('calls:outgoing', (session: CallSessionPayload) => {
      void this.handleOutgoing(session);
    });
    this.socket.on('calls:incoming', (session: CallSessionPayload) => {
      void this.handleIncoming(session);
    });
    this.socket.on('calls:accepted', (session: CallSessionPayload) => {
      void this.handleAccepted(session);
    });
    this.socket.on('calls:signal', (event: { callId: string; signal: CallSignalEnvelope }) => {
      void this.handleSignal(event.callId, event.signal);
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
    this.socket.on('calls:error', (event: { message?: string }) => {
      callStore.patch({
        phase: 'error',
        error: event.message ?? 'No fue posible operar la llamada',
        startedAt: null,
      });
      void this.ensureModalIfNeeded();
    });

    void this.refreshPorters().catch(() => undefined);
    void this.ensureBackgroundReadiness().catch((error) => {
      console.warn('No fue posible preparar el modo segundo plano', error);
    });
  }

  stop() {
    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
      this.teardownTimer = null;
    }

    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.activeToken = null;

    this.teardownRtc();
    this.stopAudioModes();
    callStore.reset();
    this.setPorters([]);
    void callNative.teardownSystemState();
    void this.dismissModal();
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
    if (!this.socket || this.socket.disconnected) {
      throw new Error('El canal en tiempo real no está conectado');
    }

    const current = callStore.getState();
    if (current.phase !== 'idle') {
      throw new Error('Ya existe una llamada en curso');
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
    await this.ensureModalIfNeeded();

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      InCallManager.start({ media: 'audio', auto: true });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(true);

      this.socket.emit('calls:call-porter', { employeeId });
    } catch (error) {
      this.stopAudioModes();
      this.teardownRtc();
      callStore.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : 'No fue posible iniciar la llamada',
        startedAt: null,
      });
      throw error;
    }
  }

  async acceptCurrentCall(fromSystem = false) {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    const hasPermission = await this.ensureMicrophonePermission();
    if (!hasPermission) {
      callStore.patch({
        phase: 'error',
        error: 'Debes habilitar el micrófono para contestar la llamada',
        startedAt: null,
      });
      await callNative.endCall(current.session.id, CALL_END_REASONS.UNANSWERED);
      await this.ensureModalIfNeeded();
      return;
    }

    try {
      if (!fromSystem) {
        await callNative.answerIncomingCall(current.session.id);
      }
      InCallManager.stopRingtone();
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      InCallManager.start({ media: 'audio', auto: true });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(true);

      callStore.patch({
        phase: 'connecting',
        muted: false,
        speaker: true,
        error: null,
      });
      this.socket?.emit('calls:accept', {
        callId: current.session.id,
      });
      await this.ensureModalIfNeeded(true);
    } catch (error) {
      callStore.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : 'No fue posible abrir el audio',
        startedAt: null,
      });
    }
  }

  rejectCurrentCall() {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    InCallManager.stopRingtone();
    callStore.patch({ phase: 'ending' });
    this.teardownRtc();
    this.stopAudioModes();
    void callNative.endCall(current.session.id, CALL_END_REASONS.UNANSWERED);
    this.socket?.emit('calls:reject', {
      callId: current.session.id,
    });
  }

  endCurrentCall(reason?: string) {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    callStore.patch({ phase: 'ending' });
    this.teardownRtc();
    this.stopAudioModes();
    void callNative.endCall(current.session.id, CALL_END_REASONS.REMOTE_ENDED);
    this.socket?.emit('calls:end', {
      callId: current.session.id,
      reason,
    });
  }

  toggleMute() {
    const current = callStore.getState();
    const nextMuted = !current.muted;
    this.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    if (current.session) {
      void callNative.syncMuted(current.session.id, nextMuted);
    }
    callStore.patch({ muted: nextMuted });
  }

  toggleSpeaker() {
    const current = callStore.getState();
    const nextSpeaker = !current.speaker;
    InCallManager.setForceSpeakerphoneOn(nextSpeaker);
    if (current.session) {
      void callNative.syncSpeaker(current.session.id, nextSpeaker);
    }
    callStore.patch({ speaker: nextSpeaker });
  }

  private async handleOutgoing(session: CallSessionPayload) {
    if (session.direction !== 'inbound') {
      return;
    }

    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
      this.teardownTimer = null;
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
    await this.ensureModalIfNeeded();
  }

  private async handleIncoming(session: CallSessionPayload) {
    if (session.direction !== 'outbound') {
      return;
    }

    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
      this.teardownTimer = null;
    }

    callStore.setState({
      session,
      phase: 'incoming',
      muted: false,
      speaker: true,
      error: null,
      startedAt: null,
    });
    InCallManager.startRingtone('_DEFAULT_', [0, 800, 250], 'default', -1);
    await callNative.showIncomingCall(session);
    await this.ensureModalIfNeeded();
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
      await this.ensureModalIfNeeded();
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
    await this.ensureModalIfNeeded();
    await this.startOfferForCall(session);
  }

  private async startOfferForCall(session: CallSessionPayload) {
    if (!this.localStream) {
      return;
    }

    const peer = await this.ensurePeer(session.id);
    const offer = await peer.createOffer({
      offerToReceiveAudio: true,
    });
    await peer.setLocalDescription(offer);

    this.socket?.emit('calls:signal', {
      callId: session.id,
      signal: {
        type: 'offer',
        sdp: offer.sdp,
      },
    });
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
      this.socket?.emit('calls:signal', {
        callId,
        signal: {
          type: 'answer',
          sdp: answer.sdp,
        },
      });
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
    if (current.session?.id && current.session.id !== session.id) {
      return;
    }

    InCallManager.stopRingtone();
    this.stopAudioModes();
    this.teardownRtc();

    const reason =
      session.endedReason === 'answered_elsewhere'
        ? 'La llamada fue atendida desde otro dispositivo'
        : session.status === 'missed'
          ? 'La llamada se perdió'
          : session.status === 'rejected'
            ? 'La llamada fue rechazada'
            : 'Llamada finalizada';

    await callNative.endCall(session.id, this.mapEndReason(session));
    if (this.activeToken) {
      if (this.socket?.connected) {
        void callNative.showReadyNotification('ready');
      } else {
        void callNative.showOfflineNotification();
      }
    }

    callStore.patch({
      session,
      phase: 'ended',
      error: reason,
      startedAt: null,
    });
    await this.ensureModalIfNeeded();

    if (this.teardownTimer) {
      clearTimeout(this.teardownTimer);
    }
    this.teardownTimer = setTimeout(() => {
      callStore.reset();
      void this.dismissModal();
      this.teardownTimer = null;
    }, 900);
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

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
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

  private setPorters(porters: PorterAvailability[]) {
    this.porters = porters;
    this.porterListeners.forEach((listener) => listener(porters));
  }

  private async ensureBackgroundReadiness() {
    await callNative.ensureReadinessPermissions();
    if (this.appState === 'active') {
      await this.ensureMicrophonePermission(true);
    }

    if (this.socket?.connected) {
      await callNative.showReadyNotification('ready');
    } else {
      await callNative.showOfflineNotification();
    }
  }

  private async handleSystemAnswer(callId: string) {
    const current = callStore.getState();
    if (current.session?.id !== callId) {
      return;
    }

    await this.acceptCurrentCall(true);
  }

  private async handleSystemEnd(callId: string) {
    const current = callStore.getState();
    if (current.session?.id !== callId) {
      return;
    }

    if (current.phase === 'incoming') {
      this.rejectCurrentCall();
      return;
    }

    this.endCurrentCall();
  }

  private async handleOpenCallUi() {
    await callNative.bringAppToFront();
    await this.ensureModalIfNeeded(true);
  }

  private async ensureModalIfNeeded(forceForeground = false) {
    const current = callStore.getState();
    if (current.phase === 'idle') {
      return;
    }

    if (forceForeground) {
      await callNative.bringAppToFront();
    }

    if (this.appState !== 'active') {
      return;
    }

    await this.ensureModal();
  }

  private async ensureModal() {
    if (this.modalId) {
      return this.modalId;
    }

    this.modalId = await Navigation.showModal({
      stack: {
        children: [
          {
            component: {
              name: COMPONENTS.intercomCall,
            },
          },
        ],
      },
    } as any);

    return this.modalId;
  }

  private async dismissModal() {
    if (!this.modalId) {
      return;
    }

    try {
      await Navigation.dismissModal(this.modalId);
    } catch {}
    this.modalId = null;
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
}

export const callService = new CallService();
