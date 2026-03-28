import React, { useEffect, useState, useSyncExternalStore } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  NoirScreen,
  NoirTopBar,
} from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { callService } from '../realtime/calls/callService';
import { callStore } from '../realtime/calls/callStore';
import {
  getMyPackages,
  getMyAccessEntries,
  getMyApartments,
  getPackagePhotos,
  resolveImageUrl,
  type PackageItem,
  type PackagePhoto,
  type AccessEntry,
  type ResidentApartment,
  type PorterAvailability,
} from '../services/api';

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Ahora';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

// ─── Package photos modal ─────────────────────────────────────────────────────

function PackagePhotosModal({
  pkg,
  onClose,
}: {
  pkg: PackageItem | null;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!pkg) return;
    setLoading(true);
    setPhotos([]);
    getPackagePhotos(pkg.id)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pkg?.id]);

  if (!pkg) return null;

  return (
    <Modal
      visible={!!pkg}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Fotos del paquete</Text>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <MaterialIcons color={noirTheme.primary} name="close" size={24} />
          </Pressable>
        </View>

        <Text style={modalStyles.desc}>
          {pkg.description ?? 'Paquete sin descripción'}
        </Text>

        <ScrollView contentContainerStyle={modalStyles.photoGrid}>
          {loading ? (
            <ActivityIndicator color={noirTheme.primary} size="large" style={{ marginTop: 40 }} />
          ) : photos.length === 0 ? (
            <View style={modalStyles.empty}>
              <MaterialIcons color={noirTheme.surfaceHighest} name="image-not-supported" size={48} />
              <Text style={modalStyles.emptyText}>Sin fotos registradas</Text>
            </View>
          ) : (
            photos.map((photo) => {
              const uri = resolveImageUrl(photo.filePath);
              return uri ? (
                <Image
                  key={photo.id}
                  source={{ uri }}
                  style={modalStyles.photo}
                  resizeMode="cover"
                />
              ) : null;
            })
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export function PorteriaLogScreen() {
  const callState = useSyncExternalStore(callStore.subscribe, callStore.getState);
  const [activeTab, setActiveTab] = useState<'packages' | 'entries'>('packages');
  const [porters, setPorters] = useState<PorterAvailability[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [entries, setEntries] = useState<AccessEntry[]>([]);
  const [apartments, setApartments] = useState<ResidentApartment[]>([]);
  const [loadingPorters, setLoadingPorters] = useState(true);
  const [selectedAptIdx, setSelectedAptIdx] = useState(0);
  const [loadingPackages, setLoadingPackages] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState<PackageItem | null>(null);

  const selectedAptId = apartments[selectedAptIdx]?.apartmentId;

  function fetchPackages() {
    getMyPackages()
      .then(setPackages)
      .catch(() => {})
      .finally(() => setLoadingPackages(false));
  }

  function fetchPorters() {
    setLoadingPorters(true);
    callService.refreshPorters()
      .then(setPorters)
      .finally(() => setLoadingPorters(false));
  }

  function fetchEntries(aptId?: string) {
    setLoadingEntries(true);
    getMyAccessEntries(aptId)
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoadingEntries(false));
  }

  function handleRefresh() {
    setRefreshing(true);
    const fetches = [
      getMyPackages().then(setPackages).catch(() => {}),
      callService.refreshPorters().then(setPorters),
    ];
    if (activeTab === 'entries') fetches.push(getMyAccessEntries(selectedAptId).then(setEntries).catch(() => {}));
    Promise.all(fetches).finally(() => setRefreshing(false));
  }

  useEffect(() => {
    const unsubscribe = callService.subscribePorters((nextPorters) => {
      setPorters(nextPorters);
      setLoadingPorters(false);
    });

    fetchPackages();
    fetchPorters();
    getMyApartments().then(setApartments).catch(() => {});
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (activeTab === 'entries') fetchEntries(selectedAptId);
  }, [activeTab, selectedAptId]);

  const pendingPackages = packages.filter((p) => !p.delivered);
  const callBusy = callState.phase !== 'idle';

  async function handleCallPorter(porter: PorterAvailability) {
    try {
      await callService.callPorter(porter.id);
    } catch (error) {
      Alert.alert(
        'No fue posible llamar a portería',
        error instanceof Error ? error.message : 'Intenta nuevamente en unos segundos.',
      );
    }
  }

  return (
    <NoirScreen onRefresh={handleRefresh} refreshing={refreshing}>
      <NoirTopBar />

      <PackagePhotosModal pkg={selectedPkg} onClose={() => setSelectedPkg(null)} />

      <View style={styles.content}>
        <View style={styles.callCard}>
          <View style={styles.callCardCopy}>
            <Eyebrow>Intercom</Eyebrow>
            <Text style={styles.callCardTitle}>Llamar a portería</Text>
            <Text style={styles.callCardText}>
              Elige el portero exacto con quien quieres hablar. Cada portero solo puede atender una llamada a la vez.
            </Text>
          </View>

          {loadingPorters ? (
            <View style={[styles.skeleton, styles.callSkeleton]} />
          ) : porters.length === 0 ? (
            <Text style={styles.callCardEmpty}>No hay porteros activos disponibles en este momento.</Text>
          ) : (
            <View style={styles.porterList}>
              {porters.map((porter) => {
                const disabled = callBusy || !porter.available;
                const displayName = `${porter.username} · ${porter.name} ${porter.lastName}`;

                return (
                  <Pressable
                    key={porter.id}
                    disabled={disabled}
                    onPress={() => void handleCallPorter(porter)}
                    style={[styles.callButton, disabled && styles.callButtonDisabled]}>
                    <View style={styles.callButtonCopy}>
                      <Text style={[styles.callButtonText, disabled && styles.callButtonTextDisabled]}>
                        {displayName}
                      </Text>
                      <View style={styles.callStatusRow}>
                        <View
                          style={[
                            styles.callStatusDot,
                            porter.available ? styles.callStatusDotAvailable : styles.callStatusDotBusy,
                          ]}
                        />
                        <Text style={[styles.callButtonMeta, disabled && styles.callButtonMetaDisabled]}>
                          {porter.available ? 'Disponible' : 'Ocupado'}
                        </Text>
                      </View>
                    </View>
                    <MaterialIcons
                      color={disabled ? noirTheme.secondary : '#000000'}
                      name="support-agent"
                      size={22}
                    />
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.tabs}>
          <Pressable onPress={() => setActiveTab('packages')} style={styles.tabPill}>
            <Text style={activeTab === 'packages' ? styles.tabActive : styles.tab}>Paquetes</Text>
          </Pressable>
          <Pressable onPress={() => setActiveTab('entries')} style={styles.tabPill}>
            <Text style={activeTab === 'entries' ? styles.tabActive : styles.tab}>Ingresos</Text>
          </Pressable>
        </View>

        {activeTab === 'packages' ? (
          <View style={styles.grid}>
            {loadingPackages ? (
              [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
            ) : packages.length === 0 ? (
              <Text style={styles.emptyText}>No hay paquetes registrados.</Text>
            ) : (
              packages.map((pkg) => {
                const isPending = !pkg.delivered;
                return (
                  <Pressable
                    key={pkg.id}
                    onPress={() => setSelectedPkg(pkg)}
                    style={[
                      styles.packageCard,
                      isPending ? styles.packageCardStrong : styles.packageCardMuted,
                    ]}>
                    <View style={styles.packageTop}>
                      <View style={styles.packageCopy}>
                        <Eyebrow>Paquete · Toca para ver fotos</Eyebrow>
                        <Text style={styles.packageTitle}>
                          {pkg.description ?? 'Paquete sin descripción'}
                        </Text>
                      </View>
                      <Text style={[styles.packageStatus, isPending && styles.packageStatusStrong]}>
                        {isPending ? 'Pendiente' : 'Entregado'}
                      </Text>
                    </View>
                    <View style={styles.packageBottom}>
                      <View>
                        <Text style={styles.packageMeta}>
                          {isPending ? 'Recibido hace' : 'Entregado hace'}
                        </Text>
                        <Text style={styles.packageTime}>
                          {formatRelativeTime(
                            isPending ? pkg.arrivalTime : (pkg.deliveredTime ?? pkg.arrivalTime),
                          )}
                        </Text>
                      </View>
                      <View style={styles.photoHint}>
                        <MaterialIcons
                          color={isPending ? noirTheme.outline : noirTheme.primary}
                          name={isPending ? 'local-shipping' : 'check-circle'}
                          size={28}
                        />
                        <MaterialIcons
                          color={noirTheme.secondary}
                          name="photo-library"
                          size={18}
                        />
                      </View>
                    </View>
                  </Pressable>
                );
              })
            )}

            {pendingPackages.length > 0 ? (
              <View style={styles.whiteCard}>
                <Eyebrow style={styles.whiteEyebrow}>Notificaciones</Eyebrow>
                <Text style={styles.whiteTitle}>
                  {pendingPackages.length === 1
                    ? 'Tiene 1 paquete pendiente'
                    : `Tiene ${pendingPackages.length} paquetes pendientes`}
                </Text>
                <Text style={styles.whiteLink}>Contacte a portería para retirarlos</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {activeTab === 'entries' ? (
          <View style={styles.visitorsSection}>
            <View style={styles.visitorsHeader}>
              <Text style={styles.visitorsTitle}>Ingresos recientes</Text>
            </View>

            {apartments.length > 1 && (
              <View style={styles.aptSelector}>
                {apartments.map((apt, idx) => {
                  const label = apt.apartment
                    ? `${apt.apartment.towerData?.name ?? 'Torre'} · ${apt.apartment.number}`
                    : `Apt. ${idx + 1}`;
                  return (
                    <Pressable
                      key={apt.apartmentId}
                      onPress={() => setSelectedAptIdx(idx)}
                      style={[styles.aptChip, idx === selectedAptIdx && styles.aptChipActive]}>
                      <Text style={[styles.aptChipText, idx === selectedAptIdx && styles.aptChipTextActive]}>
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {loadingEntries ? (
              [0, 1, 2].map((i) => <View key={i} style={[styles.skeleton, { height: 80 }]} />)
            ) : entries.length === 0 ? (
              <Text style={styles.emptyText}>No hay ingresos registrados para tu apartamento.</Text>
            ) : (
              entries.map((entry) => {
                const visitorName = entry.visitor
                  ? `${entry.visitor.name} ${entry.visitor.lastName}`
                  : entry.vehicle
                    ? 'Vehículo'
                    : 'Residente';

                return (
                  <View key={entry.id} style={styles.visitorRow}>
                    <View style={styles.visitorIdentity}>
                      <View style={styles.visitorAvatarPlaceholder}>
                        <MaterialIcons
                          color={noirTheme.primary}
                          name={entry.vehicle ? 'directions-car' : 'person'}
                          size={28}
                        />
                      </View>
                      <View>
                        <Text style={styles.visitorName}>{visitorName}</Text>
                        <Text style={styles.visitorRole}>
                          {entry.vehicle ? 'Vehículo' : 'Visita personal'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.visitorTimeWrap}>
                      <Text style={styles.visitorTime}>
                        {new Date(entry.entryTime).toLocaleTimeString('es-CO', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                      <Text style={styles.visitorDay}>
                        {new Date(entry.entryTime).toLocaleDateString('es-CO', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        ) : null}
      </View>
    </NoirScreen>
  );
}

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: noirTheme.surfaceLow,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  desc: {
    color: noirTheme.secondary,
    fontSize: 13,
    paddingHorizontal: 24,
    paddingTop: 16,
    letterSpacing: 0.5,
  },
  photoGrid: {
    padding: 16,
    gap: 12,
  },
  photo: {
    width: '100%',
    height: 280,
    backgroundColor: noirTheme.surfaceLow,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 60,
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 28,
  },
  callCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
    gap: 18,
  },
  callCardCopy: {
    gap: 8,
  },
  callCardTitle: {
    color: noirTheme.primary,
    fontSize: 28,
    lineHeight: 28,
    fontWeight: '900',
    letterSpacing: -1,
    textTransform: 'uppercase',
  },
  callCardText: {
    color: noirTheme.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
  callCardEmpty: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  callSkeleton: {
    height: 132,
  },
  porterList: {
    gap: 10,
  },
  callButton: {
    minHeight: 62,
    backgroundColor: noirTheme.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 16,
  },
  callButtonDisabled: {
    backgroundColor: noirTheme.surfaceHigh,
  },
  callButtonCopy: {
    flex: 1,
    gap: 4,
  },
  callStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  callStatusDotAvailable: {
    backgroundColor: '#16a34a',
  },
  callStatusDotBusy: {
    backgroundColor: '#dc2626',
  },
  callButtonText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
  },
  callButtonTextDisabled: {
    color: noirTheme.secondary,
  },
  callButtonMeta: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  callButtonMetaDisabled: {
    color: noirTheme.secondary,
  },
  tabs: {
    flexDirection: 'row',
    gap: 20,
    alignItems: 'flex-end',
  },
  tabPill: {
    paddingBottom: 4,
  },
  tabActive: {
    color: noirTheme.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  tab: {
    color: noirTheme.secondary,
    opacity: 0.4,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.5,
  },
  grid: {
    gap: 16,
  },
  skeleton: {
    height: 190,
    backgroundColor: noirTheme.surfaceHigh,
  },
  emptyText: {
    color: noirTheme.secondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    lineHeight: 22,
  },
  packageCard: {
    minHeight: 190,
    padding: 20,
    justifyContent: 'space-between',
  },
  packageCardStrong: {
    backgroundColor: noirTheme.surfaceHigh,
  },
  packageCardMuted: {
    backgroundColor: noirTheme.surfaceLow,
  },
  packageTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  packageCopy: {
    flex: 1,
    gap: 6,
  },
  packageTitle: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '700',
  },
  packageStatus: {
    color: noirTheme.secondary,
    backgroundColor: noirTheme.surfaceHighest,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
  },
  packageStatusStrong: {
    color: '#000000',
    backgroundColor: noirTheme.primary,
  },
  packageBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  packageMeta: {
    color: noirTheme.secondary,
    fontSize: 12,
  },
  packageTime: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -1,
  },
  photoHint: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  whiteCard: {
    backgroundColor: noirTheme.primary,
    padding: 20,
    gap: 12,
  },
  whiteEyebrow: {
    color: '#000000',
  },
  whiteTitle: {
    color: '#000000',
    fontSize: 34,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
  },
  whiteLink: {
    marginTop: 24,
    color: '#000000',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  visitorsSection: {
    gap: 12,
    marginBottom: 24,
  },
  visitorsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 4,
  },
  aptSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aptChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: noirTheme.surfaceLow,
  },
  aptChipActive: {
    backgroundColor: noirTheme.primary,
  },
  aptChipText: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aptChipTextActive: {
    color: '#000000',
  },
  visitorsTitle: {
    color: noirTheme.primary,
    fontSize: 26,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  visitorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    padding: 18,
    backgroundColor: noirTheme.surfaceLow,
  },
  visitorIdentity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  visitorAvatarPlaceholder: {
    width: 64,
    height: 64,
    backgroundColor: noirTheme.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorName: {
    color: noirTheme.primary,
    fontSize: 18,
    fontWeight: '800',
  },
  visitorRole: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  visitorTimeWrap: {
    alignItems: 'flex-end',
  },
  visitorTime: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '900',
  },
  visitorDay: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
