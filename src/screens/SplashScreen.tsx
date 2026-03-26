import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NoirScreen } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';

export function SplashScreen() {
  useEffect(() => {
    const timeout = setTimeout(() => {
      setShellRoot(COMPONENTS.login);
    }, 1400);

    return () => clearTimeout(timeout);
  }, []);

  return (
    <NoirScreen scroll={false} contentContainerStyle={styles.container}>
      <View style={styles.center}>
        <Text style={styles.brand}>MONOLITH</Text>
        <Text style={styles.subtitle}>Establishing Connection</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>System Initialization</Text>
          <Text style={styles.percent}>03%</Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={styles.progressFill} />
        </View>
        <View style={styles.protocolRow}>
          <MaterialIcons color={noirTheme.secondary} name="settings-input-antenna" size={14} />
          <Text style={styles.protocolText}>Secure Handshake Protocol</Text>
        </View>
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 32,
    paddingVertical: 40,
    backgroundColor: noirTheme.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: {
    color: noirTheme.primary,
    fontSize: 56,
    fontWeight: '900',
    letterSpacing: -2.4,
    textTransform: 'uppercase',
  },
  subtitle: {
    marginTop: 16,
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 4,
    textTransform: 'uppercase',
  },
  footer: {
    gap: 20,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  metaLabel: {
    color: noirTheme.secondary,
    opacity: 0.55,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  percent: {
    color: noirTheme.primary,
    fontSize: 20,
    fontWeight: '800',
  },
  progressTrack: {
    height: 2,
    backgroundColor: noirTheme.surfaceHighest,
  },
  progressFill: {
    width: '3%',
    height: 2,
    backgroundColor: noirTheme.primary,
  },
  protocolRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    flexDirection: 'row',
  },
  protocolText: {
    color: noirTheme.secondary,
    opacity: 0.55,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.8,
    textTransform: 'uppercase',
  },
});
