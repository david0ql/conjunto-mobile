import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  Headline,
  HeroCard,
  NoirScreen,
  NoirTopBar,
} from '../components/NoirUI';
import { noirAssets } from '../design/assets';
import { pushScreen } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { NavigationComponentProps } from 'react-native-navigation';
import { noirTheme } from '../design/theme';

const reservableCards = [
  {
    image: noirAssets.zones.salon,
    title: 'Salón social',
    subtitle: 'Capacidad 50 pers',
    detail: 'Disponible hoy · 2 slots libres',
  },
  {
    image: noirAssets.zones.bbq,
    title: 'Zona BBQ',
    subtitle: 'Terraza norte',
    detail: 'Disponible mañana · 4 slots libres',
  },
  {
    image: noirAssets.zones.kiosko,
    title: 'Kiosko',
    subtitle: 'Zona zen',
    detail: 'Disponible hoy · 1 slot libre',
  },
  {
    image: noirAssets.zones.gym,
    title: 'Gimnasio',
    subtitle: 'Planta baja',
    detail: 'Acceso inmediato',
  },
  {
    image: noirAssets.zones.pool,
    title: 'Piscina',
    subtitle: 'Piso 20',
    detail: 'Disponible desde 18:00',
  },
  {
    image: noirAssets.zones.cava,
    title: 'Cava privada',
    subtitle: 'Sótano 1',
    detail: 'Disponible fin de semana',
  },
];

const commonCards = [
  {
    icon: 'deck',
    title: 'Lobby privado',
    subtitle: 'Acceso permanente',
    body: 'Recepción, waiting lounge y acceso a concierge en primer nivel.',
    status: 'Abierto 24/7',
  },
  {
    icon: 'fitness-center',
    title: 'Wellness core',
    subtitle: 'Uso libre residentes',
    body: 'Gimnasio, recovery room y zona de estiramiento sin reserva.',
    status: 'Alta ocupación',
  },
  {
    icon: 'local-cafe',
    title: 'Coffee lounge',
    subtitle: 'Cowork & social',
    body: 'Espacio silencioso para reuniones breves, café y trabajo liviano.',
    status: 'Disponible ahora',
  },
];

const historyCards = [
  {
    title: 'Salón social',
    date: '24 MAR 2026',
    slot: '19:00 - 23:00',
    status: 'Finalizada',
    attendees: '08 asistentes',
  },
  {
    title: 'Zona BBQ',
    date: '18 MAR 2026',
    slot: '14:00 - 18:00',
    status: 'Aprobada',
    attendees: '06 asistentes',
  },
  {
    title: 'Kiosko',
    date: '02 MAR 2026',
    slot: '09:00 - 13:00',
    status: 'Cancelada',
    attendees: '03 asistentes',
  },
] as const;

type SpacesTab = 'reservables' | 'comunes' | 'historial';

export function ZonesBrowseScreen({ componentId }: NavigationComponentProps) {
  const [activeTab, setActiveTab] = useState<SpacesTab>('reservables');

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
              ? "Espacios\ndisponibles"
              : activeTab === 'comunes'
                ? "Zonas\nde uso libre"
                : "Historial\nde reservas"}
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
            <View style={styles.grid}>
              {reservableCards.map(item => (
                <HeroCard
                  key={item.title}
                  image={item.image}
                  title={item.title}
                  label={item.detail}
                  subtitle={item.subtitle}
                  onPrimaryPress={() =>
                    pushScreen(componentId, COMPONENTS.createReservation)
                  }
                  onSecondaryPress={() =>
                    pushScreen(componentId, COMPONENTS.zoneDetail)
                  }
                />
              ))}
            </View>

            <View style={styles.loadMore}>
              <Text style={styles.loadMoreLabel}>Cargar más</Text>
            </View>
          </>
        ) : null}

        {activeTab === 'comunes' ? (
          <View style={styles.sectionList}>
            {commonCards.map(item => (
              <View key={item.title} style={styles.commonCard}>
                <View style={styles.commonTop}>
                  <View style={styles.commonIconWrap}>
                    <MaterialIcons color={noirTheme.primary} name={item.icon} size={22} />
                  </View>
                  <Text style={styles.commonStatus}>{item.status}</Text>
                </View>
                <View style={styles.commonCopy}>
                  <Text style={styles.commonTitle}>{item.title}</Text>
                  <Text style={styles.commonSubtitle}>{item.subtitle}</Text>
                  <Text style={styles.commonBody}>{item.body}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {activeTab === 'historial' ? (
          <View style={styles.sectionList}>
            {historyCards.map(item => (
              <View key={`${item.title}-${item.date}`} style={styles.historyCard}>
                <View style={styles.historyHeader}>
                  <View>
                    <Text style={styles.historyTitle}>{item.title}</Text>
                    <Text style={styles.historyDate}>{item.date}</Text>
                  </View>
                  <Text
                    style={[
                      styles.historyStatus,
                      item.status === 'Finalizada'
                        ? styles.historyStatusDone
                        : item.status === 'Aprobada'
                          ? styles.historyStatusApproved
                          : styles.historyStatusCancelled,
                    ]}>
                    {item.status}
                  </Text>
                </View>
                <View style={styles.historyMetaRow}>
                  <View style={styles.historyMetaBlock}>
                    <Eyebrow>Horario</Eyebrow>
                    <Text style={styles.historyMetaValue}>{item.slot}</Text>
                  </View>
                  <View style={styles.historyMetaBlock}>
                    <Eyebrow>Ocupación</Eyebrow>
                    <Text style={styles.historyMetaValue}>{item.attendees}</Text>
                  </View>
                </View>
              </View>
            ))}
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
  commonSubtitle: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
    textTransform: 'uppercase',
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
  historyStatusDone: {
    backgroundColor: noirTheme.primary,
    color: '#000000',
  },
  historyStatusApproved: {
    backgroundColor: '#1f3a24',
    color: '#8ef0a3',
  },
  historyStatusCancelled: {
    backgroundColor: '#3b1f1f',
    color: '#ffb4ab',
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
  loadMore: {
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 18,
    marginBottom: 24,
  },
  loadMoreLabel: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
});
