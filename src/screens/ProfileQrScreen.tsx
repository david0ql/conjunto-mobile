import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  NoirScreen,
  NoirTopBar,
  PrimaryButton,
} from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { authStore } from '../context/auth.store';
import { callService } from '../realtime/calls/callService';
import {
  getMyProfile,
  getMyApartments,
  getMyQr,
  type ResidentProfile,
  type ResidentApartment,
} from '../services/api';

export function ProfileQrScreen() {
  const [profile, setProfile] = useState<ResidentProfile | null>(null);
  const [apartments, setApartments] = useState<ResidentApartment[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [selectedAptIdx, setSelectedAptIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function fetchProfile(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    Promise.all([getMyProfile(), getMyApartments()])
      .then(([p, apts]) => {
        setProfile(p);
        setApartments(apts);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => { fetchProfile(); }, []);

  // Fetch QR whenever selected apartment changes
  useEffect(() => {
    const apt = apartments[selectedAptIdx];
    if (!apt) return;
    setQrDataUrl(null);
    getMyQr(apt.apartmentId)
      .then((r) => setQrDataUrl(r.dataUrl))
      .catch(() => {});
  }, [apartments, selectedAptIdx]);

  async function handleLogout() {
    await callService.stop();
    await authStore.clearSession();
    setShellRoot(COMPONENTS.login);
  }

  const selectedApt = apartments[selectedAptIdx];
  const aptLabel = selectedApt
    ? `${selectedApt.apartment?.towerData?.name ?? 'Torre'} · Apt. ${selectedApt.apartment?.number ?? '—'}`
    : profile?.apartment
      ? `${profile.apartment.towerData?.name ?? 'Torre'} · Apt. ${profile.apartment.number}`
      : 'Sin apartamento';

  const infoRows = [
    ['business', 'Residencia', aptLabel],
    ['verified-user', 'Tipo de acceso', 'RESIDENTE — ACCESO COMPLETO'],
    ['email', 'Correo', profile?.email ?? '—'],
    ['phone', 'Teléfono', profile?.phone ?? '—'],
  ] as const;

  return (
    <NoirScreen onRefresh={() => fetchProfile(true)} refreshing={refreshing}>
      <NoirTopBar />

      <View style={styles.content}>
        <View style={styles.header}>
          <Eyebrow>Resident ID</Eyebrow>
          {loading ? (
            <View style={styles.nameSkeleton} />
          ) : (
            <Text style={styles.name}>
              {profile ? `${profile.name} ${profile.lastName}` : '—'}
            </Text>
          )}
          <Text style={styles.meta}>{aptLabel}</Text>
        </View>

        {/* Apartment selector for multi-apartment residents */}
        {apartments.length > 1 ? (
          <View style={styles.aptSelector}>
            <Eyebrow>Seleccionar apartamento</Eyebrow>
            <View style={styles.aptList}>
              {apartments.map((apt, idx) => (
                <Pressable
                  key={apt.id}
                  onPress={() => setSelectedAptIdx(idx)}
                  style={[styles.aptPill, idx === selectedAptIdx && styles.aptPillActive]}>
                  <Text style={[styles.aptPillText, idx === selectedAptIdx && styles.aptPillTextActive]}>
                    {apt.apartment?.towerData?.code ?? '?'} · {apt.apartment?.number ?? '—'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* QR Code */}
        <View style={styles.qrFrame}>
          {loading ? (
            <View style={styles.qrPlaceholder}>
              <ActivityIndicator color={noirTheme.surfaceHighest} size="large" />
            </View>
          ) : qrDataUrl ? (
            <Image source={{ uri: qrDataUrl }} style={styles.qr} />
          ) : (
            <View style={styles.qrPlaceholder}>
              <MaterialIcons color={noirTheme.surfaceHighest} name="qr-code" size={80} />
            </View>
          )}
        </View>

        <View style={styles.infoList}>
          {infoRows.map((item) => (
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
          onPress={handleLogout}
          style={styles.logoutButton}
        />

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>RESERVA DE LA LOMA — SISTEMAS RESIDENCIALES</Text>
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
  nameSkeleton: {
    width: 200,
    height: 34,
    backgroundColor: noirTheme.surfaceHigh,
    borderRadius: 4,
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
  aptSelector: {
    gap: 12,
  },
  aptList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aptPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  aptPillActive: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  aptPillText: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  aptPillTextActive: {
    color: '#000000',
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
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceHigh,
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
  logoutButton: {
    minHeight: 52,
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
