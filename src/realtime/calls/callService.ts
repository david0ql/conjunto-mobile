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

  private async handleIncoming(session: CallSessionPayload) {
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
  }

  private async handleSignal(callId: string, signal: CallSignalEnvelope) {
    const current = callStore.getState();
    if (!current.session || current.session.id !== callId) {
      return;
    }

    const peer = await this.ensurePeer(callId);
    if (signal.type === 'offer' && signal.sdp) {
      await peer.setRemoteDescription(
        new RTCSessionDescription({
          type: 'offer',
          sdp: signal.sdp,
        }),
      );

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

    if (signal.type === 'ice-candidate' && signal.candidate) {
      await peer.addIceCandidate(
        new RTCIceCandidate({
          candidate: signal.candidate.candidate,
          sdpMid: signal.candidate.sdpMid ?? null,
          sdpMLineIndex: signal.candidate.sdpMLineIndex ?? null,
        }),
      );
    }
  }

  private async ensurePeer(callId: string) {
    if (this.peer) {
      return this.peer;
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
    return peer;
  }

  private async handleTerminal(session: CallSessionPayload) {
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

    this.localStream?.getTracks().forEach((track) => track.stop());
    this.localStream = null;
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
