import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  PermissionsAndroid,
  Platform,
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
import { launchCamera } from 'react-native-image-picker';
import { noirTheme } from '../design/theme';
import { authStore } from '../context/auth.store';
import { callService } from '../realtime/calls/callService';
import { assemblyService } from '../realtime/assemblies/assemblyService';
import { setShellRoot } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import {
  getTowers,
  getApartmentsByTower,
  getPorterPackages,
  getPackagePhotos,
  createPorterPackage,
  markPorterPackageDelivered,
  resolveImageUrl,
  type Tower,
  type ApartmentItem,
  type PorterPackageItem,
  type PackagePhoto,
} from '../services/api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDateShort(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short' });
}

function getAptLabel(pkg: PorterPackageItem): string {
  const tower = pkg.apartment?.towerData?.name ?? '';
  const number = pkg.apartment?.number ?? '';
  if (!tower && !number) return '—';
  if (!tower) return `Apt. ${number}`;
  return `${tower} · ${number}`;
}

// ─── Package Row ──────────────────────────────────────────────────────────────

function PackageRow({
  pkg,
  onDeliver,
  onViewPhotos,
}: {
  pkg: PorterPackageItem;
  onDeliver: (pkg: PorterPackageItem) => void;
  onViewPhotos: (pkg: PorterPackageItem) => void;
}) {
  const pending = !pkg.delivered;
  const photoCount = pkg.photoCount ?? 0;

  return (
    <View style={[styles.pkgRow, pending ? styles.pkgRowPending : styles.pkgRowDelivered]}>
      {/* Status stripe */}
      <View style={[styles.pkgStripe, pending ? styles.pkgStripePending : styles.pkgStripeDelivered]} />

      <View style={styles.pkgContent}>
        {/* Header row */}
        <View style={styles.pkgHeader}>
          <View style={styles.pkgAptBadge}>
            <MaterialIcons
              name="apartment"
              size={11}
              color={pending ? '#f59e0b' : '#6ee7b7'}
            />
            <Text style={[styles.pkgAptText, pending ? styles.pkgAptTextPending : styles.pkgAptTextDelivered]}>
              {getAptLabel(pkg)}
            </Text>
          </View>
          <View style={[styles.statusBadge, pending ? styles.statusBadgePending : styles.statusBadgeDelivered]}>
            <Text style={[styles.statusBadgeText, pending ? styles.statusBadgeTextPending : styles.statusBadgeTextDelivered]}>
              {pending ? 'Pendiente' : 'Entregado'}
            </Text>
          </View>
        </View>

        {/* Description */}
        <Text style={styles.pkgDescription} numberOfLines={2}>
          {pkg.description?.trim() || 'Sin descripción'}
        </Text>

        {/* Resident */}
        {pkg.resident && (
          <Text style={styles.pkgResident}>
            {pkg.resident.name} {pkg.resident.lastName}
          </Text>
        )}

        {/* Dates */}
        <View style={styles.pkgDates}>
          <Text style={styles.pkgDateText}>
            Llegó: {formatDate(pkg.arrivalTime)}
          </Text>
          {pkg.deliveredTime && (
            <Text style={styles.pkgDateText}>
              Entregado: {formatDateShort(pkg.deliveredTime)}
            </Text>
          )}
          {pkg.deliveredByEmployee && (
            <Text style={styles.pkgDateText}>
              Por: {pkg.deliveredByEmployee.name} {pkg.deliveredByEmployee.lastName}
            </Text>
          )}
        </View>

        {/* Actions */}
        <View style={styles.pkgActions}>
          <TouchableOpacity style={styles.pkgActionBtn} onPress={() => onViewPhotos(pkg)}>
            <MaterialIcons name="photo-library" size={14} color={noirTheme.secondary} />
            <Text style={styles.pkgActionBtnText}>
              {photoCount > 0 ? `${photoCount} foto${photoCount !== 1 ? 's' : ''}` : 'Fotos'}
            </Text>
          </TouchableOpacity>

          {pending && (
            <TouchableOpacity
              style={[styles.pkgActionBtn, styles.pkgActionBtnDeliver]}
              onPress={() => onDeliver(pkg)}>
              <MaterialIcons name="check-circle-outline" size={14} color="#000" />
              <Text style={styles.pkgActionBtnDeliverText}>Marcar entrega</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Filter Tab ───────────────────────────────────────────────────────────────

type FilterValue = 'pending' | 'delivered' | 'all';

function FilterTabs({
  value,
  onChange,
  pendingCount,
  onOpenFilter,
  hasActiveFilters,
}: {
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  pendingCount: number;
  onOpenFilter: () => void;
  hasActiveFilters: boolean;
}) {
  const tabs: { key: FilterValue; label: string; badge?: number }[] = [
    { key: 'pending', label: 'Pendientes', badge: pendingCount > 0 ? pendingCount : undefined },
    { key: 'delivered', label: 'Entregados' },
    { key: 'all', label: 'Todos' },
  ];

  return (
    <View style={[styles.filterRow, { justifyContent: 'space-between', alignItems: 'center' }]}>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterTab, value === tab.key && styles.filterTabActive]}
            onPress={() => onChange(tab.key)}>
            <Text style={[styles.filterTabText, value === tab.key && styles.filterTabTextActive]}>
              {tab.label}
            </Text>
            {tab.badge !== undefined && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{tab.badge > 99 ? '99+' : tab.badge}</Text>
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onOpenFilter} style={{ position: 'relative', padding: 4 }}>
        <MaterialIcons name="filter-list" size={24} color={hasActiveFilters ? noirTheme.primary : noirTheme.secondary} />
        {hasActiveFilters && (
          <View style={{ position: 'absolute', top: 2, right: 2, width: 8, height: 8, borderRadius: 4, backgroundColor: noirTheme.primary }} />
        )}
      </TouchableOpacity>
    </View>
  );
}

// ─── Filter Packages Modal ─────────────────────────────────────────────────────

function FilterPackagesModal({
  visible,
  onClose,
  onApply,
  onClear,
  initialTowerId,
  initialApartmentId,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (towerId: string, apartmentId: string | undefined) => void;
  onClear: () => void;
  initialTowerId?: string;
  initialApartmentId?: string;
}) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [selectedApt, setSelectedApt] = useState<ApartmentItem | null>(null);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingApts, setLoadingApts] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingTowers(true);
    getTowers()
      .then((res) => {
        setTowers(res);
        if (initialTowerId) {
          const t = res.find((x) => x.id === initialTowerId);
          if (t) handleSelectTower(t, initialApartmentId);
        } else {
          setSelectedTower(null);
          setSelectedApt(null);
          setApartments([]);
        }
      })
      .catch(() => Alert.alert('Error', 'No fue posible cargar las torres.'))
      .finally(() => setLoadingTowers(false));
  }, [visible, initialTowerId, initialApartmentId]);

  function handleSelectTower(tower: Tower, preselectAptId?: string) {
    setSelectedTower(tower);
    setSelectedApt(null);
    setApartments([]);
    setLoadingApts(true);
    getApartmentsByTower(tower.id)
      .then((res) => {
        setApartments(res.data);
        if (preselectAptId) {
          const a = res.data.find((x) => x.id === preselectAptId);
          if (a) setSelectedApt(a);
        }
      })
      .catch(() => Alert.alert('Error', 'No fue posible cargar los apartamentos.'))
      .finally(() => setLoadingApts(false));
  }

  function handleApply() {
    if (selectedTower) {
      onApply(selectedTower.id, selectedApt?.id);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHandle} />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filtrar paquetes</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <MaterialIcons name="close" size={22} color={noirTheme.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.modalSectionLabel}>Torre</Text>
            {loadingTowers ? (
              <ActivityIndicator color={noirTheme.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.towerGrid}>
                {towers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.towerChip, selectedTower?.id === t.id && styles.towerChipActive]}
                    onPress={() => handleSelectTower(t)}>
                    <Text style={[styles.towerChipText, selectedTower?.id === t.id && styles.towerChipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {selectedTower && (
              <>
                <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>
                  Apartamento <Text style={{ fontSize: 12, color: noirTheme.secondary, fontWeight: '400', textTransform: 'none' }}>(opcional)</Text>
                </Text>
                {loadingApts ? (
                  <ActivityIndicator color={noirTheme.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <View style={styles.aptGrid}>
                    {apartments.map((a) => (
                      <TouchableOpacity
                        key={a.id}
                        style={[styles.aptCell, selectedApt?.id === a.id && styles.aptCellActive]}
                        onPress={() => setSelectedApt(a === selectedApt ? null : a)}>
                        <Text style={[styles.aptCellText, selectedApt?.id === a.id && styles.aptCellTextActive]}>
                          {a.number}
                        </Text>
                        {a.floor && (
                          <Text style={[styles.aptCellFloor, selectedApt?.id === a.id && styles.aptCellFloorActive]}>
                            Piso {a.floor}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            <View style={{ height: 24 }} />
            <TouchableOpacity
              style={[styles.submitBtn, !selectedTower && styles.submitBtnDisabled]}
              onPress={handleApply}
              disabled={!selectedTower}>
              <Text style={styles.submitBtnText}>Aplicar filtro</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.submitBtn, { backgroundColor: 'transparent', borderWidth: 1, borderColor: noirTheme.outline, marginTop: 12 }]}
              onPress={onClear}>
              <Text style={[styles.submitBtnText, { color: noirTheme.primary }]}>Limpiar filtros</Text>
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Create Package Modal ─────────────────────────────────────────────────────

function CreatePackageModal({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [towers, setTowers] = useState<Tower[]>([]);
  const [selectedTower, setSelectedTower] = useState<Tower | null>(null);
  const [apartments, setApartments] = useState<ApartmentItem[]>([]);
  const [selectedApt, setSelectedApt] = useState<ApartmentItem | null>(null);
  const [description, setDescription] = useState('');
  const [photo, setPhoto] = useState<{ uri: string; fileName: string; type: string } | null>(null);
  const [loadingTowers, setLoadingTowers] = useState(false);
  const [loadingApts, setLoadingApts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoadingTowers(true);
    getTowers()
      .then(setTowers)
      .catch(() => Alert.alert('Error', 'No fue posible cargar las torres.'))
      .finally(() => setLoadingTowers(false));
  }, [visible]);

  function handleSelectTower(tower: Tower) {
    setSelectedTower(tower);
    setSelectedApt(null);
    setApartments([]);
    setLoadingApts(true);
    getApartmentsByTower(tower.id)
      .then((res) => setApartments(res.data))
      .catch(() => Alert.alert('Error', 'No fue posible cargar los apartamentos.'))
      .finally(() => setLoadingApts(false));
  }

  function handleClose() {
    setSelectedTower(null);
    setSelectedApt(null);
    setApartments([]);
    setDescription('');
    setPhoto(null);
    setSubmitting(false);
    onClose();
  }

  async function handleTakePhoto() {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Permiso de Cámara',
            message: 'La aplicación necesita acceso a la cámara para tomar fotos de los paquetes.',
            buttonNeutral: 'Preguntar luego',
            buttonNegative: 'Cancelar',
            buttonPositive: 'OK',
          },
        );
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert('Permiso denegado', 'No se puede usar la cámara sin permisos.');
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
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        fileName: asset.fileName ?? `paquete_${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      });
    } catch {
      Alert.alert('Error', 'No fue posible abrir la cámara.');
    }
  }

  async function handleSubmit() {
    if (!selectedApt) {
      Alert.alert('Falta apartamento', 'Selecciona un apartamento.');
      return;
    }
    if (!photo) {
      Alert.alert('Foto requerida', 'Debes tomar una foto del paquete.');
      return;
    }
    setSubmitting(true);
    try {
      await createPorterPackage({
        apartmentId: selectedApt.id,
        description: description.trim() || undefined,
        photo,
      });
      handleClose();
      onCreated();
    } catch {
      Alert.alert('Error', 'No fue posible registrar el paquete.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          {/* Handle */}
          <View style={styles.modalHandle} />

          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Registrar paquete</Text>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseBtn}>
              <MaterialIcons name="close" size={22} color={noirTheme.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalScroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>

            {/* Torre selection */}
            <Text style={styles.modalSectionLabel}>Torre</Text>
            {loadingTowers ? (
              <ActivityIndicator color={noirTheme.primary} style={{ marginVertical: 12 }} />
            ) : (
              <View style={styles.towerGrid}>
                {towers.map((t) => (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.towerChip, selectedTower?.id === t.id && styles.towerChipActive]}
                    onPress={() => handleSelectTower(t)}>
                    <Text style={[styles.towerChipText, selectedTower?.id === t.id && styles.towerChipTextActive]}>
                      {t.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Apartment selection */}
            {selectedTower && (
              <>
                <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>Apartamento</Text>
                {loadingApts ? (
                  <ActivityIndicator color={noirTheme.primary} style={{ marginVertical: 12 }} />
                ) : (
                  <View style={styles.aptGrid}>
                    {apartments.map((apt) => (
                      <TouchableOpacity
                        key={apt.id}
                        style={[styles.aptCell, selectedApt?.id === apt.id && styles.aptCellActive]}
                        onPress={() => setSelectedApt(apt)}>
                        <Text style={[styles.aptCellText, selectedApt?.id === apt.id && styles.aptCellTextActive]}>
                          {apt.number}
                        </Text>
                        {apt.floor != null && (
                          <Text style={[styles.aptCellFloor, selectedApt?.id === apt.id && styles.aptCellFloorActive]}>
                            P{apt.floor}
                          </Text>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </>
            )}

            {/* Photo */}
            <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>
              Foto <Text style={styles.labelRequired}>(obligatorio)</Text>
            </Text>
            {photo ? (
              <View style={styles.photoPreviewContainer}>
                <Image source={{ uri: photo.uri }} style={styles.photoPreviewImg} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRetakeBtn} onPress={handleTakePhoto}>
                  <MaterialIcons name="camera-alt" size={16} color="#000" />
                  <Text style={styles.photoRetakeText}>Retomar</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto}>
                <MaterialIcons name="camera-alt" size={32} color={noirTheme.secondary} />
                <Text style={styles.cameraBtnText}>Tomar foto del paquete</Text>
              </TouchableOpacity>
            )}

            {/* Description */}
            <Text style={[styles.modalSectionLabel, { marginTop: 20 }]}>
              Descripción <Text style={styles.labelOptional}>(opcional)</Text>
            </Text>
            <TextInput
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              placeholder="Ej. caja mediana, sobre, pedido de farmacia..."
              placeholderTextColor={noirTheme.surfaceHighest}
              multiline
              numberOfLines={3}
              maxLength={300}
            />

            {/* Submit */}
            <TouchableOpacity
              style={[styles.submitBtn, (!selectedApt || !photo || submitting) && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!selectedApt || !photo || submitting}>
              {submitting ? (
                <ActivityIndicator color="#000" />
              ) : (
                <Text style={styles.submitBtnText}>Registrar paquete</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 32 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Deliver Confirm Modal ────────────────────────────────────────────────────

function DeliverModal({
  pkg,
  onClose,
  onDelivered,
}: {
  pkg: PorterPackageItem | null;
  onClose: () => void;
  onDelivered: () => void;
}) {
  const [photo, setPhoto] = useState<{ uri: string; fileName: string; type: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!pkg) setPhoto(null);
  }, [pkg]);

  async function handleTakePhoto() {
    try {
      const result = await launchCamera({
        mediaType: 'photo',
        quality: 0.7,
        maxWidth: 1920,
        maxHeight: 1920,
        saveToPhotos: false,
      });
      if (result.didCancel || !result.assets?.[0]?.uri) return;
      const asset = result.assets[0];
      setPhoto({
        uri: asset.uri,
        fileName: asset.fileName ?? `entrega_${Date.now()}.jpg`,
        type: asset.type ?? 'image/jpeg',
      });
    } catch {
      Alert.alert('Error', 'No fue posible abrir la cámara.');
    }
  }

  async function handleConfirm() {
    if (!pkg) return;
    if (!photo) {
      Alert.alert('Foto requerida', 'Debes tomar una foto como comprobante de entrega.');
      return;
    }
    setSubmitting(true);
    try {
      await markPorterPackageDelivered(pkg.id, photo);
      setPhoto(null);
      onDelivered();
    } catch {
      Alert.alert('Error', 'No fue posible marcar el paquete como entregado.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal visible={!!pkg} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, styles.modalSheetSmall]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Confirmar entrega</Text>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn} disabled={submitting}>
              <MaterialIcons name="close" size={22} color={noirTheme.secondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
            <View style={styles.deliverBody}>
              <View style={styles.deliverAptTag}>
                <MaterialIcons name="apartment" size={16} color={noirTheme.secondary} />
                <Text style={styles.deliverAptText}>{pkg ? getAptLabel(pkg) : ''}</Text>
              </View>

              <Text style={styles.deliverDescription}>
                {pkg?.description?.trim() || 'Sin descripción'}
              </Text>

              <Text style={styles.deliverDateText}>
                Llegó: {pkg ? formatDate(pkg.arrivalTime) : ''}
              </Text>

              {/* Photo */}
              <Text style={[styles.modalSectionLabel, { marginTop: 8 }]}>
                Foto de entrega <Text style={styles.labelRequired}>(obligatorio)</Text>
              </Text>
              {photo ? (
                <View style={styles.photoPreviewContainer}>
                  <Image source={{ uri: photo.uri }} style={styles.photoPreviewImg} resizeMode="cover" />
                  <TouchableOpacity style={styles.photoRetakeBtn} onPress={handleTakePhoto}>
                    <MaterialIcons name="camera-alt" size={16} color="#000" />
                    <Text style={styles.photoRetakeText}>Retomar</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.cameraBtn} onPress={handleTakePhoto}>
                  <MaterialIcons name="camera-alt" size={28} color={noirTheme.secondary} />
                  <Text style={styles.cameraBtnText}>Tomar foto de entrega</Text>
                </TouchableOpacity>
              )}

              <View style={styles.deliverNotice}>
                <MaterialIcons name="info-outline" size={14} color="#f59e0b" />
                <Text style={styles.deliverNoticeText}>
                  Esta acción marcará el paquete como entregado. Esta operación no se puede deshacer.
                </Text>
              </View>

              <View style={styles.deliverActions}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={submitting}>
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.confirmBtn, (!photo || submitting) && styles.submitBtnDisabled]}
                  onPress={handleConfirm}
                  disabled={!photo || submitting}>
                  {submitting ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={styles.submitBtnText}>Confirmar entrega</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Photos Modal ─────────────────────────────────────────────────────────────

function PhotosModal({
  pkg,
  onClose,
}: {
  pkg: PorterPackageItem | null;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<PackagePhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!pkg) return;
    setLoading(true);
    setPhotos([]);
    setActiveIndex(0);
    getPackagePhotos(pkg.id)
      .then(setPhotos)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [pkg?.id]);

  const deliveryPhoto = pkg?.deliveryPhotoPath
    ? resolveImageUrl(pkg.deliveryPhotoPath)
    : null;

  const allPhotos: Array<{ uri: string; label: string }> = [];
  if (deliveryPhoto) allPhotos.push({ uri: deliveryPhoto, label: 'Entrega' });
  photos.forEach((p) => {
    const uri = resolveImageUrl(p.filePath);
    if (uri) allPhotos.push({ uri, label: formatDateShort(p.createdAt) });
  });

  return (
    <Modal visible={!!pkg} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, styles.modalSheetTall]}>
          <View style={styles.modalHandle} />

          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Fotos del paquete</Text>
              <Text style={styles.modalSubtitle}>{pkg ? getAptLabel(pkg) : ''}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.modalCloseBtn}>
              <MaterialIcons name="close" size={22} color={noirTheme.secondary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.photosLoading}>
              <ActivityIndicator color={noirTheme.primary} size="large" />
            </View>
          ) : allPhotos.length === 0 ? (
            <View style={styles.photosEmpty}>
              <MaterialIcons name="photo-library" size={48} color={noirTheme.surfaceHighest} />
              <Text style={styles.photosEmptyText}>Sin fotos registradas</Text>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              {/* Main preview */}
              <View style={styles.photoPreviewWrap}>
                <Image
                  source={{ uri: allPhotos[activeIndex]?.uri }}
                  style={styles.photoPreview}
                  resizeMode="contain"
                />
                {allPhotos[activeIndex]?.label === 'Entrega' && (
                  <View style={styles.deliveryLabel}>
                    <Text style={styles.deliveryLabelText}>FOTO DE ENTREGA</Text>
                  </View>
                )}
              </View>

              {/* Thumbnail strip */}
              {allPhotos.length > 1 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.thumbStrip}
                  contentContainerStyle={styles.thumbStripContent}>
                  {allPhotos.map((photo, i) => (
                    <TouchableOpacity
                      key={i}
                      onPress={() => setActiveIndex(i)}
                      style={[styles.thumb, activeIndex === i && styles.thumbActive]}>
                      <Image source={{ uri: photo.uri }} style={styles.thumbImage} resizeMode="cover" />
                      {photo.label === 'Entrega' && (
                        <View style={styles.thumbDeliveryBadge}>
                          <MaterialIcons name="check" size={8} color="#fff" />
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.photoCounter}>
                {activeIndex + 1} / {allPhotos.length}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

export function PorteroPackagesScreen({ componentId: _componentId }: NavigationComponentProps) {
  const user = authStore.getUser();

  const [filter, setFilter] = useState<FilterValue>('pending');
  const [packages, setPackages] = useState<PorterPackageItem[]>([]);
  const [total, setTotal] = useState(0);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);
  const hasMoreRef = useRef(true);
  const loadingMoreRef = useRef(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [deliverTarget, setDeliverTarget] = useState<PorterPackageItem | null>(null);
  const [photosTarget, setPhotosTarget] = useState<PorterPackageItem | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterTowerId, setFilterTowerId] = useState<string | undefined>();
  const [filterApartmentId, setFilterApartmentId] = useState<string | undefined>();

  function buildParams(page: number) {
    return {
      page,
      limit: PAGE_SIZE,
      ...(filter === 'pending' ? { delivered: false } : filter === 'delivered' ? { delivered: true } : {}),
      ...(filterTowerId ? { towerId: filterTowerId } : {}),
      ...(filterApartmentId ? { apartmentId: filterApartmentId } : {}),
    };
  }

  const loadPackages = useCallback(
    (nextPage = 1, isRefresh = false) => {
      if (nextPage === 1) {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
      } else {
        loadingMoreRef.current = true;
        setLoadingMore(true);
      }

      getPorterPackages(buildParams(nextPage))
        .then((res) => {
          setPackages((prev) => (nextPage === 1 ? res.data : [...prev, ...res.data]));
          setTotal(res.meta.total);
          pageRef.current = res.meta.page;
          hasMoreRef.current = res.meta.page < res.meta.totalPages;
        })
        .catch(() => {})
        .finally(() => {
          setLoading(false);
          setRefreshing(false);
          loadingMoreRef.current = false;
          setLoadingMore(false);
        });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filter, filterTowerId, filterApartmentId],
  );

  // Load pending count for badge (always)
  useEffect(() => {
    getPorterPackages({ page: 1, limit: 1, delivered: false })
      .then((res) => setPendingTotal(res.meta.total))
      .catch(() => {});
  }, []);

  // Reload on filter change
  useEffect(() => {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadPackages(1);
  }, [loadPackages, filterTowerId, filterApartmentId]);

  function handleLoadMore() {
    if (loadingMoreRef.current || !hasMoreRef.current || loading || refreshing) return;
    loadPackages(pageRef.current + 1);
  }

  function handleRefresh() {
    pageRef.current = 1;
    hasMoreRef.current = true;
    loadPackages(1, true);
  }

  function handleFilterChange(v: FilterValue) {
    setFilter(v);
    setPackages([]);
    setTotal(0);
  }

  function handleDelivered() {
    setDeliverTarget(null);
    // Refresh pending count
    getPorterPackages({ page: 1, limit: 1, delivered: false })
      .then((res) => setPendingTotal(res.meta.total))
      .catch(() => {});
    handleRefresh();
  }

  function handleCreated() {
    // Refresh pending count
    getPorterPackages({ page: 1, limit: 1, delivered: false })
      .then((res) => setPendingTotal(res.meta.total))
      .catch(() => {});
    if (filter === 'pending' || filter === 'all') {
      handleRefresh();
    }
  }

  function handleLogout() {
    Alert.alert('Cerrar sesión', '¿Deseas salir de tu cuenta?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Salir',
        style: 'destructive',
        onPress: async () => {
          callService.stop();
          assemblyService.stop();
          await authStore.clearSession();
          setShellRoot(COMPONENTS.login);
        },
      },
    ]);
  }

  const renderItem = useCallback(
    ({ item }: { item: PorterPackageItem }) => (
      <PackageRow
        pkg={item}
        onDeliver={setDeliverTarget}
        onViewPhotos={setPhotosTarget}
      />
    ),
    [],
  );

  const keyExtractor = useCallback((item: PorterPackageItem) => item.id, []);

  const ListEmpty = loading ? null : (
    <View style={styles.emptyState}>
      <MaterialIcons name="inventory-2" size={52} color={noirTheme.surfaceHighest} />
      <Text style={styles.emptyStateText}>
        {filter === 'pending' ? 'Sin paquetes pendientes' : filter === 'delivered' ? 'Sin paquetes entregados' : 'Sin paquetes registrados'}
      </Text>
    </View>
  );

  const ListFooter = loadingMore ? (
    <View style={styles.loadingMore}>
      <ActivityIndicator color={noirTheme.secondary} size="small" />
    </View>
  ) : null;

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <Text style={styles.topBarBrand}>PORTERÍA</Text>
          <Text style={styles.topBarTitle}>Paquetería</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <MaterialIcons name="logout" size={20} color={noirTheme.secondary} />
        </TouchableOpacity>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>{filter === 'all' ? 'total' : filter === 'pending' ? 'pendientes' : 'entregados'}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, pendingTotal > 0 && styles.statValueWarning]}>{pendingTotal}</Text>
          <Text style={styles.statLabel}>sin entregar</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>{user?.name ?? '—'}</Text>
        </View>
      </View>

      {/* Filter tabs */}
      <FilterTabs
        value={filter}
        onChange={handleFilterChange}
        pendingCount={pendingTotal}
        onOpenFilter={() => setShowFilterModal(true)}
        hasActiveFilters={!!filterTowerId || !!filterApartmentId}
      />

      {/* List */}
      {loading && packages.length === 0 ? (
        <View style={styles.centerLoader}>
          <ActivityIndicator color={noirTheme.primary} size="large" />
          <Text style={styles.loadingText}>Cargando paquetes...</Text>
        </View>
      ) : (
        <FlatList
          data={packages}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshing={refreshing}
          onRefresh={handleRefresh}
          ListEmptyComponent={ListEmpty}
          ListFooterComponent={ListFooter}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={() => setShowCreate(true)}>
        <MaterialIcons name="add" size={28} color="#000" />
      </TouchableOpacity>

      {/* Modals */}
      <FilterPackagesModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        initialTowerId={filterTowerId}
        initialApartmentId={filterApartmentId}
        onApply={(tId, aId) => {
          setFilterTowerId(tId);
          setFilterApartmentId(aId);
          setShowFilterModal(false);
        }}
        onClear={() => {
          setFilterTowerId(undefined);
          setFilterApartmentId(undefined);
          setShowFilterModal(false);
        }}
      />
      <CreatePackageModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={handleCreated}
      />
      <DeliverModal
        pkg={deliverTarget}
        onClose={() => setDeliverTarget(null)}
        onDelivered={handleDelivered}
      />
      <PhotosModal
        pkg={photosTarget}
        onClose={() => setPhotosTarget(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },

  // Top bar
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
  logoutBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: noirTheme.surfaceLow,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  statValue: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  statValueWarning: {
    color: '#f59e0b',
  },
  statLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  statDivider: {
    width: 1,
    height: 20,
    backgroundColor: noirTheme.outline,
  },

  // Filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
  },
  filterTab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 6,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  filterTabActive: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  filterTabText: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  filterTabTextActive: {
    color: '#000',
  },
  filterBadge: {
    backgroundColor: '#f59e0b',
    borderRadius: 999,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#000',
    fontSize: 9,
    fontWeight: '900',
  },

  // List
  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 100,
  },
  centerLoader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    color: noirTheme.secondary,
    fontSize: 13,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: 12,
  },
  emptyStateText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
  },

  // Package row
  pkgRow: {
    flexDirection: 'row',
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
  },
  pkgRowPending: {
    backgroundColor: noirTheme.surfaceLow,
    borderColor: '#78350f',
  },
  pkgRowDelivered: {
    backgroundColor: noirTheme.surfaceLow,
    borderColor: noirTheme.outline,
  },
  pkgStripe: {
    width: 4,
  },
  pkgStripePending: {
    backgroundColor: '#f59e0b',
  },
  pkgStripeDelivered: {
    backgroundColor: '#6ee7b7',
  },
  pkgContent: {
    flex: 1,
    padding: 14,
    gap: 6,
  },
  pkgHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pkgAptBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: noirTheme.surfaceHigh,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 5,
  },
  pkgAptText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  pkgAptTextPending: {
    color: '#f59e0b',
  },
  pkgAptTextDelivered: {
    color: '#6ee7b7',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  statusBadgePending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.3)',
  },
  statusBadgeDelivered: {
    backgroundColor: 'rgba(110,231,183,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.25)',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  statusBadgeTextPending: {
    color: '#f59e0b',
  },
  statusBadgeTextDelivered: {
    color: '#6ee7b7',
  },
  pkgDescription: {
    color: noirTheme.primary,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  pkgResident: {
    color: noirTheme.secondary,
    fontSize: 12,
  },
  pkgDates: {
    gap: 2,
  },
  pkgDateText: {
    color: noirTheme.secondary,
    fontSize: 11,
    lineHeight: 16,
  },
  pkgActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  pkgActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 5,
    backgroundColor: noirTheme.surfaceHigh,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  pkgActionBtnText: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
  },
  pkgActionBtnDeliver: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  pkgActionBtnDeliverText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 28,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: noirTheme.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },

  // Modals shared
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: noirTheme.surfaceLow,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
    borderTopWidth: 1,
    borderColor: noirTheme.outline,
  },
  modalSheetSmall: {
    maxHeight: '80%',
  },
  modalSheetTall: {
    height: '80%',
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: noirTheme.surfaceHighest,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: noirTheme.outline,
  },
  modalTitle: {
    color: noirTheme.primary,
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.3,
    textTransform: 'uppercase',
  },
  modalSubtitle: {
    color: noirTheme.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScroll: {
    paddingHorizontal: 20,
  },

  // Create modal
  modalSectionLabel: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  labelOptional: {
    color: noirTheme.surfaceHighest,
    fontWeight: '400',
    letterSpacing: 0,
  },
  labelRequired: {
    color: '#f59e0b',
    fontWeight: '700',
    letterSpacing: 0,
  },
  cameraBtn: {
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: noirTheme.surfaceHigh,
    borderWidth: 1,
    borderColor: noirTheme.outline,
    borderStyle: 'dashed',
  },
  cameraBtnText: {
    color: noirTheme.secondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  photoPreviewContainer: {
    gap: 8,
  },
  photoPreviewImg: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    backgroundColor: noirTheme.surfaceHigh,
  },
  photoRetakeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: noirTheme.primary,
  },
  photoRetakeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  towerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  aptCell: {
    width: 64,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: noirTheme.surfaceHigh,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  aptCellActive: {
    backgroundColor: '#f59e0b',
    borderColor: '#f59e0b',
  },
  aptCellText: {
    color: noirTheme.secondary,
    fontSize: 13,
    fontWeight: '800',
  },
  aptCellTextActive: {
    color: '#000',
  },
  aptCellFloor: {
    color: noirTheme.secondary,
    fontSize: 9,
    marginTop: 2,
    fontWeight: '600',
  },
  aptCellFloorActive: {
    color: 'rgba(0,0,0,0.5)',
  },
  textArea: {
    backgroundColor: noirTheme.surfaceHigh,
    borderWidth: 1,
    borderColor: noirTheme.outline,
    borderRadius: 8,
    padding: 12,
    color: noirTheme.primary,
    fontSize: 14,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  submitBtn: {
    backgroundColor: noirTheme.primary,
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    minHeight: 52,
  },
  submitBtnDisabled: {
    opacity: 0.45,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },

  // Deliver modal
  deliverBody: {
    padding: 20,
    gap: 12,
  },
  deliverAptTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deliverAptText: {
    color: noirTheme.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  deliverDescription: {
    color: noirTheme.secondary,
    fontSize: 14,
    lineHeight: 20,
  },
  deliverDateText: {
    color: noirTheme.secondary,
    fontSize: 12,
  },
  deliverNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: 'rgba(245,158,11,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.2)',
    borderRadius: 8,
    padding: 10,
  },
  deliverNoticeText: {
    flex: 1,
    color: '#f59e0b',
    fontSize: 12,
    lineHeight: 18,
  },
  deliverActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: noirTheme.outline,
  },
  cancelBtnText: {
    color: noirTheme.secondary,
    fontSize: 13,
    fontWeight: '700',
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    backgroundColor: noirTheme.primary,
    minHeight: 52,
  },

  // Photos modal
  photosLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photosEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingBottom: 40,
  },
  photosEmptyText: {
    color: noirTheme.secondary,
    fontSize: 14,
  },
  photoPreviewWrap: {
    flex: 1,
    backgroundColor: '#000',
    position: 'relative',
  },
  photoPreview: {
    flex: 1,
    width: '100%',
  },
  deliveryLabel: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    backgroundColor: 'rgba(110,231,183,0.85)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deliveryLabelText: {
    color: '#000',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
  },
  thumbStrip: {
    flexShrink: 0,
    maxHeight: 72,
    borderTopWidth: 1,
    borderTopColor: noirTheme.outline,
  },
  thumbStripContent: {
    padding: 8,
    gap: 6,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 6,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbActive: {
    borderColor: noirTheme.primary,
  },
  thumbImage: {
    width: '100%',
    height: '100%',
  },
  thumbDeliveryBadge: {
    position: 'absolute',
    bottom: 3,
    right: 3,
    backgroundColor: '#6ee7b7',
    borderRadius: 999,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCounter: {
    color: noirTheme.secondary,
    fontSize: 11,
    textAlign: 'center',
    paddingVertical: 8,
    fontWeight: '600',
  },
});
