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

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

function unwrapList<T>(response: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(response) ? response : response.data;
}

const DEFAULT_PAGE_SIZE = 15;

function pageQuery(page = 1, limit = DEFAULT_PAGE_SIZE) {
  return `?page=${page}&limit=${limit}`;
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
  deliveryPhotoPath?: string | null;
  photoCount?: number;
  apartment?: { number: string; towerData?: { name: string } };
}

export interface Tower {
  id: string;
  name: string;
  code: string;
  apartmentsPerFloor: number;
  floors?: number;
}

export interface ApartmentItem {
  id: string;
  number: string;
  floor?: number | null;
  towerId: string;
  residentCount?: number;
  towerData?: { id: string; name: string; code: string };
}

export interface PorterPackageItem {
  id: string;
  description?: string | null;
  arrivalTime: string;
  delivered: boolean;
  deliveredTime?: string | null;
  deliveryPhotoPath?: string | null;
  photoCount?: number;
  apartmentId?: string | null;
  residentId?: string | null;
  apartment?: {
    id: string;
    number: string;
    towerId?: string;
    towerData?: { id: string; name: string; code?: string } | null;
  } | null;
  resident?: {
    id: string;
    name: string;
    lastName: string;
  } | null;
  deliveredByEmployee?: { id: string; name: string; lastName: string } | null;
}

export interface CommunitySpace {
  id: string;
  name: string;
  phase: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  schedules?: Array<{
    id: string;
    dayOfWeek: number;
    isOpen: boolean;
    startTime?: string | null;
    endTime?: string | null;
  }>;
}

export interface AccessEntry {
  id: string;
  entryTime: string;
  exitTime?: string | null;
  entryType: 'pedestrian' | 'car' | 'motorcycle' | 'other';
  vehicleBrandId?: string | null;
  vehicleColor?: string | null;
  vehiclePlate?: string | null;
  vehicleModel?: string | null;
  visitorPhotoPath?: string | null;
  notes?: string | null;
  visitor?: { id: string; name: string; lastName: string } | null;
  vehicleBrand?: { id: string; name: string } | null;
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

export interface CreateCallTraceInput {
  callId: string;
  source: 'web' | 'mobile' | 'api';
  stage: string;
  message: string;
  level?: 'info' | 'warn' | 'error';
  metadata?: Record<string, unknown> | null;
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

async function requestMultipart<T>(
  method: string,
  path: string,
  formData: FormData,
  requireAuth = true,
): Promise<T> {
  const headers: Record<string, string> = {};
  // Do NOT set Content-Type — fetch sets it automatically with the multipart boundary
  if (requireAuth) {
    const token = authStore.getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  const res = await fetch(`${API_BASE}${path}`, { method, headers, body: formData });
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

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function loginResident(identifier: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('POST', '/auth/login/resident', { identifier, password }, false);
}

export async function loginEmployee(username: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('POST', '/auth/login/employee', { username, password }, false);
}

export async function getMe(): Promise<SessionUser> {
  return request<SessionUser>('GET', '/auth/me');
}

// ─── News ─────────────────────────────────────────────────────────────────────

export async function getNews(): Promise<NewsItem[]> {
  return unwrapList(await request<NewsItem[] | PaginatedResponse<NewsItem>>('GET', '/news'));
}

export async function getNewsPage(page = 1, limit = DEFAULT_PAGE_SIZE): Promise<PaginatedResponse<NewsItem>> {
  return request<PaginatedResponse<NewsItem>>('GET', `/news${pageQuery(page, limit)}`);
}

export async function getNewsItem(id: string): Promise<NewsItem> {
  return request<NewsItem>('GET', `/news/${id}`);
}

// ─── Common Areas & Reservations ─────────────────────────────────────────────

export async function getCommonAreas(): Promise<CommonArea[]> {
  return unwrapList(await request<CommonArea[] | PaginatedResponse<CommonArea>>('GET', '/common-areas'));
}

export async function getCommonAreasPage(page = 1, limit = DEFAULT_PAGE_SIZE): Promise<PaginatedResponse<CommonArea>> {
  return request<PaginatedResponse<CommonArea>>('GET', `/common-areas${pageQuery(page, limit)}`);
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
  return unwrapList(await request<PackageItem[] | PaginatedResponse<PackageItem>>('GET', '/packages/my'));
}

export async function getMyPackagesPage(page = 1, limit = DEFAULT_PAGE_SIZE): Promise<PaginatedResponse<PackageItem>> {
  return request<PaginatedResponse<PackageItem>>('GET', `/packages/my${pageQuery(page, limit)}`);
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

export async function createCallTrace(payload: CreateCallTraceInput): Promise<CallDeviceRegistrationResult> {
  return request<CallDeviceRegistrationResult>('POST', '/calls/trace', payload);
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

// ─── Porter: towers & apartments ─────────────────────────────────────────────

export async function getTowers(): Promise<Tower[]> {
  return request<Tower[]>('GET', '/towers');
}

export async function getApartmentsByTower(
  towerId: string,
  limit = 300,
): Promise<PaginatedResponse<ApartmentItem>> {
  return request<PaginatedResponse<ApartmentItem>>(
    'GET',
    `/apartments?towerId=${towerId}&limit=${limit}`,
  );
}

// ─── Porter: packages ─────────────────────────────────────────────────────────

function buildQs(params: Record<string, string | number | boolean | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') parts.push(`${k}=${encodeURIComponent(String(v))}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

export async function getPorterPackages(params: {
  page?: number;
  limit?: number;
  delivered?: boolean;
  towerId?: string;
  apartmentId?: string;
  search?: string;
}): Promise<PaginatedResponse<PorterPackageItem>> {
  return request<PaginatedResponse<PorterPackageItem>>(
    'GET',
    `/packages${buildQs({ page: params.page ?? 1, limit: params.limit ?? 20, ...(params.delivered !== undefined ? { delivered: params.delivered } : {}), ...(params.towerId ? { towerId: params.towerId } : {}), ...(params.apartmentId ? { apartmentId: params.apartmentId } : {}), ...(params.search ? { search: params.search } : {}) })}`,
  );
}

export async function createPorterPackage(payload: {
  apartmentId: string;
  description?: string;
  photo?: { uri: string; fileName: string; type: string } | null;
}): Promise<PorterPackageItem> {
  const fd = new FormData();
  fd.append('apartmentId', payload.apartmentId);
  if (payload.description?.trim()) fd.append('description', payload.description.trim());
  if (payload.photo) {
    fd.append('photos', {
      uri: payload.photo.uri,
      name: payload.photo.fileName,
      type: payload.photo.type,
    } as any);
  }
  return requestMultipart<PorterPackageItem>('POST', '/packages', fd);
}

export async function markPorterPackageDelivered(
  id: string,
  photo?: { uri: string; fileName: string; type: string } | null,
): Promise<PorterPackageItem> {
  const fd = new FormData();
  if (photo) {
    fd.append('deliveryPhoto', {
      uri: photo.uri,
      name: photo.fileName,
      type: photo.type,
    } as any);
  }
  return requestMultipart<PorterPackageItem>('PATCH', `/packages/${id}/deliver`, fd);
}

// ─── Image URL helper ─────────────────────────────────────────────────────────

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.trim()) return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE.replace('/api/v1', '');
  return `${base}/${path.replace(/^\//, '')}`;
}
