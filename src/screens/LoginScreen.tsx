import React from 'react';
import {
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

export function LoginScreen() {
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
            <Field label="Correo Electrónico" placeholder="usuario@monolith.res" />
            <Field label="Contraseña" placeholder="••••••••" secureTextEntry />

            <Pressable style={styles.rememberRow}>
              <View style={styles.checkbox} />
              <Text style={styles.smallLabel}>Recordarme</Text>
            </Pressable>

            <PrimaryButton
              label="Ingresar"
              onPress={() => {
                setShellRoot(COMPONENTS.homeNews);
              }}
              style={styles.loginButton}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </NoirScreen>
  );
}

function Field({
  label,
  placeholder,
  secureTextEntry,
}: {
  label: string;
  placeholder: string;
  secureTextEntry?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={noirTheme.surfaceHighest}
        secureTextEntry={secureTextEntry}
        style={styles.input}
      />
    </View>
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
  rememberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    alignSelf: 'flex-start',
  },
  checkbox: {
    width: 16,
    height: 16,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  smallLabel: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  loginButton: {
    marginTop: 8,
    minHeight: 64,
  },
});
