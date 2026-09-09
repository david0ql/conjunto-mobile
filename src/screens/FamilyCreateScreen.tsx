import React, { useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, PermissionsAndroid, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { launchCamera } from 'react-native-image-picker';
import { NavigationComponentProps } from 'react-native-navigation';
import { Eyebrow, NoirScreen, NoirTopBar, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { popScreen } from '../navigation/root';
import { createFamilyMember, ApiError } from '../services/api';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatBirthDate(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length === 0) return '';
  let out = digits.slice(0, 4);
  if (digits.length === 4) return `${out}-`;
  if (digits.length > 4) out += `-${digits.slice(4, 6)}`;
  if (digits.length === 6) return `${out}-`;
  if (digits.length > 6) out += `-${digits.slice(6, 8)}`;
  return out;
}

function isValidBirthDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function FamilyCreateScreen({ componentId }: NavigationComponentProps) {
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [document, setDocument] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ title: string; message: string } | null>(null);

  const isComplete =
    name.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    document.trim().length >= 4 &&
    isValidEmail(email) &&
    !!photoUri;

  async function handleTakePhoto() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de Cámara',
            message: 'La aplicación necesita acceso a la cámara para tomar la foto del familiar.',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          setFeedback({ title: 'Permiso denegado', message: 'No se puede usar la cámara sin permisos.' });
          return;
        }
      }

      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      setPhotoUri(result.assets[0].uri);
    } catch {
      setFeedback({ title: 'Error', message: 'No fue posible abrir la cámara.' });
    }
  }

  async function handleSubmit() {
    if (!isComplete || !photoUri) {
      setFeedback({
        title: 'Campos incompletos',
        message: 'Completa nombre, apellidos, documento, correo y toma la foto del familiar.',
      });
      return;
    }
    if (birthDate.trim() && !isValidBirthDate(birthDate.trim())) {
      setFeedback({
        title: 'Fecha inválida',
        message: 'Ingresa la fecha de nacimiento completa en formato AAAA-MM-DD.',
      });
      return;
    }
    setSubmitting(true);
    try {
      const result = await createFamilyMember({
        name: name.trim(),
        lastName: lastName.trim(),
        document: document.trim(),
        phone: phone.trim() || undefined,
        email: email.trim(),
        birthDate: birthDate.trim() || undefined,
        photo: { uri: photoUri, fileName: 'family-photo.jpg', type: 'image/jpeg' },
      });
      setGeneratedPassword(result.generatedPassword);
    } catch (error) {
      if (error instanceof ApiError) {
        setFeedback({ title: 'No se pudo crear', message: error.message || 'Verifica los datos e intenta de nuevo.' });
      } else {
        setFeedback({ title: 'Error de conexión', message: 'No se pudo conectar al servidor. Verifica tu red.' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <NoirScreen scroll={false}>
      <NoirTopBar leftIcon="arrow-back" onLeftPress={() => popScreen(componentId)} />

      <KeyboardAwareScrollView
        enableAutomaticScroll
        enableOnAndroid
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}>
        <Eyebrow>Nuevo miembro</Eyebrow>
        <Text style={styles.title}>Agregar{'\n'}familiar</Text>

        <Pressable onPress={handleTakePhoto} style={styles.photoPicker}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={styles.photoPreview} resizeMode="cover" />
          ) : (
            <View style={styles.photoPlaceholder}>
              <MaterialIcons color={noirTheme.secondary} name="camera-alt" size={32} />
              <Text style={styles.photoPlaceholderText}>Tomar foto</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Nombre</Text>
          <TextInput
            placeholder="Nombre"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Apellidos</Text>
          <TextInput
            placeholder="Apellidos"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Documento</Text>
          <TextInput
            placeholder="Cédula / documento"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={document}
            onChangeText={setDocument}
            keyboardType="number-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Fecha de nacimiento</Text>
          <TextInput
            placeholder="AAAA-MM-DD"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={birthDate}
            onChangeText={(text) => setBirthDate(formatBirthDate(text))}
            keyboardType="numeric"
            maxLength={10}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Teléfono</Text>
          <TextInput
            placeholder="Teléfono"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Correo</Text>
          <TextInput
            placeholder="correo@dominio.com"
            placeholderTextColor={noirTheme.surfaceHighest}
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
        </View>

        <View>
          <PrimaryButton
            label={submitting ? '' : 'Crear familiar'}
            onPress={handleSubmit}
            style={styles.submitButton}
            textStyle={submitting ? styles.hiddenLabel : undefined}
          />
          {submitting ? <ActivityIndicator color="#000" style={StyleSheet.absoluteFill} /> : null}
        </View>
      </KeyboardAwareScrollView>

      <Modal visible={!!generatedPassword} animationType="fade" transparent>
        <View style={styles.passwordOverlay}>
          <View style={styles.passwordCard}>
            <MaterialIcons color={noirTheme.primary} name="check-circle" size={40} />
            <Text style={styles.passwordTitle}>Familiar creado</Text>
            <Text style={styles.passwordDesc}>
              Comparte esta contraseña temporal con {name}. El acceso quedará activo cuando el administrador lo apruebe desde la web.
            </Text>
            <Text style={styles.passwordValue}>{generatedPassword}</Text>
            <PrimaryButton
              label="Entendido"
              onPress={() => {
                setGeneratedPassword(null);
                popScreen(componentId);
              }}
              style={styles.passwordButton}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={!!feedback} animationType="fade" transparent onRequestClose={() => setFeedback(null)}>
        <View style={styles.passwordOverlay}>
          <View style={styles.passwordCard}>
            <MaterialIcons color={noirTheme.secondary} name="error-outline" size={40} />
            <Text style={styles.passwordTitle}>{feedback?.title}</Text>
            <Text style={styles.passwordDesc}>{feedback?.message}</Text>
            <PrimaryButton
              label="Entendido"
              variant="ghost"
              onPress={() => setFeedback(null)}
              style={styles.passwordButton}
            />
          </View>
        </View>
      </Modal>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
    gap: 20,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
    lineHeight: 36,
  },
  photoPicker: {
    alignSelf: 'center',
    width: 140,
    height: 140,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    overflow: 'hidden',
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  photoPlaceholderText: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
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
    fontSize: 16,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    paddingVertical: 10,
  },
  submitButton: {
    marginTop: 8,
    minHeight: 60,
  },
  hiddenLabel: {
    display: 'none',
  },
  passwordOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  passwordCard: {
    width: '100%',
    backgroundColor: noirTheme.surfaceLow,
    padding: 28,
    alignItems: 'center',
    gap: 14,
  },
  passwordTitle: {
    color: noirTheme.primary,
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.6,
  },
  passwordDesc: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  passwordValue: {
    color: noirTheme.primary,
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 2,
  },
  passwordButton: {
    marginTop: 8,
    minHeight: 52,
    width: '100%',
  },
});
