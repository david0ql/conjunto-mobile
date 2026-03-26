import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  NoirScreen,
  NoirTopBar,
  PrimaryButton,
} from '../components/NoirUI';
import { noirAssets } from '../design/assets';
import { noirTheme } from '../design/theme';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';

const actionCards = [
  ['history', 'Access History', 'Last entry: 14:22 Today'],
  ['group-add', 'Guest Access', '3 Active Invites'],
] as const;

const rows = [
  ['business', 'Unit Residence', 'TORRE 04, LEVEL 12, SUITE C'],
  ['verified-user', 'Security Tier', 'RESIDENT - FULL ACCESS'],
  ['event-available', 'Contract End', 'OCT 2026'],
] as const;

export function ProfileQrScreen() {
  return (
    <NoirScreen>
      <NoirTopBar />

      <View style={styles.content}>
        <View style={styles.header}>
          <Eyebrow>Resident ID</Eyebrow>
          <Text style={styles.name}>Alexander Vaughn</Text>
          <Text style={styles.meta}>TORRE 04 - 12C</Text>
        </View>

        <View style={styles.qrFrame}>
          <Image source={{ uri: noirAssets.profile.qr }} style={styles.qr} />
        </View>

        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>Active secure key</Text>
        </View>

        <View style={styles.actionsGrid}>
          {actionCards.map(item => (
            <View key={item[1]} style={styles.actionCard}>
              <MaterialIcons color={noirTheme.primary} name={item[0]} size={22} />
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>{item[1]}</Text>
                <Text style={styles.actionBody}>{item[2]}</Text>
              </View>
            </View>
          ))}

          <Pressable
            style={styles.serviceCard}
            onPress={() => {
              setShellRoot(COMPONENTS.porteriaLog);
            }}>
            <View style={styles.serviceRow}>
              <MaterialIcons color={noirTheme.primary} name="room-service" size={20} />
              <View style={styles.actionCopy}>
                <Text style={styles.actionTitle}>Concierge Services</Text>
                <Text style={styles.actionBody}>Valet, Housekeeping, Dining</Text>
              </View>
            </View>
            <MaterialIcons color={noirTheme.secondary} name="chevron-right" size={18} />
          </Pressable>
        </View>

        <View style={styles.infoList}>
          {rows.map(item => (
            <View key={item[1]} style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <MaterialIcons color={noirTheme.secondary} name={item[0]} size={18} />
                <Text style={styles.infoLabel}>{item[1]}</Text>
              </View>
              <Text style={styles.infoValue}>{item[2]}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton
          label="Cerrar sesión"
          variant="ghost"
          onPress={() => {
            setShellRoot(COMPONENTS.login);
          }}
          style={styles.logoutButton}
        />

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>MONOLITH RESIDENTIAL SYSTEMS</Text>
          <Text style={styles.footerMeta}>ENCRYPTED BIOMETRIC PROTOCOL v4.2.0</Text>
        </View>
      </View>

    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 24,
  },
  header: {
    alignItems: 'center',
    gap: 8,
  },
  name: {
    color: noirTheme.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  meta: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
  },
  qrFrame: {
    alignSelf: 'center',
    backgroundColor: '#ffffff',
    padding: 22,
  },
  qr: {
    width: 220,
    height: 220,
  },
  statusPill: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: noirTheme.surfaceLow,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  actionsGrid: {
    gap: 12,
  },
  actionCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 18,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  actionCopy: {
    gap: 6,
  },
  actionTitle: {
    color: noirTheme.primary,
    fontSize: 16,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  actionBody: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  serviceCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoutButton: {
    minHeight: 52,
  },
  serviceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  infoList: {
    gap: 4,
  },
  infoRow: {
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoLabel: {
    color: noirTheme.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  infoValue: {
    color: noirTheme.secondary,
    fontSize: 12,
  },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
    gap: 8,
  },
  footerTitle: {
    color: noirTheme.surfaceHighest,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  footerMeta: {
    color: noirTheme.surfaceHigh,
    fontSize: 8,
    letterSpacing: 1,
  },
});
