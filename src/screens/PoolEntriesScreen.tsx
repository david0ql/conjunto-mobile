import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { NoirScreen, NoirTopBar } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import {
  getApartmentsByTower,
  getPoolEntries,
  getTowers,
  type ApartmentItem,
  type PoolEntry,
  type Tower,
} from '../services/api';

const PAGE_SIZE = 15;

function formatDate(value: string) {
  return new Date(value).toLocaleString('es-CO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatName(person?: { name?: string; lastName?: string } | null) {
  return `${person?.name ?? ''} ${person?.lastName ?? ''}`.trim();
}

function apartmentLabel(entry: PoolEntry) {
  const tower = entry.apartment?.towerData?.name ?? (entry.apartment?.tower ? `Torre ${entry.apartment.tower}` : 'Torre');
  return `${tower} · Apt. ${entry.apartment?.number ?? '—'}`;
}

function residentNames(entry: PoolEntry) {
  const residents = entry.residents?.length
    ? entry.residents
    : entry.residentLinks?.map((link) => link.resident).filter(Boolean);
  return residents?.map(formatName).filter(Boolean).join(', ') || 'Sin residentes';
}

function guestNames(entry: PoolEntry) {
  return entry.guests?.map((guest) => guest.visitor ? formatName(guest.visitor) : guest.name).filter(Boolean).join(', ') || 'Sin visitantes';
}

export function PoolEntriesScreen() {
  const [entries, setEntries] = useState<PoolEntry[]>([]);
  const [towers, setTowers] = useState<Tower[]>([]);
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [filterTowerId, setFilterTowerId] = useState<string | undefined>();
  const [filterApartmentId, setFilterApartmentId] = useState<string | undefined>();
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  const selectedTower = towers.find((tower) => tower.id === filterTowerId);

  const loadEntries = useCallback((nextPage = 1, isRefresh = false) => {
    if (nextPage === 1) {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
    } else {
      loadingMoreRef.current = true;
      setLoadingMore(true);
    }

    getPoolEntries({
      page: nextPage,
      limit: PAGE_SIZE,
      towerId: filterTowerId,
      apartmentId: filterApartmentId,
    })
      .then((response) => {
        setEntries((current) => nextPage === 1 ? response.data : [...current, ...response.data]);
        setTotal(response.meta.total);
        pageRef.current = response.meta.page;
        hasMoreRef.current = response.meta.page < response.meta.totalPages;
      })
      .catch(() => Alert.alert('Error', 'No fue posible cargar los ingresos de piscina.'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
        loadingMoreRef.current = false;
        setLoadingMore(false);
      });
  }, [filterApartmentId, filterTowerId]);

  useEffect(() => {
    getTowers()
      .then(setTowers)
      .catch(() => {});
  }, []);

  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadEntries(1);
  }, [loadEntries]);

  function selectTower(towerId?: string) {
    setFilterTowerId(towerId);
    setFilterApartmentId(undefined);
    setApartments([]);
    if (!towerId) return;
    getApartmentsByTower(towerId, 300)
      .then((response) => setApartments(response.data))
      .catch(() => Alert.alert('Error', 'No fue posible cargar apartamentos.'));
  }

  function handleRefresh() {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadEntries(1, true);
  }

  function handleLoadMore() {
    if (loadingMoreRef.current || loading || refreshing || !hasMoreRef.current) return;
    loadEntries(pageRef.current + 1);
  }

  function renderEntry({ item }: { item: PoolEntry }) {
    return (
      <View style={styles.entryCard}>
        <View style={styles.entryHeader}>
          <View style={styles.entryIcon}>
            <MaterialIcons name="pool" size={18} color="#000" />
          </View>
          <View style={styles.entryTitleGroup}>
            <Text style={styles.entryTitle}>{apartmentLabel(item)}</Text>
            <Text style={styles.entryMeta}>{formatDate(item.entryTime)}</Text>
          </View>
          <Text style={styles.guestCount}>+{item.guestCount}</Text>
        </View>

        <View style={styles.entryBody}>
          <Text style={styles.entryLabel}>Residentes</Text>
          <Text style={styles.entryValue}>{residentNames(item)}</Text>
          <Text style={styles.entryLabel}>Visitantes</Text>
          <Text style={styles.entryValue}>{guestNames(item)}</Text>
          {item.notes ? (
            <>
              <Text style={styles.entryLabel}>Notas</Text>
              <Text style={styles.entryValue}>{item.notes}</Text>
            </>
          ) : null}
        </View>
      </View>
    );
  }

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={styles.header}>
        <Text style={styles.title}>{'Ingresos\npiscina'}</Text>
        <View style={styles.totalBox}>
          <Text style={styles.totalValue}>{total}</Text>
          <Text style={styles.totalLabel}>Registros</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.section}>
          <Text style={styles.eyebrow}>Torre</Text>
          <View style={styles.chips}>
            <Pressable
              onPress={() => selectTower(undefined)}
              style={[styles.chip, !filterTowerId && styles.chipActive]}
            >
              <Text style={[styles.chipText, !filterTowerId && styles.chipTextActive]}>Todas</Text>
            </Pressable>
            {towers.map((tower) => (
              <Pressable
                key={tower.id}
                onPress={() => selectTower(tower.id)}
                style={[styles.chip, filterTowerId === tower.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, filterTowerId === tower.id && styles.chipTextActive]}>
                  {tower.code || tower.name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {filterTowerId ? (
          <View style={styles.section}>
            <View style={styles.filterHeader}>
              <Text style={styles.eyebrow}>Apartamento</Text>
              <Text style={styles.helper}>{selectedTower?.name ?? 'Torre seleccionada'}</Text>
            </View>
            <View style={styles.chips}>
              <Pressable
                onPress={() => setFilterApartmentId(undefined)}
                style={[styles.apartmentChip, !filterApartmentId && styles.chipActive]}
              >
                <Text style={[styles.chipText, !filterApartmentId && styles.chipTextActive]}>Todos</Text>
              </Pressable>
              {apartments.map((apartment) => (
                <Pressable
                  key={apartment.id}
                  onPress={() => setFilterApartmentId(apartment.id)}
                  style={[styles.apartmentChip, filterApartmentId === apartment.id && styles.chipActive]}
                >
                  <Text style={[styles.chipText, filterApartmentId === apartment.id && styles.chipTextActive]}>
                    {apartment.number}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );

  const listEmpty = loading ? (
    <View style={styles.centerLoader}>
      <ActivityIndicator color={noirTheme.primary} size="large" />
      <Text style={styles.loadingText}>Cargando ingresos...</Text>
    </View>
  ) : (
    <View style={styles.emptyState}>
      <MaterialIcons name="event-busy" size={30} color={noirTheme.secondary} />
      <Text style={styles.emptyTitle}>Sin ingresos</Text>
      <Text style={styles.emptyText}>No hay registros para los filtros seleccionados.</Text>
    </View>
  );

  const listFooter = loadingMore ? (
    <View style={styles.footerLoader}>
      <ActivityIndicator color={noirTheme.primary} />
    </View>
  ) : null;

  return (
    <NoirScreen scroll={false}>
      <NoirTopBar />
      <View style={styles.content}>
        <FlatList
          data={entries}
          renderItem={renderEntry}
          keyExtractor={(item) => item.id}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={listFooter}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  list: {
    flex: 1,
  },
  listHeader: {
    gap: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 14,
  },
  title: {
    flex: 1,
    color: noirTheme.primary,
    fontSize: 46,
    lineHeight: 46,
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
  totalBox: {
    minWidth: 90,
    backgroundColor: noirTheme.surfaceLow,
    padding: 14,
    alignItems: 'flex-end',
  },
  totalValue: {
    color: noirTheme.primary,
    fontSize: 26,
    fontWeight: '900',
  },
  totalLabel: {
    color: noirTheme.secondary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  filters: {
    gap: 18,
  },
  section: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  helper: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
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
    minWidth: 62,
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
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  listContent: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 28,
    gap: 12,
  },
  entryCard: {
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 14,
    gap: 14,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  entryIcon: {
    width: 34,
    height: 34,
    backgroundColor: noirTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryTitleGroup: {
    flex: 1,
    gap: 3,
  },
  entryTitle: {
    color: noirTheme.primary,
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  entryMeta: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  guestCount: {
    color: noirTheme.primary,
    fontSize: 18,
    fontWeight: '900',
  },
  entryBody: {
    gap: 5,
  },
  entryLabel: {
    marginTop: 4,
    color: noirTheme.secondary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  entryValue: {
    color: noirTheme.ink,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '700',
  },
  footerLoader: {
    paddingVertical: 18,
  },
  emptyState: {
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 24,
  },
  emptyTitle: {
    color: noirTheme.primary,
    fontSize: 18,
    fontWeight: '900',
    textTransform: 'uppercase',
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
});
