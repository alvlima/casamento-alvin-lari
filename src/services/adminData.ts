/**
 * adminData.ts — Camada de dados do painel admin.
 *
 * Todas as funções fazem chamadas à API PHP no HostGator.
 * O token de sessão é salvo em sessionStorage após POST /api/login.
 * O couple_id nunca é enviado pelo frontend — o backend resolve via token.
 */

import type {
  RsvpResponse,
  GiftContribution,
  GiftSummary,
  DashboardStats,
  AdminRifaData,
  RifaConfig,
  RifaPrize,
  AdminSiteData,
  SiteEditorCouple,
  SiteEditorContent,
  SiteEditorRoom,
  AdminGiftItem,
  InviteToken,
} from '../types/admin';
import { invalidateWeddingConfigCache } from './weddingConfig';

const API    = import.meta.env.VITE_API_BASE_URL as string;
const COUPLE = 'alvin-lari';

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('admin_token') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

function handleUnauthorized(): never {
  sessionStorage.removeItem('admin_token');
  sessionStorage.removeItem('admin_auth');
  window.location.href = '/login';
  throw new Error('Sessão expirada. Faça login novamente.');
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: authHeaders() });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function apiWrite(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<Response> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: authHeaders(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) handleUnauthorized();
  if (!res.ok) {
    const b = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(b.error ?? `Erro ${res.status}`);
  }
  return res;
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function fetchRsvpResponses(): Promise<RsvpResponse[]> {
  const rows = await apiGet<Array<Record<string, unknown>>>('/rsvp');
  return rows.map((r) => ({ ...r, attendance: Boolean(r.attendance) })) as RsvpResponse[];
}

export async function fetchGiftContributions(): Promise<GiftContribution[]> {
  const rows = await apiGet<Array<Record<string, unknown>>>('/gifts/contributions');
  return rows.map((r) => ({ ...r, amount: Number(r.amount) })) as GiftContribution[];
}

export async function fetchGiftSummary(): Promise<GiftSummary[]> {
  const rows = await apiGet<Array<Record<string, unknown>>>('/gifts/summary');
  return rows.map((r) => ({
    ...r,
    contribution_count: Number(r.contribution_count),
    total_amount:       Number(r.total_amount),
    avg_amount:         Number(r.avg_amount),
  })) as GiftSummary[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  const row = await apiGet<Record<string, unknown>>('/dashboard');
  return {
    couple_id:           String(row.couple_id ?? ''),
    total_rsvp:          Number(row.total_rsvp),
    confirmed:           Number(row.confirmed),
    declined:            Number(row.declined),
    total_gift_amount:   Number(row.total_gift_amount),
    total_contributions: Number(row.total_contributions),
  };
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function saveRsvp(
  data: Omit<RsvpResponse, 'id' | 'couple_id' | 'created_at'>
): Promise<void> {
  const res = await fetch(`${API}/rsvp?couple=${COUPLE}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(data),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Erro ao salvar confirmação.');
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function login(password: string): Promise<string> {
  const res = await fetch(`${API}/login`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ slug: COUPLE, password }),
  });
  if (res.status === 401) throw new Error('Senha incorreta.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Erro ao fazer login.');
  }
  return (await res.json() as { token: string }).token;
}

// ── Admin: Rifa ───────────────────────────────────────────────────────────────

export async function fetchAdminRifa(): Promise<AdminRifaData> {
  const data = await apiGet<AdminRifaData>('/admin/rifa');
  return {
    ...data,
    config: {
      ticket_price:       Number(data.config.ticket_price),
      total_tickets:      Number(data.config.total_tickets),
      draw_threshold_pct: Number(data.config.draw_threshold_pct),
    },
  };
}

export async function saveRifaConfig(config: RifaConfig): Promise<void> {
  await apiWrite('POST', '/admin/rifa/config', config);
}

export async function addRifaPrize(prize: Omit<RifaPrize, 'id'>): Promise<RifaPrize> {
  const res  = await apiWrite('POST', '/admin/rifa/prizes', prize);
  const data = await res.json() as { prize: RifaPrize };
  return data.prize;
}

export async function updateRifaPrize(id: string, prize: Omit<RifaPrize, 'id'>): Promise<void> {
  await apiWrite('PUT', `/admin/rifa/prizes/${id}`, prize);
}

export async function deleteRifaPrize(id: string): Promise<void> {
  await apiWrite('DELETE', `/admin/rifa/prizes/${id}`);
}

// ── Admin: Editor de Site ─────────────────────────────────────────────────────

export async function fetchAdminSite(): Promise<AdminSiteData> {
  return apiGet<AdminSiteData>('/admin/site');
}

export async function saveAdminCouple(data: SiteEditorCouple): Promise<void> {
  await apiWrite('POST', '/admin/site/couple', data);
  invalidateWeddingConfigCache();
}

export async function saveAdminContent(data: SiteEditorContent): Promise<void> {
  await apiWrite('POST', '/admin/site/content', data);
  invalidateWeddingConfigCache();
}

export async function saveAdminRooms(rooms: Record<string, SiteEditorRoom>): Promise<void> {
  await apiWrite('POST', '/admin/site/rooms', { rooms });
  invalidateWeddingConfigCache();
}

export async function addAdminGift(gift: Omit<AdminGiftItem, 'id'>): Promise<string> {
  const res  = await apiWrite('POST', '/admin/gifts', gift);
  const data = await res.json() as { id: string };
  invalidateWeddingConfigCache();
  return data.id;
}

export async function updateAdminGift(id: string, gift: Omit<AdminGiftItem, 'id'>): Promise<void> {
  await apiWrite('PUT', `/admin/gifts/${id}`, gift);
  invalidateWeddingConfigCache();
}

export async function deleteAdminGift(id: string): Promise<void> {
  await apiWrite('DELETE', `/admin/gifts/${id}`);
  invalidateWeddingConfigCache();
}

// ── Admin: Convites ───────────────────────────────────────────────────────────

// ── Admin: RSVP ───────────────────────────────────────────────────────────────

export async function updateAdminRsvp(
  id: string,
  data: { name: string; attendance: 0 | 1; message?: string }
): Promise<void> {
  await apiWrite('PUT', `/admin/rsvp/${id}`, data);
}

export async function deleteAdminRsvp(id: string): Promise<void> {
  await apiWrite('DELETE', `/admin/rsvp/${id}`);
}

// ── Admin: Convites ───────────────────────────────────────────────────────────

export async function fetchInviteTokens(): Promise<InviteToken[]> {
  return apiGet<InviteToken[]>('/admin/invites');
}

export async function createInviteToken(data: {
  guest_name: string;
  guests?: string[];
  whatsapp?: string;
  email?: string;
}): Promise<InviteToken> {
  const res  = await apiWrite('POST', '/admin/invites', data);
  return res.json() as Promise<InviteToken>;
}

export async function sendInviteEmail(token: string): Promise<void> {
  await apiWrite('POST', `/admin/invites/${token}/send-email`);
}

export async function markInviteSent(token: string): Promise<void> {
  await apiWrite('POST', `/admin/invites/${token}/mark-sent`);
}

export async function updateInviteToken(
  token: string,
  data: { guest_name: string; guests?: string[]; whatsapp?: string; email?: string }
): Promise<void> {
  await apiWrite('PUT', `/admin/invites/${token}`, data);
}

export async function deleteInviteToken(token: string): Promise<void> {
  await apiWrite('DELETE', `/admin/invites/${token}`);
}

export async function validateInviteToken(
  token: string,
  couple: string
): Promise<{ valid: boolean; guest_name: string | null; guests: string[]; used: boolean; previous_responses: Record<string, boolean | null> }> {
  const res = await fetch(
    `${API}/invites/validate?token=${encodeURIComponent(token)}&couple=${encodeURIComponent(couple)}`
  );
  return res.json() as Promise<{ valid: boolean; guest_name: string | null; guests: string[]; used: boolean; previous_responses: Record<string, boolean | null> }>;
}
