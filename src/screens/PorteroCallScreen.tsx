import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NavigationComponentProps } from 'react-native-navigation';
import { noirTheme } from '../design/theme';
import { callService } from '../realtime/calls/callService';
import { callStore } from '../realtime/calls/callStore';
import {
  getTowers,
  getApartmentsByTower,
  type Tower,
  type ApartmentItem,
} from '../services/api';

export function PorteroCallScreen({
  componentId: _componentId,
}: NavigationComponentProps) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [loadingTowers, setLoadingTowers] = useState(true);
  const [loadingApts, setLoadingApts] = useState(false);

  useEffect(() => {
    setLoadingTowers(true);
    getTowers()
      .then(setTowers)
      .catch(() => Alert.alert('Error', 'No fue posible cargar las torres.'))
      .finally(() => setLoadingTowers(false));
  }, []);

  function handleSelectTower(tower: Tower) {
    setSelectedTower(tower);
    setLoadingApts(true);
    setApartments([]);
    getApartmentsByTower(tower.id)
      .then(res => setApartments(res.data))
      .catch(() =>
        Alert.alert('Error', 'No fue posible cargar los apartamentos.'),
      )
      .finally(() => setLoadingApts(false));
  }

  async function handleCallApt(apt: ApartmentItem) {
    try {
      await callService.startApartmentCall(apt.id);
    } catch (error) {
      Alert.alert(
        'No fue posible llamar',
        error instanceof Error ? error.message : 'Intenta nuevamente.',
      );
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarBrand}>PORTERÍA</Text>
          <Text style={styles.topBarTitle}>Llamar</Text>
        </View>
      </View>

      {/* Tower selector */}
      {loadingTowers ? (
        <View style={styles.center}>
          <ActivityIndicator color={noirTheme.primary} />
        </View>
      ) : (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            contentContainerStyle={styles.towerScrollContent}
          >
            <View style={styles.towerRow}>
              {towers.map(t => (
                <TouchableOpacity
                  key={t.id}
                  style={[
                    styles.towerChip,
                    selectedTower?.id === t.id && styles.towerChipActive,
                  ]}
                  onPress={() => {
                    if (selectedTower?.id === t.id) {
                      setSelectedTower(null);
                      setApartments([]);
                    } else {
                      handleSelectTower(t);
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.towerChipText,
                      selectedTower?.id === t.id && styles.towerChipTextActive,
                    ]}
                  >
                    {t.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Apartment grid */}
      {selectedTower && (
        <>
          {loadingApts ? (
            <View style={styles.center}>
              <ActivityIndicator color={noirTheme.primary} size="large" />
            </View>
          ) : (
            <FlatList
              data={apartments}
              numColumns={4}
              columnWrapperStyle={styles.aptRow}
              contentContainerStyle={styles.aptGrid}
              keyExtractor={item => item.id}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.aptCell}
                  onPress={() => handleCallApt(item)}
                >
                  <MaterialIcons
                    name="phone-in-talk"
                    size={16}
                    color={noirTheme.primary}
                  />
                  <Text style={styles.aptNumber}>{item.number}</Text>
                  {item.floor != null && (
                    <Text style={styles.aptFloor}>Piso {item.floor}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  No hay apartamentos en esta torre.
                </Text>
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: noirTheme.surfaceLow,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
  },
  topBarLeft: {
    gap: 2,
  },
  topBarBrand: {
    color: noirTheme.secondary,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.8,
    textTransform: 'uppercase',
  },
  topBarTitle: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    textTransform: 'uppercase',
  },
  towerScrollContent: {
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    backgroundColor: noirTheme.surfaceLow,
  },
  towerRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
  },
  towerChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: noirTheme.surfaceHigh,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  towerChipActive: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  towerChipText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '700',
  },
  towerChipTextActive: {
    color: '#000',
  },
  aptGrid: {
    padding: 16,
    gap: 8,
  },
  aptRow: {
    gap: 8,
    marginBottom: 8,
  },
  aptCell: {
    flex: 1,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderRadius: 8,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  aptNumber: {
    color: noirTheme.primary,
    fontSize: 13,
    fontWeight: '800',
  },
  aptFloor: {
    color: noirTheme.secondary,
    fontSize: 9,
    fontWeight: '600',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 40,
  },
});
