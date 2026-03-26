import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Divider, Eyebrow, Headline, NoirScreen, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { loginResident, ApiError } from '../services/api';
import { authStore } from '../context/auth.store';

export function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    const id = identifier.trim();
    const pw = password.trim();

    if (!id || !pw) {
      Alert.alert('Campos requeridos', 'Ingresa tu correo/documento y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const response = await loginResident(id, pw);
      await authStore.setSession(response.accessToken, response.user);
      setShellRoot(COMPONENTS.homeNews);
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          Alert.alert(
            'Sin apartamento asignado',
            'Tu cuenta no tiene un apartamento asignado aún. Contacta a la administración.',
          );
        } else if (error.status === 401) {
          Alert.alert('Credenciales incorrectas', 'Verifica tu correo/documento y contraseña.');
        } else {
          Alert.alert('Error', error.message || 'No fue posible iniciar sesión.');
        }
      } else {
        Alert.alert('Error de conexión', 'No se pudo conectar al servidor. Verifica tu red.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <NoirScreen scroll={false}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.sideBrand}>MONOLITH</Text>
          <View style={styles.sideTextGroup}>
            <Text style={styles.sideHeadline}>EL SILENCIO DEL LUJO.</Text>
            <Text style={styles.sideCopy}>
              Acceso exclusivo a la gestión residencial de vanguardia. Un
              ecosistema diseñado para la discreción y el mando absoluto sobre
              su entorno.
            </Text>
          </View>
          <View style={styles.sideMeta}>
            <Text style={styles.sideMetaText}>Requisitos de privacidad</Text>
            <View style={styles.sideMetaLine} />
            <Text style={styles.sideMetaText}>V.2.04</Text>
          </View>
        </View>

        <View style={styles.formPanel}>
          <View style={styles.header}>
            <Headline style={styles.title}>Iniciar{'\n'}sesión</Headline>
            <Divider />
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Eyebrow>Correo / Documento</Eyebrow>
              <TextInput
                placeholder="usuario@monolith.res"
                placeholderTextColor={noirTheme.surfaceHighest}
                style={styles.input}
                value={identifier}
                onChangeText={setIdentifier}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Eyebrow>Contraseña</Eyebrow>
              <TextInput
                placeholder="••••••••"
                placeholderTextColor={noirTheme.surfaceHighest}
                secureTextEntry
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                onSubmitEditing={handleLogin}
              />
            </View>

            <PrimaryButton
              label={loading ? '' : 'Ingresar'}
              onPress={handleLogin}
              style={styles.loginButton}
              textStyle={loading ? { display: 'none' } : undefined}
            />
            {loading ? (
              <ActivityIndicator
                color="#000"
                style={StyleSheet.absoluteFill}
              />
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  heroCard: {
    backgroundColor: noirTheme.surfaceLow,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    flexShrink: 1,
    gap: 28,
    marginBottom: 24,
  },
  sideBrand: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.8,
    textTransform: 'uppercase',
  },
  sideTextGroup: {
    gap: 14,
  },
  sideHeadline: {
    color: noirTheme.primary,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 32,
    letterSpacing: -1.2,
    textTransform: 'uppercase',
  },
  sideCopy: {
    color: noirTheme.secondary,
    fontSize: 14,
    lineHeight: 22,
  },
  sideMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sideMetaText: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  sideMetaLine: {
    width: 42,
    height: 1,
    backgroundColor: noirTheme.outline,
  },
  formPanel: {
    backgroundColor: noirTheme.background,
    gap: 12,
    paddingBottom: 12,
  },
  header: {
    gap: 18,
  },
  title: {
    fontSize: 42,
    lineHeight: 42,
  },
  form: {
    marginTop: 24,
    gap: 22,
  },
  field: {
    gap: 10,
  },
  input: {
    color: noirTheme.ink,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    paddingVertical: 12,
  },
  loginButton: {
    marginTop: 8,
    minHeight: 64,
  },
});
