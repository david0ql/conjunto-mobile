import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NoirScreen } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setPoolRoot, setPorteroRoot, setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { authStore } from '../context/auth.store';
import { ApiError, getMe } from '../services/api';
import { callService } from '../realtime/calls/callService';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import { warnAboutMissingPermissions } from '../services/permissions';

export function SplashScreen() {
  useEffect(() => {
    let loginTimer: ReturnType<typeof setTimeout> | undefined;

    async function bootstrap() {
      await authStore.init();

      if (authStore.isAuthenticated()) {
        // Try to verify the stored token, but don't log the user out just
        // because there's no network — only the server explicitly rejecting
        // the token (401/403) should end the session. Otherwise the user
        // loses their session every time they open the app offline, and
        // with it the ability to receive calls once connectivity returns.
        try {
          await getMe();
        } catch (e) {
          if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
            await callService.stop();
            assemblyService.stop();
            await authStore.clearSession();
            setShellRoot(COMPONENTS.login);
            return;
          }
          // Network/server error — keep the cached session and proceed below.
        }

        const user = authStore.getUser();
        if (user?.type === 'employee') {
          if (user.role === 'pool_attendant') {
            setPoolRoot();
          } else {
            setPorteroRoot();
          }
        } else {
          setShellRoot(COMPONENTS.homeNews);
        }
        const token = authStore.getToken();
        if (token) {
          callService.start(token);
          assemblyService.start(token);
        }
        // Checked after the root transition and call service kick-off (not
        // before) so this summary alert never races the screen change.
        setTimeout(() => void warnAboutMissingPermissions(), 1500);
      } else {
        // No token stored — go to login after a short branded delay
        void callService.stop();
        assemblyService.stop();
        loginTimer = setTimeout(() => setShellRoot(COMPONENTS.login), 1400);
      }
    }

    bootstrap();

    return () => {
      if (loginTimer) {
        clearTimeout(loginTimer);
      }
    };
  }, []);

  return (
    <NoirScreen scroll={false} contentContainerStyle={styles.container}>
      <View style={styles.center}>
        <Text style={styles.brand}>RESERVA{'\n'}DE LA LOMA</Text>
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
