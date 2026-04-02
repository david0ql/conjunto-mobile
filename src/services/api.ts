/**
 * API service for Conjunto mobile app.
 * Uses the built-in fetch API — no additional native dependencies required.
 */

import { authStore } from '../context/auth.store';

// Update this to match your local API address:
// - iOS Simulator: http://localhost:3000
// - Android Emulator: http://10.0.2.2:3000
// - Physical device: http://<YOUR_MACHINE_IP>:3000
export const API_BASE = 'https://api-conjunto.nordikhat.com/api/v1';
export const REALTIME_URL = API_BASE.replace(/\/api\/v1$/, '');

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionUser {
  id: string;
  name: string;
  lastName: string;
  type: 'resident' | 'employee';
  permissions: string[];
  email?: string | null;
  phone?: string | null;
  document?: string | null;
  residentType?: string;
  residentTypeLabel?: string;
  role?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: SessionUser;
}

export interface NewsItem {
  id: string;
  title: string;
  content: string;
  publishedAt: string;
  imageUrl?: string | null;
  categoryId: string;
  createdAt: string;
  category?: { id: string; name: string };
  createdByEmployee?: { id: string; name: string; lastName: string };
}

export interface CommonArea {
  id: string;
  name: string;
  maxCapacity?: number | null;
  createdAt: string;
}

export interface ReservationStatus {
  id: string;
  code: string;
  name: string;
}

export interface Reservation {
  id: string;
  residentId: string;
  areaId: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  statusId: string;
  notesByResident?: string | null;
  createdAt: string;
  area?: CommonArea;
  status?: ReservationStatus;
}

export interface NotificationItem {
  id: string;
  apartmentId?: string | null;
  residentId?: string | null;
  notificationTypeId: string;
  message: string;
  isRead: boolean;
  createdAt: string;
  apartment?: {
    id: string;
    number: string;
    tower?: string | null;
    towerData?: { id: string; code: string; name: string } | null;
  } | null;
  notificationType?: {
    id: string;
    code?: string;
    name: string;
  } | null;
}

export interface PackageItem {
  id: string;
  description?: string | null;
  arrivalTime: string;
  delivered: boolean;
  deliveredTime?: string | null;
  apartment?: { number: string; towerData?: { name: string } };
}

