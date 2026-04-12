/**
 * adminData.ts — Camada de dados do painel admin (multi-tenant).
 *
 * Todas as funções fazem chamadas reais à API PHP no HostGator.
 * O token de sessão é salvo em sessionStorage após POST /api/login bem-sucedido.
 * O couple_id NÃO é enviado pelo frontend — o backend resolve via token.
 *
 * IS_MOCK = true quando VITE_API_BASE_URL não está configurado (dev offline).
 */

import type {
  RsvpResponse,
  GiftContribution,
  GiftSummary,
  DashboardStats,
  AdminRifaData,
  RifaConfig,
  RifaPrize,
} from '../types/admin';

const API     = import.meta.env.VITE_API_BASE_URL ?? '';
const COUPLE  = 'alvin-lari';
const IS_MOCK = !API;

// ── Helpers ───────────────────────────────────────────────────────────────────

function authHeaders(): Record<string, string> {
  const token = sessionStorage.getItem('admin_token') ?? '';
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${API}${path}`, { headers: authHeaders() });
  if (res.status === 401) {
    sessionStorage.removeItem('admin_token');
    sessionStorage.removeItem('admin_auth');
    window.location.href = '/login';
    throw new Error('Sessão expirada. Faça login novamente.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Erro ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ── Mock data (casal Alvin & Lari) ───────────────────────────────────────────

const COUPLE_ID = 'mock-alvin-lari-id';

const MOCK_RSVP: RsvpResponse[] = [
  { id: '1',  couple_id: COUPLE_ID, name: 'Ana e Pedro',        attendance: true,  message: 'Que alegria! Estaremos lá com certeza!',             created_at: '2026-06-10T14:32:00Z' },
  { id: '2',  couple_id: COUPLE_ID, name: 'Carla Mendes',       attendance: true,  message: null,                                                  created_at: '2026-06-11T09:15:00Z' },
  { id: '3',  couple_id: COUPLE_ID, name: 'Rodrigo e Família',  attendance: true,  message: 'Mal podemos esperar! Vai ser lindo demais.',          created_at: '2026-06-12T18:00:00Z' },
  { id: '4',  couple_id: COUPLE_ID, name: 'Juliana Costa',      attendance: false, message: 'Infelizmente não poderei ir, mas mando muito amor!', created_at: '2026-06-13T11:20:00Z' },
  { id: '5',  couple_id: COUPLE_ID, name: 'Marcos e Beatriz',   attendance: true,  message: 'Vamos arrasar na pista de dança!',                   created_at: '2026-06-14T20:45:00Z' },
  { id: '6',  couple_id: COUPLE_ID, name: 'Sofia Alves',        attendance: true,  message: null,                                                  created_at: '2026-06-15T08:30:00Z' },
  { id: '7',  couple_id: COUPLE_ID, name: 'Gabriel e Camila',   attendance: false, message: 'Compromisso anterior :(',                            created_at: '2026-06-15T16:10:00Z' },
  { id: '8',  couple_id: COUPLE_ID, name: 'Família Oliveira',   attendance: true,  message: 'Que lindo! Parabéns aos dois!',                      created_at: '2026-06-16T13:00:00Z' },
  { id: '9',  couple_id: COUPLE_ID, name: 'Tia Vera',           attendance: true,  message: 'Chorei lendo o convite!',                            created_at: '2026-06-17T07:45:00Z' },
  { id: '10', couple_id: COUPLE_ID, name: 'Lucas e Renata',     attendance: true,  message: null,                                                  created_at: '2026-06-18T19:30:00Z' },
];

const MOCK_CONTRIBUTIONS: GiftContribution[] = [
  { id: '1',  couple_id: COUPLE_ID, gift_item_id: 'cafe',    gift_title: 'A Cafeteira Sagrada',             amount: 200, contributor: 'Ana e Pedro',       created_at: '2026-06-10T14:35:00Z' },
  { id: '2',  couple_id: COUPLE_ID, gift_item_id: 'lua',     gift_title: 'Lua de Mel em Modo Avião',        amount: 500, contributor: 'Família Oliveira',  created_at: '2026-06-16T13:05:00Z' },
  { id: '3',  couple_id: COUPLE_ID, gift_item_id: 'gatos',   gift_title: 'Ração dos Guardiões do AP',       amount: 50,  contributor: 'Sofia Alves',       created_at: '2026-06-15T08:35:00Z' },
  { id: '4',  couple_id: COUPLE_ID, gift_item_id: 'vinho',   gift_title: 'O Ritual da Primeira Noite',      amount: 120, contributor: 'Marcos e Beatriz',  created_at: '2026-06-14T20:50:00Z' },
  { id: '5',  couple_id: COUPLE_ID, gift_item_id: 'lua',     gift_title: 'Lua de Mel em Modo Avião',        amount: 300, contributor: 'Rodrigo e Família', created_at: '2026-06-12T18:10:00Z' },
  { id: '6',  couple_id: COUPLE_ID, gift_item_id: 'planta',  gift_title: 'A Primeira Planta da Varanda',    amount: 80,  contributor: null,                 created_at: '2026-06-13T11:25:00Z' },
  { id: '7',  couple_id: COUPLE_ID, gift_item_id: 'terapia', gift_title: 'Sessão de Alinhamento do Casal',  amount: 180, contributor: 'Carla Mendes',      created_at: '2026-06-11T09:20:00Z' },
  { id: '8',  couple_id: COUPLE_ID, gift_item_id: 'cafe',    gift_title: 'A Cafeteira Sagrada',             amount: 100, contributor: null,                 created_at: '2026-06-17T10:00:00Z' },
  { id: '9',  couple_id: COUPLE_ID, gift_item_id: 'lua',     gift_title: 'Lua de Mel em Modo Avião',        amount: 200, contributor: 'Tia Vera',          created_at: '2026-06-17T08:00:00Z' },
  { id: '10', couple_id: COUPLE_ID, gift_item_id: 'pizza',   gift_title: 'O Primeiro Delivery do Endereço', amount: 90,  contributor: 'Lucas e Renata',    created_at: '2026-06-18T19:35:00Z' },
];

// ── Read ─────────────────────────────────────────────────────────────────────

export async function fetchRsvpResponses(): Promise<RsvpResponse[]> {
  if (IS_MOCK) {
    await tick();
    return [...MOCK_RSVP].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const rows = await apiGet<Array<Record<string, unknown>>>('/rsvp');
  return rows.map((r) => ({ ...r, attendance: Boolean(r.attendance) })) as RsvpResponse[];
}

export async function fetchGiftContributions(): Promise<GiftContribution[]> {
  if (IS_MOCK) {
    await tick();
    return [...MOCK_CONTRIBUTIONS].sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  const rows = await apiGet<Array<Record<string, unknown>>>('/gifts/contributions');
  return rows.map((r) => ({ ...r, amount: Number(r.amount) })) as GiftContribution[];
}

export async function fetchGiftSummary(): Promise<GiftSummary[]> {
  if (IS_MOCK) {
    await tick();
    const map = new Map<string, GiftSummary>();
    for (const c of MOCK_CONTRIBUTIONS) {
      const key  = c.gift_item_id ?? '__free__';
      const prev = map.get(key);
      if (prev) {
        prev.contribution_count++;
        prev.total_amount += c.amount;
        prev.avg_amount = prev.total_amount / prev.contribution_count;
      } else {
        map.set(key, { couple_id: COUPLE_ID, gift_item_id: c.gift_item_id, gift_title: c.gift_title, contribution_count: 1, total_amount: c.amount, avg_amount: c.amount });
      }
    }
    return [...map.values()].sort((a, b) => b.total_amount - a.total_amount);
  }
  const rows = await apiGet<Array<Record<string, unknown>>>('/gifts/summary');
  return rows.map((r) => ({
    ...r,
    contribution_count: Number(r.contribution_count),
    total_amount:       Number(r.total_amount),
    avg_amount:         Number(r.avg_amount),
  })) as GiftSummary[];
}

export async function fetchDashboardStats(): Promise<DashboardStats> {
  if (IS_MOCK) {
    await tick();
    const confirmed = MOCK_RSVP.filter((r) => r.attendance).length;
    return { couple_id: COUPLE_ID, total_rsvp: MOCK_RSVP.length, confirmed, declined: MOCK_RSVP.length - confirmed, total_gift_amount: MOCK_CONTRIBUTIONS.reduce((s, c) => s + c.amount, 0), total_contributions: MOCK_CONTRIBUTIONS.length };
  }
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

// ── Write ────────────────────────────────────────────────────────────────────

export async function saveRsvp(
  data: Omit<RsvpResponse, 'id' | 'couple_id' | 'created_at'>
): Promise<void> {
  if (IS_MOCK) {
    await tick(400);
    MOCK_RSVP.push({ ...data, id: crypto.randomUUID(), couple_id: COUPLE_ID, created_at: new Date().toISOString() });
    return;
  }
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

export async function saveGiftContribution(
  data: Omit<GiftContribution, 'id' | 'couple_id' | 'created_at'>
): Promise<void> {
  // Delegado ao giftPayment.ts (contributeGift). Mantido por compatibilidade.
  if (IS_MOCK) {
    await tick(400);
    MOCK_CONTRIBUTIONS.push({ ...data, id: crypto.randomUUID(), couple_id: COUPLE_ID, created_at: new Date().toISOString() });
  }
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function login(password: string): Promise<string> {
  if (IS_MOCK) {
    await tick(400);
    return 'mock-admin-token-dev';
  }
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
  const data = await res.json() as { token: string };
  return data.token;
}

// ── Admin: Rifa ───────────────────────────────────────────────────────────────

const MOCK_RIFA: AdminRifaData = {
  config: { ticket_price: 18, total_tickets: 100, draw_threshold_pct: 0.95 },
  prizes: [
    { id: 'prize-1', title: '🎁 Kit Churrasco Gourmet', description: 'Tábua, facas e acessórios premium para o novo lar.', display_order: 1 },
    { id: 'prize-2', title: '✈️ Passagem Surpresa', description: 'Uma viagem a definir pelo casal após o casamento.', display_order: 2 },
  ],
  tickets: {
    sold: [
      { id: 't-1', ticket_number: 7,  buyer_name: 'Ana Paula',    buyer_email: 'ana@example.com',    buyer_phone: '11999990001', payment_status: 'approved', amount: 18, created_at: '2026-07-01T10:00:00Z' },
      { id: 't-2', ticket_number: 13, buyer_name: 'Carlos Lima',  buyer_email: 'carlos@example.com', buyer_phone: null,          payment_status: 'approved', amount: 18, created_at: '2026-07-02T14:30:00Z' },
      { id: 't-3', ticket_number: 42, buyer_name: 'Fernanda',     buyer_email: 'fe@example.com',     buyer_phone: '21988880003', payment_status: 'approved', amount: 18, created_at: '2026-07-03T09:15:00Z' },
    ],
    pending: [
      { id: 't-4', ticket_number: 55, buyer_name: 'Renato',       buyer_email: 'renato@example.com', buyer_phone: null,          payment_status: 'pending',  amount: 18, created_at: '2026-07-05T08:00:00Z' },
    ],
    stats: { sold: 3, pending: 1, available: 96 },
  },
};

// Mutable copy for mock writes
let mockRifa = structuredClone(MOCK_RIFA);

export async function fetchAdminRifa(): Promise<AdminRifaData> {
  if (IS_MOCK) { await tick(); return structuredClone(mockRifa); }
  const data = await apiGet<AdminRifaData>('/admin/rifa');
  return {
    ...data,
    config: { ...data.config, ticket_price: Number(data.config.ticket_price), total_tickets: Number(data.config.total_tickets), draw_threshold_pct: Number(data.config.draw_threshold_pct) },
  };
}

export async function saveRifaConfig(config: RifaConfig): Promise<void> {
  if (IS_MOCK) { await tick(400); mockRifa.config = { ...config }; return; }
  const res = await fetch(`${API}/admin/rifa/config`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(config),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao salvar configuração.'); }
}

export async function addRifaPrize(prize: Omit<RifaPrize, 'id'>): Promise<RifaPrize> {
  if (IS_MOCK) {
    await tick(400);
    const newPrize: RifaPrize = { ...prize, id: crypto.randomUUID() };
    mockRifa.prizes.push(newPrize);
    return newPrize;
  }
  const res = await fetch(`${API}/admin/rifa/prizes`, {
    method: 'POST', headers: authHeaders(), body: JSON.stringify(prize),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao adicionar prêmio.'); }
  const data = await res.json() as { prize: RifaPrize };
  return data.prize;
}

export async function updateRifaPrize(id: string, prize: Omit<RifaPrize, 'id'>): Promise<void> {
  if (IS_MOCK) {
    await tick(400);
    const idx = mockRifa.prizes.findIndex((p) => p.id === id);
    if (idx !== -1) mockRifa.prizes[idx] = { ...prize, id };
    return;
  }
  const res = await fetch(`${API}/admin/rifa/prizes/${id}`, {
    method: 'PUT', headers: authHeaders(), body: JSON.stringify(prize),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao atualizar prêmio.'); }
}

export async function deleteRifaPrize(id: string): Promise<void> {
  if (IS_MOCK) {
    await tick(300);
    mockRifa.prizes = mockRifa.prizes.filter((p) => p.id !== id);
    return;
  }
  const res = await fetch(`${API}/admin/rifa/prizes/${id}`, {
    method: 'DELETE', headers: authHeaders(),
  });
  if (!res.ok) { const b = await res.json().catch(() => ({})) as { error?: string }; throw new Error(b.error ?? 'Erro ao excluir prêmio.'); }
}

// ── Util ─────────────────────────────────────────────────────────────────────

const tick = (ms = 250) => new Promise<void>((r) => setTimeout(r, ms));
