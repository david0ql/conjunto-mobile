import React, { useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  useSyncExternalStore,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Navigation } from 'react-native-navigation';
import { noirTheme } from '../design/theme';
import { callService } from '../realtime/calls/callService';
import { callStore } from '../realtime/calls/callStore';

export function CallOverlayScreen() {
  const call = useSyncExternalStore(callStore.subscribe, callStore.getState);
  const session = call.session;
  const phase = call.phase;

  const handleDismiss = useCallback(() => {
    try { Navigation.dismissOverlay('CallOverlay').catch(() => {}); } catch {}
  }, []);

  const handleAnswer = useCallback(() => {
    callService.acceptCurrentCall().catch(() => {});
  }, []);

  const handleReject = useCallback(() => {
    callService.rejectCurrentCall();
    handleDismiss();
  }, [handleDismiss]);

  const handleEnd = useCallback(() => {
    callService.endCurrentCall();
    handleDismiss();
  }, [handleDismiss]);

  const handleToggleMute = useCallback(() => {
    callService.toggleMute();
  }, []);

  const handleToggleSpeaker = useCallback(() => {
    callService.toggleSpeaker();
  }, []);

  const isActive = phase === 'connecting' || phase === 'active';
  const isIncoming = phase === 'incoming' || phase === 'ringing';

  useEffect(() => {
    if (phase === 'idle' || phase === 'ended' || phase === 'error') {
      try { Navigation.dismissOverlay('CallOverlay').catch(() => {}); } catch {}
    }
  }, [phase]);

  if (!session || phase === 'idle' || phase === 'ended' || phase === 'error') {
    return null;
  }

  const callerName =
    session.initiatedByResident
      ? `${session.initiatedByResident.name} ${session.initiatedByResident.lastName}`
      : session.initiatedByEmployee
        ? `${session.initiatedByEmployee.name} ${session.initiatedByEmployee.lastName}`
        : 'Portería';

  const aptLabel = session.apartment
    ? `${session.apartment.tower?.name ?? ''} ${session.apartment.number}`.trim()
    : session.direction === 'internal'
      ? 'Línea interna'
      : '';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isIncoming && (
          <View style={styles.callTypeBadge}>
            <MaterialIcons name="phone-in-talk" size={14} color="#000" />
            <Text style={styles.callTypeText}>LLAMADA ENTRANTE</Text>
          </View>
        )}

        <Text style={styles.callerName}>{callerName}</Text>
        {aptLabel ? <Text style={styles.aptLabel}>{aptLabel}</Text> : null}

        {isIncoming ? (
          <Text style={styles.statusText}>Llamada entrante...</Text>
        ) : isActive ? (
          <Text style={styles.statusText}>Llamada activa</Text>
        ) : phase === 'connecting' ? (
          <View style={styles.connectingRow}>
            <ActivityIndicator size="small" color={noirTheme.primary} />
            <Text style={styles.statusText}>Conectando...</Text>
          </View>
        ) : phase === 'requesting-media' ? (
          <Text style={styles.statusText}>Preparando audio...</Text>
        ) : phase === 'ending' ? (
          <Text style={styles.statusText}>Finalizando...</Text>
        ) : null}

        <View style={styles.actions}>
          {isIncoming ? (
            <View style={styles.incomingActions}>
              <TouchableOpacity style={styles.rejectBtn} onPress={handleReject}>
                <MaterialIcons name="call-end" size={28} color="#fff" />
                <Text style={styles.actionLabel}>Rechazar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.answerBtn} onPress={handleAnswer}>
                <MaterialIcons name="call" size={28} color="#000" />
                <Text style={styles.actionLabelDark}>Contestar</Text>
              </TouchableOpacity>
            </View>
          ) : isActive ? (
            <View style={styles.activeActions}>
              <View style={styles.activeActionsRow}>
                <TouchableOpacity
                  style={[styles.activeBtn, call.muted && styles.activeBtnOn]}
                  onPress={handleToggleMute}>
                  <MaterialIcons
                    name={call.muted ? 'mic-off' : 'mic'}
                    size={24}
                    color={call.muted ? '#000' : noirTheme.primary}
                  />
                  <Text style={[styles.actionLabelSmall, call.muted && styles.actionLabelSmallOn]}>
                    {call.muted ? 'Silenciado' : 'Micrófono'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.activeBtn, call.speaker && styles.activeBtnOn]}
                  onPress={handleToggleSpeaker}>
                  <MaterialIcons
                    name={call.speaker ? 'volume-up' : 'hearing'}
                    size={24}
                    color={call.speaker ? '#000' : noirTheme.primary}
                  />
                  <Text style={[styles.actionLabelSmall, call.speaker && styles.actionLabelSmallOn]}>
                    Altavoz
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
                <MaterialIcons name="call-end" size={28} color="#fff" />
                <Text style={styles.actionLabel}>Colgar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.endBtn} onPress={handleEnd}>
              <MaterialIcons name="call-end" size={28} color="#fff" />
              <Text style={styles.actionLabel}>Cancelar</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  callTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: noirTheme.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  callTypeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  callerName: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  aptLabel: {
    color: noirTheme.secondary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: -16,
  },
  statusText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  connectingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actions: {
    marginTop: 16,
    alignItems: 'center',
    gap: 24,
  },
  incomingActions: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'center',
  },
  rejectBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  answerBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#16a34a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionLabelDark: {
    color: '#000',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeActions: {
    gap: 32,
    alignItems: 'center',
  },
  activeActionsRow: {
    flexDirection: 'row',
    gap: 32,
  },
  activeBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: noirTheme.outline,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  activeBtnOn: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  actionLabelSmall: {
    color: noirTheme.secondary,
    fontSize: 8,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  actionLabelSmallOn: {
    color: '#000',
  },
});