export interface CommunitySpace {
  id: string;
  name: string;
  phase: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AccessEntry {
  id: string;
  entryTime: string;
  exitTime?: string | null;
  notes?: string | null;
  visitor?: { id: string; name: string; lastName: string } | null;
  vehicle?: { id: string; plate: string } | null;
  authorizedByEmployee?: { id: string; name: string; lastName: string } | null;
}

export interface ResidentApartment {
  id: string;
  residentId: string;
  apartmentId: string;
  apartment?: {
    id: string;
    number: string;
    floor?: number | null;
    towerData?: { id: string; name: string; code: string };
  };
}

export interface ResidentProfile {
  id: string;
  name: string;
  lastName: string;
  document?: string | null;
  phone?: string | null;
  email?: string | null;
  apartmentId?: string | null;
  apartment?: {
    id: string;
    number: string;
    floor?: number | null;
    towerData?: { name: string; code: string };
  } | null;
}

export interface CallsIceConfigResponse {
  iceServers: Array<{
    urls: string | string[];
    username?: string;
    credential?: string;
  }>;
}

export interface PorterAvailability {
  id: string;
  username: string;
  name: string;
  lastName: string;
  available: boolean;
  status?: 'available' | 'busy';
  currentCall?: {
    callId: string;
    direction: 'outbound' | 'inbound' | 'internal';
    status: 'ringing' | 'active';
    withType: 'resident' | 'employee' | 'apartment';
    withLabel: string;
    apartment: {
      id: string;
      number: string;
      floor: number | null;
      tower: { id: string; code: string; name: string } | null;
    } | null;
  } | null;
}


export interface RegisterCallDeviceInput {
  token: string;
  platform: 'android' | 'ios';
  channel: 'fcm' | 'voip';
  environment?: 'development' | 'production' | null;
  deviceId?: string | null;
  appVersion?: string | null;
}

export interface CallDeviceRegistrationResult {
  ok: boolean;
}


// ─── HTTP client ──────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (requireAuth) {
    const token = authStore.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch {}
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as unknown as T;
  return res.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginResident(identifier: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('POST', '/auth/login/resident', { identifier, password }, false);
}

export async function getMe(): Promise<SessionUser> {
  return request<SessionUser>('GET', '/auth/me');
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function getNews(): Promise<NewsItem[]> {
  return request<NewsItem[]>('GET', '/news');
}

export async function getNewsItem(id: string): Promise<NewsItem> {
  return request<NewsItem>('GET', `/news/${id}`);
}

// ─── Common Areas & Reservations ─────────────────────────────────────────────

export async function getCommonAreas(): Promise<CommonArea[]> {
  return request<CommonArea[]>('GET', '/common-areas');
}

export async function getReservationStatuses(): Promise<ReservationStatus[]> {
  return request<ReservationStatus[]>('GET', '/reservation-statuses');
}

export async function getMyReservations(): Promise<Reservation[]> {
  return request<Reservation[]>('GET', '/reservations/my');
}

export async function createReservation(payload: {
  residentId: string;
  areaId: string;
  reservationDate: string;
  startTime: string;
  endTime: string;
  statusId: string;
  notesByResident?: string;
}): Promise<Reservation> {
  return request<Reservation>('POST', '/reservations', payload);
}

export async function getMyNotifications(): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('GET', '/notifications/my');
}

export async function markNotificationRead(id: string): Promise<NotificationItem> {
  return request<NotificationItem>('PATCH', `/notifications/${id}/read`);
}

// ─── Packages ─────────────────────────────────────────────────────────────────

export interface PackagePhoto {
  id: string;
  packageId: string;
  filePath: string;
  createdAt: string;
}

export async function getMyPackages(): Promise<PackageItem[]> {
  return request<PackageItem[]>('GET', '/packages/my');
}

export async function getPackagePhotos(packageId: string): Promise<PackagePhoto[]> {
  return request<PackagePhoto[]>('GET', `/packages/${packageId}/photos`);
}

// ─── Community Spaces ─────────────────────────────────────────────────────────

export async function getCommunitySpaces(): Promise<CommunitySpace[]> {
  return request<CommunitySpace[]>('GET', '/community-spaces');
}

// ─── Access Audit ─────────────────────────────────────────────────────────────

export async function getMyAccessEntries(apartmentId?: string): Promise<AccessEntry[]> {
  const qs = apartmentId ? `?apartmentId=${apartmentId}` : '';
  return request<AccessEntry[]>('GET', `/access-audit/my${qs}`);
}

// ─── Resident Profile ─────────────────────────────────────────────────────────

export async function getMyProfile(): Promise<ResidentProfile> {
  return request<ResidentProfile>('GET', '/residents/me');
}

export async function getMyApartments(): Promise<ResidentApartment[]> {
  return request<ResidentApartment[]>('GET', '/residents/me/apartments');
}

export async function getMyQr(apartmentId: string): Promise<{ dataUrl: string; residentId: string; apartmentId: string }> {
  return request<{ dataUrl: string; residentId: string; apartmentId: string }>('GET', `/residents/me/qr?apartmentId=${apartmentId}`);
}

export async function getCallsIceConfig(): Promise<CallsIceConfigResponse> {
  return request<CallsIceConfigResponse>('GET', '/calls/ice-config');
}

export async function getCallPorters(): Promise<PorterAvailability[]> {
  return request<PorterAvailability[]>('GET', '/calls/porters');
}

export async function registerCallDevice(payload: RegisterCallDeviceInput): Promise<CallDeviceRegistrationResult> {
  return request<CallDeviceRegistrationResult>('POST', '/calls/devices', payload);
}

export async function unregisterCallDevice(payload: Partial<RegisterCallDeviceInput> & { deviceId?: string | null } = {}): Promise<CallDeviceRegistrationResult> {
  return request<CallDeviceRegistrationResult>('POST', '/calls/devices/unregister', payload);
}

// ─── Assemblies ───────────────────────────────────────────────────────────────

export interface AssemblyTokenResponse {
  token: string;
  formatted: string;
}

export interface SyncVoteInput {
  questionId: string;
  assemblyId: string;
  vote: 'yes' | 'no' | 'blank';
  votedAt: string;
  token?: string;
}

export interface SyncVoteResult {
  questionId: string;
  accepted: boolean;
  reason?: string;
}

export async function getActiveAssembly(): Promise<import('../realtime/assemblies/types').AssemblyPayload | null> {
  try {
    return await request<import('../realtime/assemblies/types').AssemblyPayload>('GET', '/assemblies/active');
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

export async function getMyToken(assemblyId: string): Promise<AssemblyTokenResponse> {
  return request<AssemblyTokenResponse>('GET', `/assemblies/${assemblyId}/my-token`);
}

export async function syncVotes(assemblyId: string, votes: SyncVoteInput[]): Promise<SyncVoteResult[]> {
  return request<SyncVoteResult[]>('POST', `/assemblies/${assemblyId}/sync-votes`, { votes });
}

// ─── Image URL helper ─────────────────────────────────────────────────────────

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.trim()) return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE.replace('/api/v1', '');
  return `${base}/${path.replace(/^\//, '')}`;
}
