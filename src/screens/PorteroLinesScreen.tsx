import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NavigationComponentProps } from 'react-native-navigation';
import { authStore } from '../context/auth.store';
import { noirTheme } from '../design/theme';
import { callService } from '../realtime/calls/callService';
import { callStore } from '../realtime/calls/callStore';
import type { PorterAvailability } from '../services/api';

export function PorteroLinesScreen({ componentId: _componentId }: NavigationComponentProps) {
  const user = authStore.getUser();
  const callState = useSyncExternalStore(callStore.subscribe, callStore.getState);
  const [porters, setPorters] = useState<PorterAvailability[]>([]);
  const [loading, setLoading] = useState(true);

  const peers = porters.filter((p) => p.id !== user?.id);
  const availablePeers = peers.filter((p) => p.available).length;
  const hasActiveCall = callState.phase !== 'idle';

  useEffect(() => {
    const unsubscribe = callService.subscribePorters((next) => {
      setPorters(next);
      setLoading(false);
    });
    callService.refreshPorters().catch(() => setLoading(false));
    return unsubscribe;
  }, []);

  async function handleCall(porter: PorterAvailability) {
    try {
      await callService.startEmployeeCall(porter.id);
    } catch (error) {
      Alert.alert(
        'No fue posible llamar',
        error instanceof Error ? error.message : 'Intenta nuevamente.',
      );
    }
  }

  const renderPorter = useCallback(
    ({ item }: { item: PorterAvailability }) => {
      const disabled = hasActiveCall || !item.available;
      return (
        <View style={styles.porterCard}>
          <View style={styles.porterInfo}>
            <View style={styles.porterNameRow}>
              <Text style={styles.porterName}>
                {item.name} {item.lastName}
              </Text>
              <Text style={styles.porterUsername}>@{item.username}</Text>
            </View>
            <View style={styles.porterStatusRow}>
              <View
                style={[
                  styles.statusDot,
                  item.available ? styles.statusDotAvailable : styles.statusDotBusy,
                ]}
              />
              <Text style={styles.porterStatus}>
                {item.available ? 'Disponible' : 'Ocupado'}
              </Text>
            </View>
            {item.currentCall && (
              <View style={styles.currentCallInfo}>
                <Text style={styles.currentCallText}>
                  {item.currentCall.withType === 'resident'
                    ? `Con ${item.currentCall.withLabel}`
                    : item.currentCall.withType === 'employee'
                      ? `Con ${item.currentCall.withLabel}`
                      : item.currentCall.withLabel}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={[styles.callBtn, disabled && styles.callBtnDisabled]}
            disabled={disabled}
            onPress={() => handleCall(item)}>
            <MaterialIcons
              name="phone"
              size={20}
              color={disabled ? noirTheme.secondary : '#000'}
            />
          </TouchableOpacity>
        </View>
      );
    },
    [hasActiveCall],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarBrand}>PORTERÍA</Text>
          <Text style={styles.topBarTitle}>Líneas Internas</Text>
        </View>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={[styles.statValue, callState.phase !== 'idle' && styles.statValueWarning]}>
            {callState.phase !== 'idle' ? 'En llamada' : 'Disponible'}
          </Text>
          <Text style={styles.statLabel}>tu estado</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{availablePeers}</Text>
          <Text style={styles.statLabel}>
            de {peers.length} línea{peers.length !== 1 ? 's' : ''}
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={noirTheme.primary} size="large" />
        </View>
      ) : peers.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="people-outline" size={48} color={noirTheme.surfaceHighest} />
          <Text style={styles.emptyText}>No hay otros porteros configurados.</Text>
        </View>
      ) : (
        <FlatList
          data={peers}
          renderItem={renderPorter}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: noirTheme.surfaceLow,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
  },
  topBarLeft: {
    gap: 2,
  },
  topBarBrand: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  topBarTitle: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: noirTheme.surfaceLow,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    color: noirTheme.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
  },
  statValueWarning: {
    color: '#f59e0b',
  },
  statLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: noirTheme.outline,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  porterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: noirTheme.outline,
    borderRadius: 10,
    padding: 16,
    gap: 12,
  },
  porterInfo: {
    flex: 1,
    gap: 4,
  },
  porterNameRow: {
    gap: 2,
  },
  porterName: {
    color: noirTheme.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  porterUsername: {
    color: noirTheme.secondary,
    fontSize: 11,
  },
  porterStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  statusDotAvailable: {
    backgroundColor: '#16a34a',
  },
  statusDotBusy: {
    backgroundColor: '#dc2626',
  },
  porterStatus: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  currentCallInfo: {
    backgroundColor: noirTheme.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginTop: 2,
  },
  currentCallText: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '600',
  },
  callBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: noirTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  callBtnDisabled: {
    backgroundColor: noirTheme.surfaceHigh,
  },
});
