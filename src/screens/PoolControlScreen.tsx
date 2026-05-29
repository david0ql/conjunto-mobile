import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NoirScreen, NoirTopBar, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import {
  createPoolEntry,
  getApartmentsByTower,
  getTowers,
  searchPoolResidents,
  searchVisitorByDocument,
  type ApartmentItem,
  type PoolResident,
  type Tower,
  type Visitor,
} from '../services/api';

function fullName(person?: { name?: string; lastName?: string } | null) {
  return `${person?.name ?? ''} ${person?.lastName ?? ''}`.trim() || '—';
}

export function PoolControlScreen() {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [residents, setResidents] = useState<PoolResident[]>([]);
  const [selectedTowerId, setSelectedTowerId] = useState('');
  const [selectedApartmentId, setSelectedApartmentId] = useState('');
  const [selectedResidentIds, setSelectedResidentIds] = useState<string[]>([]);
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [visitorDocument, setVisitorDocument] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingResidents, setLoadingResidents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const selectedTower = towers.find((tower) => tower.id === selectedTowerId);
  const selectedApartment = apartments.find((apartment) => apartment.id === selectedApartmentId);

  function loadInitial() {
    setLoading(true);
    getTowers()
      .then(setTowers)
      .catch(() => Alert.alert('Error', 'No fue posible cargar el control de piscina.'))
      .finally(() => setLoading(false));
  }

  function refresh() {
    setRefreshing(true);
    getTowers()
      .then(setTowers)
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }

  useEffect(() => {
    loadInitial();
  }, []);

  function selectTower(towerId: string) {
    setSelectedTowerId(towerId);
    setSelectedApartmentId('');
    setResidents([]);
    setSelectedResidentIds([]);
    getApartmentsByTower(towerId, 300)
      .then((response) => setApartments(response.data))
      .catch(() => Alert.alert('Error', 'No fue posible cargar apartamentos.'));
  }

  function selectApartment(apartmentId: string) {
    setSelectedApartmentId(apartmentId);
    setSelectedResidentIds([]);
    setResidents([]);
    setLoadingResidents(true);
    searchPoolResidents(apartmentId)
      .then((result) => setResidents(result.residents))
      .catch(() => Alert.alert('Error', 'No fue posible consultar residentes.'))
      .finally(() => setLoadingResidents(false));
  }

  function toggleResident(resident: PoolResident) {
    if (!resident.isActive) {
      Alert.alert(
        'Acceso no autorizado',
        `${fullName(resident)} no tiene acceso a la piscina. Debe comunicarse con el área administrativa.`,
      );
      return;
    }
    setSelectedResidentIds((current) =>
      current.includes(resident.id)
        ? current.filter((id) => id !== resident.id)
        : [...current, resident.id],
    );
  }

  async function addVisitor() {
    const document = visitorDocument.trim();
    if (!document) return;
    if (visitors.some((visitor) => visitor.document === document)) {
      setVisitorDocument('');
      return;
    }
    try {
      const result = await searchVisitorByDocument(document);
      if (!result.visitor) {
        Alert.alert('Visitante no registrado', 'El visitante debe estar registrado previamente en portería.');
        return;
      }
      setVisitors((current) => [...current, result.visitor!]);
      setVisitorDocument('');
    } catch {
      Alert.alert('Error', 'No fue posible consultar el visitante.');
    }
  }

  async function submitEntry() {
    if (!selectedApartmentId || selectedResidentIds.length === 0) {
      Alert.alert('Datos requeridos', 'Selecciona apartamento y al menos un residente activo.');
      return;
    }

    setSaving(true);
    try {
      await createPoolEntry({
        apartmentId: selectedApartmentId,
        residentIds: selectedResidentIds,
        guestDocuments: visitors.flatMap((visitor) => visitor.document ? [visitor.document] : []),
        notes: notes.trim() || undefined,
      });
      Alert.alert('Ingreso registrado', 'El ingreso a piscina fue registrado correctamente.');
      setSelectedResidentIds([]);
      setVisitors([]);
      setNotes('');
    } catch (error: any) {
      Alert.alert('No fue posible registrar', error?.message ?? 'Verifica los datos e intenta nuevamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <NoirScreen onRefresh={refresh} refreshing={refreshing}>
      <NoirTopBar />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>{'Registrar\ningreso'}</Text>
          <Text style={styles.helper}>Selecciona el apartamento, valida residentes activos y agrega visitantes por documento.</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={noirTheme.primary} />
        ) : (
          <>
            <View style={styles.section}>
              <Text style={styles.eyebrow}>Torre</Text>
              <View style={styles.chips}>
                {towers.map((tower) => (
                  <Pressable
                    key={tower.id}
                    onPress={() => selectTower(tower.id)}
                    style={[styles.chip, selectedTowerId === tower.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedTowerId === tower.id && styles.chipTextActive]}>
                      {tower.code || tower.name}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.eyebrow}>Apartamento</Text>
              {selectedTower ? <Text style={styles.helper}>{selectedTower.name}</Text> : null}
              <View style={styles.chips}>
                {apartments.map((apartment) => (
                  <Pressable
                    key={apartment.id}
                    onPress={() => selectApartment(apartment.id)}
                    style={[styles.apartmentChip, selectedApartmentId === apartment.id && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selectedApartmentId === apartment.id && styles.chipTextActive]}>
                      {apartment.number}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.eyebrow}>Residentes</Text>
                {selectedApartment ? <Text style={styles.helper}>Apt. {selectedApartment.number}</Text> : null}
              </View>
              {loadingResidents ? (
                <ActivityIndicator color={noirTheme.primary} />
              ) : residents.length === 0 ? (
                <Text style={styles.emptyText}>Selecciona un apartamento para ver residentes.</Text>
              ) : (
                <View style={styles.residentList}>
                  {residents.map((resident) => {
                    const selected = selectedResidentIds.includes(resident.id);
                    return (
                      <Pressable
                        key={resident.id}
                        onPress={() => toggleResident(resident)}
                        style={[
                          styles.residentRow,
                          selected && styles.residentRowActive,
                          !resident.isActive && styles.residentRowInactive,
                        ]}
                      >
                        <View style={styles.residentMain}>
                          <Text style={[styles.residentName, selected && styles.selectedText]}>
                            {fullName(resident)}
                          </Text>
                          <Text style={styles.residentDoc}>CC {resident.document}</Text>
                        </View>
                        <Text style={[styles.statusPill, resident.isActive ? styles.activePill : styles.inactivePill]}>
                          {resident.isActive ? 'Activo' : 'Inactivo'}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.eyebrow}>Visitantes</Text>
              <View style={styles.inputRow}>
                <TextInput
                  value={visitorDocument}
                  onChangeText={setVisitorDocument}
                  placeholder="Documento del visitante"
                  placeholderTextColor={noirTheme.surfaceHighest}
                  style={styles.input}
                  keyboardType="number-pad"
                />
                <Pressable onPress={addVisitor} style={styles.addButton}>
                  <MaterialIcons name="add" size={22} color="#000" />
                </Pressable>
              </View>
              <Text style={styles.helper}>Debe existir previamente en portería.</Text>
              {visitors.length > 0 ? (
                <View style={styles.visitorList}>
                  {visitors.map((visitor) => (
                    <View key={visitor.id} style={styles.visitorPill}>
                      <Text style={styles.visitorText}>{fullName(visitor)} · {visitor.document}</Text>
                      <Pressable onPress={() => setVisitors((current) => current.filter((item) => item.id !== visitor.id))}>
                        <MaterialIcons name="close" size={16} color={noirTheme.secondary} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            <View style={styles.section}>
              <Text style={styles.eyebrow}>Notas</Text>
              <TextInput
                value={notes}
                onChangeText={setNotes}
                placeholder="Observaciones del turno"
                placeholderTextColor={noirTheme.surfaceHighest}
                style={[styles.input, styles.textarea]}
                multiline
              />
            </View>

            <PrimaryButton
              label={saving ? 'Registrando...' : 'Confirmar ingreso'}
              onPress={saving ? undefined : submitEntry}
            />

          </>
        )}
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 22,
    paddingTop: 16,
    gap: 22,
  },
  header: {
    gap: 18,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 48,
    lineHeight: 48,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  eyebrow: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minWidth: 74,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  apartmentChip: {
    minWidth: 64,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  chipActive: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  chipText: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  chipTextActive: {
    color: '#000',
  },
  helper: {
    color: noirTheme.secondary,
    fontSize: 12,
    lineHeight: 18,
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 13,
    lineHeight: 20,
  },
  residentList: {
    gap: 8,
  },
  residentRow: {
    minHeight: 62,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  residentRowActive: {
    borderColor: noirTheme.primary,
  },
  residentRowInactive: {
    opacity: 0.72,
  },
  residentMain: {
    flex: 1,
    gap: 4,
  },
  residentName: {
    color: noirTheme.primary,
    fontSize: 15,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  selectedText: {
    color: noirTheme.primary,
  },
  residentDoc: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusPill: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  activePill: {
    color: '#000',
    backgroundColor: noirTheme.primary,
  },
  inactivePill: {
    color: '#fecaca',
    backgroundColor: '#3b1f1f',
  },
  inputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  input: {
    flex: 1,
    minHeight: 46,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    color: noirTheme.primary,
    paddingHorizontal: 14,
    fontSize: 14,
    fontWeight: '700',
  },
  textarea: {
    minHeight: 82,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  addButton: {
    width: 46,
    height: 46,
    backgroundColor: noirTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitorList: {
    gap: 8,
  },
  visitorPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    backgroundColor: noirTheme.surfaceHigh,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  visitorText: {
    flex: 1,
    color: noirTheme.ink,
    fontSize: 12,
    fontWeight: '800',
  },
});
