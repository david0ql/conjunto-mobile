import { PermissionsAndroid, Platform } from 'react-native';
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
import { getCallsIceConfig, REALTIME_URL } from '../../services/api';
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

  start(token: string) {
    if (this.socket && this.activeToken === token) {
      return;
    }

    this.stop();
    this.activeToken = token;
    this.socket = io(REALTIME_URL, {
      auth: { token },
      autoConnect: true,
      transports: ['websocket', 'polling'],
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
    this.socket.on('calls:error', (event: { message?: string }) => {
      callStore.patch({
        phase: 'error',
        error: event.message ?? 'No fue posible operar la llamada',
      });
      void this.ensureModal();
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
    void this.dismissModal();
  }

  async callPorter() {
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
    });
    await this.ensureModal();

    try {
      this.localStream = await mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      InCallManager.start({ media: 'audio', auto: true });
      InCallManager.setKeepScreenOn(true);
      InCallManager.setForceSpeakerphoneOn(true);

      this.socket.emit('calls:call-porter');
    } catch (error) {
      this.stopAudioModes();
      this.teardownRtc();
      callStore.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : 'No fue posible iniciar la llamada',
      });
      throw error;
    }
  }

  async acceptCurrentCall() {
    const current = callStore.getState();
    if (!current.session) {
      return;
    }

    const hasPermission = await this.ensureMicrophonePermission();
    if (!hasPermission) {
      callStore.patch({
        phase: 'error',
        error: 'Debes habilitar el microfono para contestar la llamada',
      });
      await this.ensureModal();
      return;
    }

    try {
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
      await this.ensureModal();
    } catch (error) {
      callStore.patch({
        phase: 'error',
        error: error instanceof Error ? error.message : 'No fue posible abrir el audio',
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
    callStore.patch({ muted: nextMuted });
  }

  toggleSpeaker() {
    const current = callStore.getState();
    const nextSpeaker = !current.speaker;
    InCallManager.setForceSpeakerphoneOn(nextSpeaker);
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

    callStore.patch({
      session,
      phase: 'ringing',
      muted: false,
      speaker: true,
      error: null,
    });
    await this.ensureModal();
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
    });
    InCallManager.startRingtone('_DEFAULT_', [0, 800, 250], 'default', -1);
    await this.ensureModal();
  }

  private async handleAccepted(session: CallSessionPayload) {
    const currentUser = authStore.getUser();
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
      });
      await this.ensureModal();
      return;
    }

    if (currentUser?.id && session.initiatedByResidentId && session.initiatedByResidentId !== currentUser.id) {
      return;
    }

    callStore.patch({
      session,
      phase: 'connecting',
      error: null,
    });
    await this.ensureModal();
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
      callStore.patch({ phase: 'active', error: null });
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
        callStore.patch({ phase: 'active', error: null });
      }

      if (peer.connectionState === 'failed') {
        callStore.patch({
          phase: 'error',
          error: 'La conexion de audio fallo',
        });
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
          ? 'La llamada se perdio'
          : session.status === 'rejected'
            ? 'La llamada fue rechazada'
            : 'Llamada finalizada';

    callStore.patch({
      session,
      phase: 'ended',
      error: reason,
    });
    await this.ensureModal();

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

  private async ensureMicrophonePermission() {
    if (Platform.OS !== 'android') {
      return true;
    }

    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: 'Microfono para intercom',
        message: 'Se necesita acceso al microfono para contestar llamadas de porteria.',
        buttonPositive: 'Permitir',
        buttonNegative: 'Cancelar',
      },
    );

    return result === PermissionsAndroid.RESULTS.GRANTED;
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
}

export const callService = new CallService();
