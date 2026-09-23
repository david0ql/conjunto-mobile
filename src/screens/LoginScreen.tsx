import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { BIOMETRY_TYPE } from 'react-native-keychain';
import { Divider, NoirScreen, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { setPoolRoot, setPorteroRoot, setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import {
  loginResident,
  loginEmployee,
  requestPasswordResetByEmail,
  canUseBiometricLogin,
  ApiError,
} from '../services/api';
import { authStore } from '../context/auth.store';
import { callService } from '../realtime/calls/callService';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import { useStableScreenLayout } from '../hooks/useStableScreenLayout';
import { credentialsStore } from '../services/credentials.store';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type ForgotStatus = 'idle' | 'loading' | 'success' | 'error';

function biometryIconName(type: BIOMETRY_TYPE | null): string {
  if (type === BIOMETRY_TYPE.FACE_ID || type === BIOMETRY_TYPE.FACE) {
    return 'face';
  }
  return 'fingerprint';
}

function biometryLabel(type: BIOMETRY_TYPE | null): string {
  if (type === BIOMETRY_TYPE.FACE_ID || type === BIOMETRY_TYPE.FACE) {
    return 'Face ID';
  }
  if (type === BIOMETRY_TYPE.IRIS) {
    return 'iris';
  }
  return 'huella';
}

export function LoginScreen() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [biometryType, setBiometryType] = useState<BIOMETRY_TYPE | null>(null);
  const [biometricLoginAvailable, setBiometricLoginAvailable] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<ForgotStatus>('idle');
  const [forgotMessage, setForgotMessage] = useState('');
  const { hasLayout, layout, onLayout } = useStableScreenLayout();

  const measuredWidth = hasLayout ? layout.width : undefined;
  const measuredHeight = hasLayout ? layout.height : undefined;

  useEffect(() => {
    (async () => {
      const saved = await credentialsStore.get();
      if (saved) {
        setIdentifier(saved.identifier);
        setPassword(saved.password);
        setRememberMe(true);
      }

      const supportedBiometry = await credentialsStore.getSupportedBiometryType();
      setBiometryType(supportedBiometry);
      if (supportedBiometry) {
        const hasBiometricCreds = await credentialsStore.hasBiometricCredentials();
        setBiometricLoginAvailable(hasBiometricCreds);
      }
    })();
  }, []);

  async function performLogin(id: string, pw: string, forceRemember?: boolean) {
    setLoading(true);
    try {
      const isEmail = id.includes('@');
      const response = isEmail
        ? await loginResident(id, pw)
        : await loginEmployee(id, pw);

      await authStore.setSession(response.accessToken, response.user);

      // Biometric eligibility depends on the account's role (porters commonly
      // share one login with no individual user), which is only known once
      // the API responds — so the "save password / enable biometric" ask
      // happens here, right after a successful login, not before it.
      const allowBiometric = !!biometryType && canUseBiometricLogin(response.user);
      let remember = forceRemember ?? rememberMe;
      let enableBiometric = false;

      if (allowBiometric && !biometricLoginAvailable) {
        enableBiometric = await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Guardar contraseña',
            `¿Deseas guardar tu contraseña e iniciar sesión con ${biometryLabel(biometryType)} la próxima vez?`,
            [
              { text: 'Ahora no', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Sí, guardar', onPress: () => resolve(true) },
            ],
          );
        });
        if (enableBiometric) {
          remember = true;
          setRememberMe(true);
        }
      }

      if (remember) {
        await credentialsStore.save(id, pw);
        if (allowBiometric && enableBiometric) {
          await credentialsStore.saveBiometric(id, pw);
          setBiometricLoginAvailable(true);
        } else if (!allowBiometric) {
          // Shared porter account: never leave a stale biometric entry that
          // would let anyone's fingerprint on this device unlock it.
          await credentialsStore.clearBiometric();
          setBiometricLoginAvailable(false);
        }
      } else {
        await credentialsStore.clear();
        await credentialsStore.clearBiometric();
        setBiometricLoginAvailable(false);
      }

      // Navigate away from the login screen first: callService/assemblyService
      // trigger native permission prompts (notifications, calls) in the
      // background, and letting one of those dialogs show while this screen's
      // root transition is still in flight can drop the transition, leaving
      // the user stuck on Login needing to sign in again.
      if (response.user.type === 'employee') {
        if (response.user.role === 'pool_attendant') {
          setPoolRoot();
        } else {
          setPorteroRoot();
        }
      } else {
        setShellRoot(COMPONENTS.homeNews);
      }

      callService.start(response.accessToken);
      assemblyService.start(response.accessToken);
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

  async function handleLogin() {
    const id = identifier.trim();
    const pw = password.trim();

    if (!id || !pw) {
      Alert.alert('Campos requeridos', 'Ingresa tu usuario/correo y contraseña.');
      return;
    }

    // Whether to ask about saving the password with biometric login depends
    // on the account's role, known only after login succeeds — see
    // performLogin.
    await performLogin(id, pw);
  }

  async function handleBiometricLogin() {
    const saved = await credentialsStore.getBiometric(
      `Inicia sesión con tu ${biometryLabel(biometryType)}`,
    );
    if (!saved) return;

    setIdentifier(saved.identifier);
    setPassword(saved.password);
    setRememberMe(true);
    await performLogin(saved.identifier, saved.password, true);
  }

  function openForgotPassword() {
    setForgotEmail(identifier.includes('@') ? identifier.trim() : '');
    setForgotStatus('idle');
    setForgotMessage('');
    setForgotVisible(true);
  }

  function closeForgotPassword() {
    setForgotVisible(false);
  }

  async function handleForgotSubmit() {
    const email = forgotEmail.trim();
    if (!isValidEmail(email)) {
      setForgotStatus('error');
      setForgotMessage('Ingresa un correo válido.');
      return;
    }

    setForgotStatus('loading');
    try {
      await requestPasswordResetByEmail(email);
      setForgotStatus('success');
      setForgotMessage(
        'Se realizó el envío del correo de cambio de contraseña. Revisa tu bandeja de entrada.',
      );
    } catch (error) {
      setForgotStatus('error');
      if (error instanceof ApiError && error.status === 404) {
        setForgotMessage('El correo no está asociado a ningún usuario.');
      } else if (error instanceof ApiError) {
        setForgotMessage(error.message || 'No fue posible procesar la solicitud.');
      } else {
        setForgotMessage('No se pudo conectar al servidor. Verifica tu red.');
      }
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

                  <View style={styles.optionsRow}>
                    <Pressable
                      style={styles.rememberRow}
                      onPress={() => setRememberMe(!rememberMe)}>
                      <MaterialIcons
                        name={rememberMe ? 'check-box' : 'check-box-outline-blank'}
                        size={20}
                        color={rememberMe ? noirTheme.primary : noirTheme.surfaceHighest}
                      />
                      <Text style={styles.rememberLabel}>Recordar contraseña</Text>
                    </Pressable>

                    <Pressable onPress={openForgotPassword} style={styles.forgotRow}>
                      <Text style={styles.forgotLabel}>¿Olvidaste tu contraseña?</Text>
                    </Pressable>
                  </View>

                  <View style={styles.loginButtonRow}>
                    <View style={styles.loginButtonWrap}>
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

                    {biometricLoginAvailable ? (
                      <Pressable
                        style={styles.biometricButton}
                        onPress={handleBiometricLogin}
                        disabled={loading}
                        accessibilityLabel={`Iniciar sesión con ${biometryLabel(biometryType)}`}>
                        <MaterialIcons
                          name={biometryIconName(biometryType)}
                          size={30}
                          color={noirTheme.primary}
                        />
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              </View>
            </View>
          </View>
        </KeyboardAwareScrollView>
      </View>

      <Modal
        visible={forgotVisible}
        animationType="fade"
        transparent
        onRequestClose={closeForgotPassword}>
        <View style={styles.forgotOverlay}>
          <View style={styles.forgotCard}>
            {forgotStatus === 'success' ? (
              <>
                <MaterialIcons color={noirTheme.primary} name="mark-email-read" size={40} />
                <Text style={styles.forgotTitle}>Correo enviado</Text>
                <Text style={styles.forgotDesc}>{forgotMessage}</Text>
                <PrimaryButton
                  label="Entendido"
                  onPress={closeForgotPassword}
                  style={styles.forgotButton}
                />
              </>
            ) : (
              <>
                <MaterialIcons color={noirTheme.primary} name="lock-reset" size={40} />
                <Text style={styles.forgotTitle}>Recuperar contraseña</Text>
                <Text style={styles.forgotDesc}>
                  Escribe tu correo registrado y te enviaremos un enlace para cambiar tu
                  contraseña.
                </Text>
                <TextInput
                  placeholder="correo@dominio.com"
                  placeholderTextColor={noirTheme.surfaceHighest}
                  style={styles.forgotInput}
                  value={forgotEmail}
                  onChangeText={(value) => {
                    setForgotEmail(value);
                    if (forgotStatus === 'error') {
                      setForgotStatus('idle');
                      setForgotMessage('');
                    }
                  }}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  editable={forgotStatus !== 'loading'}
                />
                {forgotStatus === 'error' ? (
                  <Text style={styles.forgotError}>{forgotMessage}</Text>
                ) : null}
                <View style={styles.forgotActions}>
                  <Pressable
                    onPress={closeForgotPassword}
                    style={styles.forgotCancel}
                    disabled={forgotStatus === 'loading'}>
                    <Text style={styles.forgotCancelLabel}>Cancelar</Text>
                  </Pressable>
                  <View style={styles.forgotSubmitWrap}>
                    <PrimaryButton
                      label={forgotStatus === 'loading' ? '' : 'Enviar'}
                      onPress={handleForgotSubmit}
                      style={styles.forgotButton}
                      textStyle={forgotStatus === 'loading' ? styles.hiddenButtonLabel : undefined}
                    />
                    {forgotStatus === 'loading' ? (
                      <ActivityIndicator color="#000" style={StyleSheet.absoluteFill} />
                    ) : null}
                  </View>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rememberLabel: {
    color: noirTheme.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
  loginButtonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    marginTop: 8,
  },
  loginButtonWrap: {
    flex: 1,
  },
  loginButton: {
    minHeight: 64,
  },
  biometricButton: {
    width: 64,
    minHeight: 64,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: noirTheme.outline,
    backgroundColor: noirTheme.surfaceLow,
  },
  hiddenButtonLabel: {
    display: 'none',
  },
  optionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: -8,
  },
  forgotRow: {
    paddingVertical: 2,
  },
  forgotLabel: {
    color: noirTheme.primary,
    fontSize: 13,
    fontWeight: '700',
  },
  forgotOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  forgotCard: {
    width: '100%',
    backgroundColor: noirTheme.surfaceLow,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  forgotTitle: {
    color: noirTheme.primary,
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.6,
  },
  forgotDesc: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  forgotInput: {
    width: '100%',
    color: noirTheme.ink,
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    paddingVertical: 10,
    textAlign: 'center',
  },
  forgotError: {
    color: '#d64545',
    fontSize: 12,
    textAlign: 'center',
  },
  forgotActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  forgotCancel: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  forgotCancelLabel: {
    color: noirTheme.secondary,
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  forgotSubmitWrap: {
    flex: 1,
  },
  forgotButton: {
    minHeight: 52,
    width: '100%',
  },
});
