import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  Headline,
  HeroCard,
  NoirScreen,
  NoirTopBar,
} from '../components/NoirUI';
import { pushScreen } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { NavigationComponentProps } from 'react-native-navigation';
import { noirTheme } from '../design/theme';
import {
  getCommonAreas,
  getMyReservations,
  type CommonArea,
  type Reservation,
} from '../services/api';

const ZONE_ICONS: Record<string, string> = {
  Gimnasio: 'fitness-center',
  Piscina: 'pool',
  'Salón social': 'celebration',
  'Zona BBQ': 'outdoor-grill',
  Kiosko: 'local-cafe',
  'Cava privada': 'wine-bar',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#2a2a1a', text: '#ffd700' },
  approved: { bg: '#1f3a24', text: '#8ef0a3' },
  cancelled: { bg: '#3b1f1f', text: '#ffb4ab' },
  completed: { bg: noirTheme.primary, text: '#000000' },
};

type SpacesTab = 'reservables' | 'comunes' | 'historial';

export function ZonesBrowseScreen({ componentId }: NavigationComponentProps) {
  const [activeTab, setActiveTab] = useState<SpacesTab>('reservables');
  const [areas, setAreas] = useState<CommonArea[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loadingAreas, setLoadingAreas] = useState(true);
  const [loadingReservations, setLoadingReservations] = useState(false);

  useEffect(() => {
    getCommonAreas()
      .then(setAreas)
      .catch(() => {})
      .finally(() => setLoadingAreas(false));
  }, []);

  useEffect(() => {
    if (activeTab === 'historial') {
      setLoadingReservations(true);
      getMyReservations()
        .then(setReservations)
        .catch(() => {})
        .finally(() => setLoadingReservations(false));
    }
  }, [activeTab]);

  const statusColors = (statusCode?: string) =>
    STATUS_COLORS[statusCode ?? ''] ?? { bg: noirTheme.surfaceHigh, text: noirTheme.secondary };

  return (
    <NoirScreen>
      <NoirTopBar />

      <View style={styles.content}>
        <View style={styles.tabs}>
          <TabPill
            active={activeTab === 'reservables'}
            label="Reservables"
            onPress={() => setActiveTab('reservables')}
          />
          <TabPill
            active={activeTab === 'comunes'}
            label="Comunes"
            onPress={() => setActiveTab('comunes')}
          />
          <TabPill
            active={activeTab === 'historial'}
            label="Historial"
            onPress={() => setActiveTab('historial')}
          />
        </View>

        <View style={styles.heroHeader}>
          <Headline style={styles.title}>
            {activeTab === 'reservables'
              ? 'Espacios\ndisponibles'
              : activeTab === 'comunes'
                ? 'Zonas\nde uso libre'
                : 'Historial\nde reservas'}
          </Headline>
          <Eyebrow style={styles.description}>
            {activeTab === 'reservables'
              ? 'Exclusividad arquitectónica para residentes del monolito.'
              : activeTab === 'comunes'
                ? 'Espacios permanentes para circular, esperar y habitar sin reserva.'
                : 'Registro reciente de movimientos y reservas confirmadas del residente.'}
          </Eyebrow>
        </View>

        {activeTab === 'reservables' ? (
          <>
            {loadingAreas ? (
              <View style={styles.skeletonGrid}>
                {[0, 1, 2].map((i) => (
                  <View key={i} style={styles.skeleton} />
                ))}
              </View>
            ) : (
              <View style={styles.grid}>
                {areas.map((area) => (
                  <HeroCard
                    key={area.id}
                    image=""
                    title={area.name}
                    label={area.maxCapacity ? `Capacidad: ${area.maxCapacity} personas` : 'Disponible'}
                    subtitle={area.name}
                    onPrimaryPress={() =>
                      pushScreen(componentId, COMPONENTS.createReservation, { areaId: area.id, areaName: area.name })
                    }
                    onSecondaryPress={() =>
                      pushScreen(componentId, COMPONENTS.zoneDetail)
                    }
                  />
                ))}
              </View>
            )}
          </>
        ) : null}

        {activeTab === 'comunes' ? (
          <View style={styles.sectionList}>
            {loadingAreas ? (
              [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
            ) : (
              areas.map((area) => (
                <View key={area.id} style={styles.commonCard}>
                  <View style={styles.commonTop}>
                    <View style={styles.commonIconWrap}>
                      <MaterialIcons
                        color={noirTheme.primary}
                        name={ZONE_ICONS[area.name] ?? 'place'}
                        size={22}
                      />
                    </View>
                    <Text style={styles.commonStatus}>
                      {area.maxCapacity ? `Máx. ${area.maxCapacity}` : 'Libre'}
                    </Text>
                  </View>
                  <View style={styles.commonCopy}>
                    <Text style={styles.commonTitle}>{area.name}</Text>
                    <Text style={styles.commonBody}>Espacio disponible para residentes del conjunto.</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeTab === 'historial' ? (
          <View style={styles.sectionList}>
            {loadingReservations ? (
              [0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)
            ) : reservations.length === 0 ? (
              <Text style={styles.emptyText}>No tienes reservas registradas.</Text>
            ) : (
              reservations.map((res) => {
                const sc = statusColors(res.status?.code);
                return (
                  <View key={res.id} style={styles.historyCard}>
                    <View style={styles.historyHeader}>
                      <View>
                        <Text style={styles.historyTitle}>{res.area?.name ?? '—'}</Text>
                        <Text style={styles.historyDate}>
                          {new Date(res.reservationDate).toLocaleDateString('es-CO', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </Text>
                      </View>
                      <Text style={[styles.historyStatus, { backgroundColor: sc.bg, color: sc.text }]}>
                        {res.status?.name ?? '—'}
                      </Text>
                    </View>
                    <View style={styles.historyMetaRow}>
                      <View style={styles.historyMetaBlock}>
                        <Eyebrow>Horario</Eyebrow>
                        <Text style={styles.historyMetaValue}>
                          {res.startTime} – {res.endTime}
                        </Text>
                      </View>
                      <View style={styles.historyMetaBlock}>
                        <Eyebrow>Estado</Eyebrow>
                        <Text style={styles.historyMetaValue}>{res.status?.name ?? '—'}</Text>
                      </View>
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

function TabPill({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tabPill, active && styles.tabPillActive]}>
      <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 24,
  },
  tabs: {
    flexDirection: 'row',
    gap: 24,
    flexWrap: 'wrap',
  },
  tabPill: {
    paddingBottom: 10,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabPillText: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  tabPillTextActive: {
    color: noirTheme.primary,
  },
  tabPillActive: {
    borderBottomColor: noirTheme.primary,
  },
  heroHeader: {
    gap: 10,
    marginBottom: 8,
  },
  title: {
    fontSize: 52,
    lineHeight: 52,
  },
  description: {
    width: 260,
    lineHeight: 16,
  },
  grid: {
    gap: 18,
  },
  sectionList: {
    gap: 16,
  },
  skeletonGrid: {
    gap: 18,
  },
  skeleton: {
    height: 180,
    backgroundColor: noirTheme.surfaceHigh,
  },
  emptyText: {
    color: noirTheme.secondary,
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  commonCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
    gap: 18,
  },
  commonTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  commonIconWrap: {
    width: 42,
    height: 42,
    backgroundColor: noirTheme.surfaceHigh,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commonStatus: {
    color: '#000000',
    backgroundColor: noirTheme.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  commonCopy: {
    gap: 10,
  },
  commonTitle: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  commonBody: {
    color: noirTheme.ink,
    fontSize: 14,
    lineHeight: 22,
  },
  historyCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
    gap: 18,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
    alignItems: 'flex-start',
  },
  historyTitle: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  historyDate: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
    marginTop: 4,
  },
  historyStatus: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  historyMetaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  historyMetaBlock: {
    flex: 1,
    gap: 8,
    backgroundColor: noirTheme.surfaceHigh,
    padding: 14,
  },
  historyMetaValue: {
    color: noirTheme.primary,
    fontSize: 16,
    fontWeight: '800',
  },
});
