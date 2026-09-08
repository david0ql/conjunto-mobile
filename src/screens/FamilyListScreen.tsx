import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { Navigation, NavigationComponentProps } from 'react-native-navigation';
import { Eyebrow, NoirScreen, NoirTopBar, PrimaryButton } from '../components/NoirUI';
import { noirTheme } from '../design/theme';
import { PairingNebula } from '../components/PairingNebula';
import { pushScreen, popScreen } from '../navigation/root';
import { COMPONENTS } from '../navigation/componentNames';
import {
  getMyFamily,
  getMyApartments,
  getMemberQr,
  resolveImageUrl,
  type FamilyMember,
} from '../services/api';

function MemberPhotoModal({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  if (!uri) return null;
  return (
    <Modal visible={!!uri} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>Foto</Text>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <MaterialIcons color={noirTheme.primary} name="close" size={24} />
          </Pressable>
        </View>
        <View style={modalStyles.photoPreviewWrap}>
          <Image source={{ uri }} style={modalStyles.photoPreview} resizeMode="contain" />
        </View>
      </View>
    </Modal>
  );
}

function MemberAccessModal({
  member,
  apartmentId,
  onClose,
}: {
  member: FamilyMember | null;
  apartmentId: string | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'signature' | 'qr'>('signature');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  useEffect(() => {
    setQrDataUrl(null);
    setMode('signature');
    if (!member || !apartmentId) return;
    getMemberQr(apartmentId, member.id)
      .then((r) => setQrDataUrl(r.dataUrl))
      .catch(() => {});
  }, [member?.id, apartmentId]);

  if (!member) return null;

  return (
    <Modal visible={!!member} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Text style={modalStyles.title}>{member.name} {member.lastName}</Text>
          <Pressable onPress={onClose} style={modalStyles.closeBtn}>
            <MaterialIcons color={noirTheme.primary} name="close" size={24} />
          </Pressable>
        </View>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setMode('signature')}
            style={[styles.modePill, mode === 'signature' && styles.modePillActive]}>
            <Text style={[styles.modePillText, mode === 'signature' && styles.modePillTextActive]}>
              Firma viva
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setMode('qr')}
            style={[styles.modePill, mode === 'qr' && styles.modePillActive]}>
            <Text style={[styles.modePillText, mode === 'qr' && styles.modePillTextActive]}>
              Código QR
            </Text>
          </Pressable>
        </View>

        {mode === 'signature' ? (
          <View style={styles.signatureFrame}>
            <PairingNebula seed={`${member.id}|${member.document ?? ''}`} />
          </View>
        ) : (
          <View style={styles.qrFrame}>
            {qrDataUrl ? (
              <Image source={{ uri: qrDataUrl }} style={styles.qr} />
            ) : (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator color={noirTheme.surfaceHighest} size="large" />
              </View>
            )}
          </View>
        )}
      </View>
    </Modal>
  );
}

