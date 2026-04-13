/**
 * weddingConfig.ts — Configurações do casamento carregadas do banco de dados.
 *
 * Endpoint: GET /api/config?couple=alvin-lari
 * Retorna:  dados do casal, conteúdo do site, cômodos, config da rifa + prêmios, catálogo de presentes.
 *
 * O resultado é cacheado em memória por toda a sessão.
 * Chamar invalidateWeddingConfigCache() após edições no painel admin para forçar refetch.
 */

const API    = import.meta.env.VITE_API_BASE_URL as string;
const COUPLE = 'alvin-lari';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface CoupleConfig {
  name:             string;   // "Larissa & Alvaro"
  home_name:        string;   // "AP Patinhas"
  partner1:         string;   // "Alvaro"
  partner2:         string;   // "Larissa"
  wedding_date:     string;   // ISO: "2026-08-01"
  wedding_location: string;
  wedding_time:     string;   // "16:00"
}

export interface SiteContent {
  intro_title:    string;
  intro_subtitle: string;
}

export interface RoomContent {
  title:     string;
  desc:      string;
  nextText?: string;
}

export interface RafflePrize {
  position:    number;
  title:       string;
  description: string;
}

export interface RaffleConfig {
  ticket_price:       number;
  total_tickets:      number;
  draw_threshold_pct: number;
  prizes:             RafflePrize[];
}

export interface GiftCatalogItem {
  id:               string;
  slug:             string;
  title:            string;
  subtitle:         string;
  description:      string;
  suggested_amount: number | null;
  tag:              string;
  tag_color:        string;
  emoji_name:       string;
}

export interface WeddingConfig {
  couple: CoupleConfig;
  site:   SiteContent;
  rooms:  Record<string, RoomContent>;
  raffle: RaffleConfig;
  gifts:  GiftCatalogItem[];
}

// ── Cache ─────────────────────────────────────────────────────────────────────

let _cache: WeddingConfig | null = null;

export async function fetchWeddingConfig(): Promise<WeddingConfig> {
  if (_cache) return _cache;
  const res = await fetch(`${API}/config?couple=${COUPLE}`);
  if (!res.ok) throw new Error('Falha ao carregar configurações do casamento.');
  _cache = await res.json() as WeddingConfig;
  return _cache;
}

/** Invalida o cache local — chamar após edições no painel admin. */
export function invalidateWeddingConfigCache(): void {
  _cache = null;
}

// ── Util ──────────────────────────────────────────────────────────────────────

/** Formata "2026-08-01" → "01 de Agosto de 2026" */
export function formatWeddingDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  return `${d} de ${months[m - 1]} de ${y}`;
}
