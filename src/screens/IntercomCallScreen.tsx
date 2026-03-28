import React, { useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { callStore } from '../realtime/calls/callStore';
import { callService } from '../realtime/calls/callService';
import { noirTheme } from '../design/theme';

function phaseLabel(phase: ReturnType<typeof callStore.getState>['phase']) {
  switch (phase) {
    case 'requesting-media':
      return 'Solicitando micrófono';
    case 'incoming':
      return 'Llamada entrante';
    case 'ringing':
      return 'Llamando a portería';
    case 'connecting':
      return 'Conectando audio';
    case 'active':
      return 'Llamada activa';
    case 'ending':
      return 'Finalizando';
    case 'ended':
      return 'Sesion terminada';
    case 'error':
      return 'Error';
    default:
      return 'Intercom';
  }
}

export function IntercomCallScreen() {
  const state = useSyncExternalStore(callStore.subscribe, callStore.getState);
  const isPorterCall =
    state.session?.direction === 'inbound' || (!state.session && (state.phase === 'requesting-media' || state.phase === 'ringing'));
  const towerName = state.session?.apartment?.tower?.name ?? (isPorterCall ? 'Portería' : 'Residencia');
  const apartmentNumber = state.session?.apartment?.number ?? '—';
  const caller = isPorterCall
    ? state.session?.acceptedByEmployee
      ? `${state.session.acceptedByEmployee.name} ${state.session.acceptedByEmployee.lastName}`
      : 'Portería'
    : state.session?.initiatedByEmployee
      ? `${state.session.initiatedByEmployee.name} ${state.session.initiatedByEmployee.lastName}`
      : 'Portería';

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Text style={styles.eyebrow}>Intercom residencial</Text>
        <Text style={styles.title}>{towerName}</Text>
        <Text style={styles.subtitle}>
          {state.session?.apartment ? `Apartamento ${apartmentNumber}` : 'Canal de voz en tiempo real'}
        </Text>

        <View style={styles.avatar}>
          <MaterialIcons color={noirTheme.primary} name="support-agent" size={64} />
        </View>

        <Text style={styles.caller}>{caller}</Text>
        <Text style={styles.phase}>{phaseLabel(state.phase)}</Text>

        {state.error ? <Text style={styles.error}>{state.error}</Text> : null}

        {state.phase === 'incoming' ? (
          <View style={styles.row}>
            <Pressable onPress={() => callService.rejectCurrentCall()} style={[styles.actionButton, styles.rejectButton]}>
              <MaterialIcons color={noirTheme.primary} name="call-end" size={28} />
              <Text style={styles.actionText}>Rechazar</Text>
            </Pressable>

            <Pressable onPress={() => void callService.acceptCurrentCall()} style={[styles.actionButton, styles.acceptButton]}>
              <MaterialIcons color="#000000" name="call" size={28} />
              <Text style={[styles.actionText, styles.acceptText]}>Contestar</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.row}>
            <Pressable onPress={() => callService.toggleMute()} style={styles.secondaryButton}>
              <MaterialIcons
                color={noirTheme.primary}
                name={state.muted ? 'mic-off' : 'mic'}
                size={24}
              />
              <Text style={styles.secondaryText}>{state.muted ? 'Activar mic' : 'Silenciar'}</Text>
            </Pressable>

            <Pressable onPress={() => callService.toggleSpeaker()} style={styles.secondaryButton}>
              <MaterialIcons
                color={noirTheme.primary}
                name={state.speaker ? 'volume-up' : 'hearing-disabled'}
                size={24}
              />
              <Text style={styles.secondaryText}>{state.speaker ? 'Speaker' : 'Auricular'}</Text>
            </Pressable>
          </View>
        )}

        {state.phase !== 'incoming' ? (
          <Pressable onPress={() => callService.endCurrentCall()} style={styles.hangupWide}>
            <MaterialIcons color={noirTheme.primary} name="call-end" size={24} />
            <Text style={styles.actionText}>Colgar</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  panel: {
    backgroundColor: noirTheme.background,
    paddingHorizontal: 24,
    paddingVertical: 28,
    gap: 14,
  },
  eyebrow: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  title: {
    color: noirTheme.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    color: noirTheme.secondary,
    fontSize: 15,
    textAlign: 'center',
  },
  avatar: {
    alignSelf: 'center',
    width: 124,
    height: 124,
    borderRadius: 62,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceLow,
    marginTop: 8,
    marginBottom: 6,
  },
  caller: {
    color: noirTheme.primary,
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  phase: {
    color: noirTheme.secondary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  error: {
    color: '#fca5a5',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  rejectButton: {
    backgroundColor: '#7f1d1d',
  },
  acceptButton: {
    backgroundColor: noirTheme.primary,
  },
  actionText: {
    color: noirTheme.primary,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
  acceptText: {
    color: '#000000',
  },
  secondaryButton: {
    flex: 1,
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: noirTheme.surfaceLow,
  },
  secondaryText: {
    color: noirTheme.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  hangupWide: {
    marginTop: 4,
    minHeight: 64,
    backgroundColor: '#991b1b',
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
});
