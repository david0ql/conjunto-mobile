import React, { useEffect, useState } from 'react';
import {
  Alert,
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
import { popScreen } from '../navigation/root';
import { noirTheme } from '../design/theme';
import { authStore } from '../context/auth.store';
import {
  createReservation,
  getReservationStatuses,
  type ReservationStatus,
} from '../services/api';

interface Props extends NavigationComponentProps {
  areaId?: string;
  areaName?: string;
}

const TIME_SLOTS = [
  { label: 'Mañana', start: '09:00', end: '13:00' },
  { label: 'Tarde', start: '14:00', end: '18:00' },
  { label: 'Noche', start: '19:00', end: '23:00' },
] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function CreateReservationScreen({ componentId, areaId, areaName }: Props) {
  const [date, setDate] = useState(todayIso());
  const [attendees, setAttendees] = useState(4);
  const [slotIdx, setSlotIdx] = useState(0);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<ReservationStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  function fetchStatuses(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    getReservationStatuses()
      .then(setStatuses)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  useEffect(() => { fetchStatuses(); }, []);

  async function handleConfirm() {
    if (!areaId) {
      Alert.alert('Error', 'No se especificó el área a reservar.');
      return;
    }

    const user = authStore.getUser();
    if (!user) {
      Alert.alert('Error', 'Sesión expirada. Inicia sesión nuevamente.');
      return;
    }

    const pendingStatus = statuses.find(
      (s) => s.code === 'pending' || s.code === 'pendiente',
    ) ?? statuses[0];

    if (!pendingStatus) {
      Alert.alert('Error', 'No se pudo determinar el estado de la reserva.');
      return;
    }

    const slot = TIME_SLOTS[slotIdx];

    setLoading(true);
    try {
      await createReservation({
        residentId: user.id,
        areaId,
        reservationDate: date,
        startTime: slot.start,
        endTime: slot.end,
        statusId: pendingStatus.id,
        notesByResident: notes.trim() || undefined,
      });
      Alert.alert('Reserva creada', 'Tu solicitud fue enviada y está pendiente de aprobación.', [
        { text: 'OK', onPress: () => popScreen(componentId) },
      ]);
    } catch (error: any) {
      Alert.alert('Error', error?.message ?? 'No fue posible crear la reserva.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <NoirScreen onRefresh={() => fetchStatuses(true)} refreshing={refreshing}>
      <NoirTopBar
        onLeftPress={() => popScreen(componentId)}
        leftIcon="arrow-back"
      />

      <View style={styles.content}>
        <Eyebrow>Reservación de espacios</Eyebrow>
        <Headline style={styles.title}>Crear reserva</Headline>
        {areaName ? <Text style={styles.areaLabel}>{areaName}</Text> : null}
        <View style={styles.divider} />

        <View style={styles.section}>
          <Eyebrow>01. Fecha (YYYY-MM-DD)</Eyebrow>
          <View style={styles.inputCard}>
            <TextInput
              style={styles.dateInput}
              value={date}
              onChangeText={setDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={noirTheme.surfaceHighest}
              maxLength={10}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Eyebrow>02. Asistentes</Eyebrow>
          <View style={styles.counterCard}>
            <CounterButton label="remove" onPress={() => setAttendees((v) => Math.max(1, v - 1))} />
            <Text style={styles.counterValue}>{String(attendees).padStart(2, '0')}</Text>
            <CounterButton label="add" onPress={() => setAttendees((v) => v + 1)} />
          </View>
        </View>

        <View style={styles.section}>
          <Eyebrow>03. Horario</Eyebrow>
          <View style={styles.slotGrid}>
            {TIME_SLOTS.map((slot, idx) => {
              const isSelected = slotIdx === idx;
              return (
                <Pressable
                  key={slot.label}
                  onPress={() => setSlotIdx(idx)}
                  style={[styles.slotCard, isSelected && styles.slotSelected]}>
                  <Text style={[styles.slotLabel, isSelected && styles.slotLabelSelected]}>
                    {slot.label}
                  </Text>
                  <Text style={[styles.slotValue, isSelected && styles.slotValueSelected]}>
                    {slot.start} – {slot.end}
                  </Text>
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
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        </View>

        <View style={styles.notice}>
          <MaterialIcons color={noirTheme.primary} name="info-outline" size={18} />
          <Text style={styles.noticeText}>
            Al confirmar esta reserva, usted acepta las políticas de uso del
            espacio y las normas de convivencia de Reserva de la Loma.
          </Text>
        </View>

        <PrimaryButton
          label={loading ? 'Confirmando...' : 'Confirmar reserva'}
          onPress={handleConfirm}
          style={styles.confirmButton}
          textStyle={styles.confirmButtonLabel}
        />
      </View>
    </NoirScreen>
  );
}

function CounterButton({ label, onPress }: { label: 'add' | 'remove'; onPress: () => void }) {
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
  areaLabel: {
    color: noirTheme.secondary,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: -16,
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
  dateInput: {
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
