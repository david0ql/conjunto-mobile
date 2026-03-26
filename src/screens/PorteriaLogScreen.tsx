import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  NoirScreen,
  NoirTopBar,
} from '../components/NoirUI';
import { noirAssets } from '../design/assets';
import { noirTheme } from '../design/theme';

const packages = [
  ['Amazon Prime', 'Tracking #8842-X', 'Pendiente', '14 MIN', 'local-shipping', true],
  ['Mercado Libre', 'Tracking #0192-A', 'Entregado', '09:42 AM', 'check-circle', false],
  ['Restaurante local', 'Pedido de alimentos', 'Entregado', '08:15 AM', 'restaurant', false],
] as const;

const visitors = [
  ['Alejandro Marín', 'Visitante personal', '11:05 AM', 'HOY', noirAssets.visitors.visitor1],
  ['Sofia Larrea', 'Visitante personal', '09:12 AM', 'HOY', noirAssets.visitors.visitor2],
  ['Luis Fernando G.', 'Servicio técnico', '08:45 AM', 'AYER', noirAssets.visitors.technician],
] as const;

export function PorteriaLogScreen() {
  const [activeTab, setActiveTab] = useState<'packages' | 'entries'>('packages');

  return (
    <NoirScreen>
      <NoirTopBar />

      <View style={styles.content}>
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
            {packages.map(item => (
              <View
                key={item[1]}
                style={[
                  styles.packageCard,
                  item[5] ? styles.packageCardStrong : styles.packageCardMuted,
                ]}>
                <View style={styles.packageTop}>
                  <View style={styles.packageCopy}>
                    <Eyebrow>{item[0]}</Eyebrow>
                    <Text style={styles.packageTitle}>{item[1]}</Text>
                  </View>
                  <Text style={[styles.packageStatus, item[5] && styles.packageStatusStrong]}>
                    {item[2]}
                  </Text>
                </View>
                <View style={styles.packageBottom}>
                  <View>
                    <Text style={styles.packageMeta}>Recibido hace</Text>
                    <Text style={styles.packageTime}>{item[3]}</Text>
                  </View>
                  <MaterialIcons
                    color={item[5] ? noirTheme.outline : noirTheme.primary}
                    name={item[4]}
                    size={32}
                  />
                </View>
              </View>
            ))}

            <View style={styles.whiteCard}>
              <Eyebrow style={styles.whiteEyebrow}>Notificaciones</Eyebrow>
              <Text style={styles.whiteTitle}>Tiene 1 paquete pendiente</Text>
              <Text style={styles.whiteLink}>Notificar recepción</Text>
            </View>
          </View>
        ) : null}

        {activeTab === 'entries' ? (
          <View style={styles.visitorsSection}>
            <View style={styles.visitorsHeader}>
              <Text style={styles.visitorsTitle}>Ingresos recientes</Text>
              <Text style={styles.visitorsLink}>Ver todo el historial</Text>
            </View>

            {visitors.map(item => (
              <View key={item[0]} style={styles.visitorRow}>
                <View style={styles.visitorIdentity}>
                  <Image source={{ uri: item[4] }} style={styles.visitorAvatar} />
                  <View>
                    <Text style={styles.visitorName}>{item[0]}</Text>
                    <Text style={styles.visitorRole}>{item[1]}</Text>
                  </View>
                </View>
                <View style={styles.visitorTimeWrap}>
                  <Text style={styles.visitorTime}>{item[2]}</Text>
                  <Text style={styles.visitorDay}>{item[3]}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </View>

    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 16,
    gap: 28,
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
  visitorsTitle: {
    color: noirTheme.primary,
    fontSize: 26,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  visitorsLink: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
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
  visitorAvatar: {
    width: 64,
    height: 64,
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
