import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Divider, NoirScreen, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { loginResident, loginEmployee, ApiError } from '../services/api';
import { authStore } from '../context/auth.store';
import { callService } from '../realtime/calls/callService';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import { setPorteroRoot } from '../navigation/root';
import { useStableScreenLayout } from '../hooks/useStableScreenLayout';

export function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { hasLayout, layout, onLayout } = useStableScreenLayout();

  const measuredWidth = hasLayout ? layout.width : undefined;
  const measuredHeight = hasLayout ? layout.height : undefined;

  async function handleLogin() {
    const id = identifier.trim();
    const pw = password.trim();

    if (!id || !pw) {
      Alert.alert('Campos requeridos', 'Ingresa tu usuario/correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      const isEmail = id.includes('@');
      const response = isEmail
        ? await loginResident(id, pw)
        : await loginEmployee(id, pw);

      await authStore.setSession(response.accessToken, response.user);
      callService.start(response.accessToken);
      assemblyService.start(response.accessToken);

      if (response.user.type === 'employee') {
        setPorteroRoot();
      } else {
        setShellRoot(COMPONENTS.homeNews);
      }
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 403) {
          Alert.alert(
            'Sin apartamento asignado',
            'Tu cuenta no tiene un apartamento asignado aún. Contacta a la administración.',
          );
        } else if (error.status === 401) {
          Alert.alert('Credenciales incorrectas', 'Verifica tu usuario/correo y contraseña.');
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
      <View style={styles.container}>
        <KeyboardAwareScrollView
          enableAutomaticScroll
          enableOnAndroid
          contentContainerStyle={[
            styles.scrollContent,
            measuredHeight ? { minHeight: measuredHeight } : null,
          ]}
          keyboardShouldPersistTaps="handled"
          onLayout={onLayout}
          showsVerticalScrollIndicator={false}>
          <View
            style={[
              styles.content,
              measuredWidth ? { width: measuredWidth } : null,
              measuredHeight ? { minHeight: measuredHeight } : null,
            ]}>
            <View
              style={[
                styles.heroSlot,
                measuredHeight ? { minHeight: measuredHeight * 0.42 } : null,
              ]}>
              <View style={styles.heroCard}>
                <Text style={styles.sideBrand}>RESERVA DE LA LOMA</Text>
                <View style={styles.sideTextGroup}>
                  <Text style={styles.sideHeadline}>EL SILENCIO DEL LUJO.</Text>
                  <Text style={styles.sideCopy}>
                    Acceso exclusivo a la gestión residencial de vanguardia. Un
                    ecosistema diseñado para la discreción y el mando absoluto
                    sobre su entorno.
                  </Text>
                </View>
                <View style={styles.sideMeta}>
                  <Text style={styles.sideMetaText}>Requisitos de privacidad</Text>
                  <View style={styles.sideMetaLine} />
                  <Text style={styles.sideMetaText}>V.2.04</Text>
                </View>
              </View>
            </View>

            <View
              style={[
                styles.formSlot,
                measuredHeight ? { minHeight: measuredHeight * 0.58 } : null,
              ]}>
              <View style={styles.formPanel}>
                <View style={styles.header}>
                  <Text style={styles.title}>Iniciar{'\n'}sesión</Text>
                  <Divider />
                </View>

                <View style={styles.form}>
                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Usuario o correo</Text>
                    <TextInput
                      placeholder="portero01 o correo@dominio.com"
                      placeholderTextColor={noirTheme.surfaceHighest}
                      style={styles.input}
                      value={identifier}
                      onChangeText={setIdentifier}
                      autoCapitalize="none"
                      autoCorrect={false}
                      returnKeyType="next"
                    />
                  </View>

                  <View style={styles.field}>
                    <Text style={styles.fieldLabel}>Contraseña</Text>
                    <View>
                      <TextInput
                        placeholder="••••••••"
                        placeholderTextColor={noirTheme.surfaceHighest}
                        secureTextEntry={!showPassword}
                        style={[styles.input, { paddingRight: 40 }]}
                        value={password}
                        onChangeText={setPassword}
                        onSubmitEditing={handleLogin}
                        returnKeyType="done"
                      />
                      <Pressable
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}>
                        <MaterialIcons
                          name={showPassword ? 'visibility-off' : 'visibility'}
                          size={22}
                          color={noirTheme.surfaceHighest}
                        />
                      </Pressable>
                    </View>
                  </View>

                  <PrimaryButton
                    label={loading ? '' : 'Ingresar'}
                    onPress={handleLogin}
                    style={styles.loginButton}
                    textStyle={loading ? styles.hiddenButtonLabel : undefined}
                  />
                  {loading ? (
                    <ActivityIndicator
                      color="#000"
                      style={StyleSheet.absoluteFill}
                    />
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  heroSlot: {
    justifyContent: 'center',
    flexShrink: 1,
    paddingBottom: 24,
  },
  heroCard: {
    backgroundColor: noirTheme.surfaceLow,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 24,
    flexShrink: 1,
    gap: 28,
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
  formSlot: {
    justifyContent: 'center',
    flexShrink: 1,
  },
  header: {
    gap: 18,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: -1,
    lineHeight: 42,
    textTransform: 'uppercase',
  },
  form: {
    marginTop: 24,
    gap: 22,
  },
  field: {
    gap: 10,
  },
  fieldLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.4,
    textTransform: 'uppercase',
  },
  input: {
    color: noirTheme.ink,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    paddingVertical: 12,
  },
  eyeIcon: {
    position: 'absolute',
    right: 0,
    bottom: 8,
    padding: 4,
  },
  loginButton: {
    marginTop: 8,
    minHeight: 64,
  },
  hiddenButtonLabel: {
    display: 'none',
  },
});
