import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import {
  Eyebrow,
  Headline,
  NoirScreen,
  NoirTopBar,
  PrimaryButton,
} from '../components/NoirUI';
import { NavigationComponentProps } from 'react-native-navigation';
import { popScreen, setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import { noirTheme } from '../design/theme';

const timeSlots = ['09:00 - 13:00', '14:00 - 18:00', '19:00 - 23:00'] as const;

export function CreateReservationScreen({ componentId }: NavigationComponentProps) {
  const [attendees, setAttendees] = useState(4);
  const [slot, setSlot] = useState<(typeof timeSlots)[number]>(timeSlots[0]);

  return (
    <NoirScreen>
      <NoirTopBar
        onLeftPress={() => {
          popScreen(componentId);
        }}
        leftIcon="arrow-back"
      />

      <View style={styles.content}>
        <Eyebrow>Reservación de espacios</Eyebrow>
        <Headline style={styles.title}>Crear reserva</Headline>
        <View style={styles.divider} />

        <View style={styles.section}>
          <Eyebrow>01. Seleccionar fecha</Eyebrow>
          <View style={styles.inputCard}>
            <Text style={styles.dateValue}>2026-03-24</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Eyebrow>02. Asistentes</Eyebrow>
          <View style={styles.counterCard}>
            <CounterButton label="remove" onPress={() => setAttendees(value => Math.max(1, value - 1))} />
            <Text style={styles.counterValue}>{String(attendees).padStart(2, '0')}</Text>
            <CounterButton label="add" onPress={() => setAttendees(value => value + 1)} />
          </View>
        </View>

        <View style={styles.section}>
          <Eyebrow>03. Horario disponible</Eyebrow>
          <View style={styles.slotGrid}>
            {timeSlots.map(option => {
              const isSelected = slot === option;
              const disabled = option === timeSlots[2];
              return (
                <Pressable
                  key={option}
                  disabled={disabled}
                  onPress={() => setSlot(option)}
                  style={[
                    styles.slotCard,
                    isSelected && styles.slotSelected,
                    disabled && styles.slotDisabled,
                  ]}>
                  <Text style={[styles.slotLabel, isSelected && styles.slotLabelSelected]}>
                    {option === timeSlots[0] ? 'Mañana' : option === timeSlots[1] ? 'Tarde' : 'Noche'}
                  </Text>
                  <Text style={[styles.slotValue, isSelected && styles.slotValueSelected]}>{option}</Text>
                  {disabled ? <Text style={styles.unavailable}>No disponible</Text> : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Eyebrow>04. Notas adicionales</Eyebrow>
          <View style={styles.notesCard}>
            <TextInput
              multiline
              numberOfLines={4}
              placeholder="Detalles específicos para la reserva..."
              placeholderTextColor="rgba(255,255,255,0.24)"
              style={styles.notesInput}
            />
          </View>
        </View>

        <View style={styles.notice}>
          <MaterialIcons color={noirTheme.primary} name="info-outline" size={18} />
          <Text style={styles.noticeText}>
            Al confirmar esta reserva, usted acepta las políticas de uso del
            espacio y las normas de convivencia de MONOLITH.
          </Text>
        </View>

        <PrimaryButton
          label="Confirmar reserva"
          onPress={() => {
            setShellRoot(COMPONENTS.zonesBrowse);
          }}
          style={styles.confirmButton}
          textStyle={styles.confirmButtonLabel}
        />
      </View>
    </NoirScreen>
  );
}

function CounterButton({
  label,
  onPress,
}: {
  label: 'add' | 'remove';
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.counterButton}>
      <MaterialIcons color={noirTheme.primary} name={label} size={20} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 28,
  },
  title: {
    fontSize: 52,
    lineHeight: 52,
  },
  divider: {
    width: 96,
    height: 4,
    backgroundColor: noirTheme.primary,
    marginTop: -12,
  },
  section: {
    gap: 16,
  },
  inputCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 20,
  },
  dateValue: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '800',
  },
  counterCard: {
    backgroundColor: noirTheme.surfaceLow,
    minHeight: 76,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  counterButton: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  counterValue: {
    color: noirTheme.primary,
    fontSize: 30,
    fontWeight: '800',
  },
  slotGrid: {
    gap: 12,
  },
  slotCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    gap: 8,
  },
  slotSelected: {
    backgroundColor: noirTheme.primary,
  },
  slotDisabled: {
    opacity: 0.4,
  },
  slotLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  slotLabelSelected: {
    color: '#000000',
  },
  slotValue: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '800',
  },
  slotValueSelected: {
    color: '#000000',
  },
  unavailable: {
    color: '#ffb4ab',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  notesCard: {
    backgroundColor: noirTheme.surfaceLow,
    padding: 18,
    minHeight: 120,
  },
  notesInput: {
    color: noirTheme.primary,
    fontSize: 16,
    lineHeight: 24,
    textAlignVertical: 'top',
    minHeight: 96,
  },
  notice: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: noirTheme.surfaceLow,
    borderLeftWidth: 4,
    borderLeftColor: noirTheme.primary,
    padding: 18,
  },
  noticeText: {
    flex: 1,
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 21,
  },
  confirmButton: {
    minHeight: 74,
    marginBottom: 24,
  },
  confirmButtonLabel: {
    fontSize: 20,
    letterSpacing: 0,
  },
});
