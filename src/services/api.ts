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

export interface PackageItem {
  id: string;
  description?: string | null;
  arrivalTime: string;
  delivered: boolean;
  deliveredTime?: string | null;
  apartment?: { number: string; towerData?: { name: string } };
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

// ─── Access Audit ─────────────────────────────────────────────────────────────

export async function getMyAccessEntries(): Promise<AccessEntry[]> {
  return request<AccessEntry[]>('GET', '/access-audit/my');
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

// ─── Image URL helper ─────────────────────────────────────────────────────────

export function resolveImageUrl(path: string | null | undefined): string | null {
  if (!path || !path.trim()) return null;
  if (path.startsWith('http')) return path;
  const base = API_BASE.replace('/api/v1', '');
  return `${base}/${path.replace(/^\//, '')}`;
}
