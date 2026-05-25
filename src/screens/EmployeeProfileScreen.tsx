import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NoirScreen, NoirTopBar, PrimaryButton } from '../components/NoirUI';
import { authStore } from '../context/auth.store';
import { noirTheme } from '../design/theme';
import { COMPONENTS } from '../navigation/componentNames';
import { setShellRoot } from '../navigation/root';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import { callService } from '../realtime/calls/callService';

export function EmployeeProfileScreen() {
  const user = authStore.getUser();
  const roleLabel = user?.role === 'pool_attendant' ? 'Piscinero' : user?.role ?? '—';

  async function handleLogout() {
    await callService.stop();
    assemblyService.stop();
    await authStore.clearSession();
    setShellRoot(COMPONENTS.login);
  }

  const rows = [
    ['badge', 'Nombre', user ? `${user.name} ${user.lastName}` : '—'],
    ['assignment-ind', 'Documento', user?.document ?? '—'],
    ['alternate-email', 'Correo', user?.email ?? '—'],
    ['phone', 'Teléfono', user?.phone ?? '—'],
    ['admin-panel-settings', 'Rol', roleLabel],
  ] as const;

  return (
    <NoirScreen>
      <NoirTopBar />
      <View style={styles.content}>
        <View style={styles.hero}>
          <View style={styles.avatar}>
            <MaterialIcons name="pool" size={42} color="#000" />
          </View>
          <Text style={styles.title}>Perfil{'\n'}operativo</Text>
          <Text style={styles.subtitle}>Control de piscina y accesos de residentes.</Text>
        </View>

        <View style={styles.infoList}>
          {rows.map((row) => (
            <View key={row[1]} style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <MaterialIcons name={row[0]} size={18} color={noirTheme.secondary} />
                <Text style={styles.infoLabel}>{row[1]}</Text>
              </View>
              <Text style={styles.infoValue}>{row[2]}</Text>
            </View>
          ))}
        </View>

        <PrimaryButton label="Cerrar sesión" variant="ghost" onPress={handleLogout} />
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
  hero: {
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    backgroundColor: noirTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: noirTheme.primary,
    fontSize: 44,
    lineHeight: 44,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  subtitle: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  infoList: {
    backgroundColor: noirTheme.surfaceLow,
  },
  infoRow: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    gap: 8,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1.4,
  },
  infoValue: {
    color: noirTheme.primary,
    fontSize: 17,
    fontWeight: '800',
  },
});