export function FamilyListScreen({ componentId }: NavigationComponentProps) {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [apartmentId, setApartmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [previewPhotoUri, setPreviewPhotoUri] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);

  function fetchFamily(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    Promise.all([getMyFamily(), getMyApartments()])
      .then(([list, apts]) => {
        setMembers(list);
        setApartmentId(apts[0]?.apartmentId ?? null);
      })
      .catch(() => {})
      .finally(() => { setLoading(false); setRefreshing(false); });
  }

  useEffect(() => {
    fetchFamily();
    const sub = Navigation.events().registerComponentDidAppearListener(({ componentId: appearedId }) => {
      if (appearedId === componentId) fetchFamily();
    });
    return () => sub.remove();
  }, [componentId]);

  return (
    <NoirScreen onRefresh={() => fetchFamily(true)} refreshing={refreshing}>
      <NoirTopBar leftIcon="arrow-back" onLeftPress={() => popScreen(componentId)} />

      <View style={styles.content}>
        <Eyebrow>Grupo del apartamento</Eyebrow>
        <Text style={styles.title}>Núcleo familiar</Text>

        {loading ? (
          <ActivityIndicator color={noirTheme.surfaceHighest} size="large" style={styles.loading} />
        ) : members.length === 0 ? (
          <View style={styles.empty}>
            <MaterialIcons color={noirTheme.surfaceHighest} name="groups" size={64} />
            <Text style={styles.emptyText}>Aún no has agregado familiares</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {members.map((member) => {
              const photoUri = resolveImageUrl(member.photoPath);
              return (
                <View key={member.id} style={styles.row}>
                  <Pressable
                    disabled={!photoUri}
                    onPress={() => photoUri && setPreviewPhotoUri(photoUri)}
                    style={styles.avatar}>
                    {photoUri ? (
                      <Image source={{ uri: photoUri }} style={styles.avatarImage} resizeMode="cover" />
                    ) : (
                      <MaterialIcons color={noirTheme.primary} name="person" size={26} />
                    )}
                  </Pressable>

                  <View style={styles.rowInfo}>
                    <Text style={styles.rowName} numberOfLines={2}>{member.name} {member.lastName}</Text>
                    {!member.isActive ? (
                      <Text style={styles.pendingBadge}>Pendiente de activación</Text>
                    ) : (
                      <Text style={styles.rowType}>{member.residentType?.name ?? 'Familiar'}</Text>
                    )}
                  </View>

                  <Pressable
                    disabled={!member.isActive}
                    onPress={() => setSelectedMember(member)}
                    style={[styles.qrButton, !member.isActive && styles.qrButtonDisabled]}>
                    <MaterialIcons
                      color={member.isActive ? noirTheme.primary : noirTheme.surfaceHighest}
                      name="qr-code"
                      size={22}
                    />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}

        <PrimaryButton
          label="Agregar familiar"
          onPress={() => pushScreen(componentId, COMPONENTS.familyCreate)}
          style={styles.addButton}
        />
      </View>

      <MemberPhotoModal uri={previewPhotoUri} onClose={() => setPreviewPhotoUri(null)} />
      <MemberAccessModal member={selectedMember} apartmentId={apartmentId} onClose={() => setSelectedMember(null)} />
    </NoirScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 24,
    paddingTop: 20,
    gap: 16,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
  },
  loading: {
    marginTop: 60,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingTop: 60,
  },
  emptyText: {
    color: noirTheme.secondary,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  list: {
    gap: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  avatar: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceHigh,
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  rowInfo: {
    flex: 1,
    gap: 4,
  },
  rowName: {
    color: noirTheme.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  rowType: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  pendingBadge: {
    color: noirTheme.surfaceHighest,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  qrButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  qrButtonDisabled: {
    opacity: 0.4,
  },
  addButton: {
    marginTop: 12,
    marginBottom: 20,
  },
  modeRow: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: 8,
    marginTop: 20,
  },
  modePill: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    backgroundColor: noirTheme.surfaceLow,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  modePillActive: {
    backgroundColor: noirTheme.primary,
    borderColor: noirTheme.primary,
  },
  modePillText: {
    color: noirTheme.secondary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  modePillTextActive: {
    color: '#000000',
  },
  signatureFrame: {
    margin: 24,
    aspectRatio: 1,
    backgroundColor: '#000104',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  qrFrame: {
    alignSelf: 'center',
    marginTop: 24,
    backgroundColor: '#ffffff',
    padding: 22,
  },
  qr: {
    width: 220,
    height: 220,
  },
  qrPlaceholder: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: noirTheme.surfaceHigh,
  },
});

const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: noirTheme.background,
  },
  photoPreviewWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: noirTheme.background,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 20,
    backgroundColor: noirTheme.surfaceLow,
  },
  title: {
    color: noirTheme.primary,
    fontSize: 22,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: -0.8,
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
