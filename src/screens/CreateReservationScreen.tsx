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

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseDateParts(iso: string): { day: number; month: number; year: number } {
  const [y, m, d] = iso.split('-').map(Number);
  return { day: d, month: m, year: y };
}

function buildIso(day: number, month: number, year: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function daysInMonth(month: number, year: number): number {
  return new Date(year, month, 0).getDate();
}

export function CreateReservationScreen({ componentId, areaId, areaName }: Props) {
  const initial = parseDateParts(todayIso());
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);
  const [startHour, setStartHour] = useState(9);
  const [startMin, setStartMin] = useState(0);
  const [endHour, setEndHour] = useState(18);
  const [endMin, setEndMin] = useState(0);
  const [attendees, setAttendees] = useState(4);
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

    const startTime = `${String(startHour).padStart(2, '0')}:${String(startMin).padStart(2, '0')}`;
    const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`;

    if (startTime >= endTime) {
      Alert.alert('Horario inválido', 'La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }

    const pendingStatus = statuses.find(
      (s) => s.code === 'pending' || s.code === 'pendiente',
    ) ?? statuses[0];

    if (!pendingStatus) {
      Alert.alert('Error', 'No se pudo determinar el estado de la reserva.');
      return;
    }

    setLoading(true);
    try {
      await createReservation({
        residentId: user.id,
        areaId,
        reservationDate: buildIso(day, month, year),
        startTime,
        endTime,
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
          <Eyebrow>01. Fecha</Eyebrow>
          <DatePicker day={day} month={month} year={year} onDayChange={setDay} onMonthChange={setMonth} onYearChange={setYear} />
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
          <View style={styles.timeRow}>
            <TimePicker label="Desde" hour={startHour} minute={startMin} onHourChange={setStartHour} onMinuteChange={setStartMin} />
            <View style={styles.timeSeparator}>
              <Text style={styles.timeSeparatorText}>—</Text>
            </View>
            <TimePicker label="Hasta" hour={endHour} minute={endMin} onHourChange={setEndHour} onMinuteChange={setEndMin} />
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

const MINUTE_STEPS = [0, 15, 30, 45];

function TimePicker({
  label,
  hour,
  minute,
  onHourChange,
  onMinuteChange,
}: {
  label: string;
  hour: number;
  minute: number;
  onHourChange: (h: number) => void;
  onMinuteChange: (m: number) => void;
}) {
  function stepHour(delta: number) {
    onHourChange((hour + delta + 24) % 24);
  }
  function stepMinute(delta: number) {
    const idx = MINUTE_STEPS.indexOf(minute);
    const next = (idx + delta + MINUTE_STEPS.length) % MINUTE_STEPS.length;
    onMinuteChange(MINUTE_STEPS[next]);
  }

  return (
    <View style={styles.timeField}>
      <Text style={styles.timeLabel}>{label}</Text>
      <View style={styles.timePickerCard}>
        <View style={styles.timeUnit}>
          <Pressable onPress={() => stepHour(1)} style={styles.timeStepBtn}>
            <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-up" size={22} />
          </Pressable>
          <Text style={styles.timeDigit}>{String(hour).padStart(2, '0')}</Text>
          <Pressable onPress={() => stepHour(-1)} style={styles.timeStepBtn}>
            <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-down" size={22} />
          </Pressable>
        </View>
        <Text style={styles.timeColon}>:</Text>
        <View style={styles.timeUnit}>
          <Pressable onPress={() => stepMinute(1)} style={styles.timeStepBtn}>
            <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-up" size={22} />
          </Pressable>
          <Text style={styles.timeDigit}>{String(minute).padStart(2, '0')}</Text>
          <Pressable onPress={() => stepMinute(-1)} style={styles.timeStepBtn}>
            <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-down" size={22} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const MONTH_NAMES = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function DatePicker({
  day, month, year,
  onDayChange, onMonthChange, onYearChange,
}: {
  day: number; month: number; year: number;
  onDayChange: (d: number) => void;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}) {
  function stepDay(delta: number) {
    const max = daysInMonth(month, year);
    onDayChange(((day - 1 + delta + max) % max) + 1);
  }
  function stepMonth(delta: number) {
    const nm = ((month - 1 + delta + 12) % 12) + 1;
    onMonthChange(nm);
    const max = daysInMonth(nm, year);
    if (day > max) onDayChange(max);
  }
  function stepYear(delta: number) {
    const ny = year + delta;
    onYearChange(ny);
    const max = daysInMonth(month, ny);
    if (day > max) onDayChange(max);
  }

  return (
    <View style={styles.datePickerCard}>
      <View style={styles.dateUnit}>
        <Pressable onPress={() => stepDay(1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-up" size={22} />
        </Pressable>
        <Text style={styles.timeDigit}>{String(day).padStart(2, '0')}</Text>
        <Pressable onPress={() => stepDay(-1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-down" size={22} />
        </Pressable>
        <Text style={styles.dateUnitLabel}>DÍA</Text>
      </View>
      <View style={styles.dateUnit}>
        <Pressable onPress={() => stepMonth(1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-up" size={22} />
        </Pressable>
        <Text style={styles.timeDigit}>{MONTH_NAMES[month - 1]}</Text>
        <Pressable onPress={() => stepMonth(-1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-down" size={22} />
        </Pressable>
        <Text style={styles.dateUnitLabel}>MES</Text>
      </View>
      <View style={[styles.dateUnit, styles.dateUnitYear]}>
        <Pressable onPress={() => stepYear(1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-up" size={22} />
        </Pressable>
        <Text style={styles.timeDigit}>{year}</Text>
        <Pressable onPress={() => stepYear(-1)} style={styles.timeStepBtn}>
          <MaterialIcons color={noirTheme.primary} name="keyboard-arrow-down" size={22} />
        </Pressable>
        <Text style={styles.dateUnitLabel}>AÑO</Text>
      </View>
    </View>
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
  datePickerCard: {
    backgroundColor: noirTheme.surfaceLow,
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 0,
  },
  dateUnit: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  dateUnitYear: {
    flex: 1.4,
  },
  dateUnitLabel: {
    color: noirTheme.surfaceHighest,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginTop: 2,
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
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  timeField: {
    flex: 1,
    gap: 8,
  },
  timeLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  timePickerCard: {
    backgroundColor: noirTheme.surfaceLow,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    gap: 4,
  },
  timeUnit: {
    alignItems: 'center',
    gap: 2,
  },
  timeStepBtn: {
    width: 40,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeDigit: {
    color: noirTheme.primary,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
    lineHeight: 36,
  },
  timeColon: {
    color: noirTheme.primary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 2,
    lineHeight: 36,
  },
  timeSeparator: {
    paddingTop: 24,
  },
  timeSeparatorText: {
    color: noirTheme.surfaceHighest,
    fontSize: 22,
    fontWeight: '300',
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
