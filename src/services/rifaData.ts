/**
 * rifaData.ts — Serviço de dados da rifa (bilhetes + Mercado Pago)
 *
 * Endpoints PHP (HostGator):
 *   GET  /api/rifa/tickets?couple=alvin-lari  → lista vendidos/pendentes
 *   POST /api/rifa/reserve                    → reserva bilhete + cria pagamento MP
 *
 * Variável de ambiente: VITE_API_BASE_URL (ex: https://seudominio.com/api)
 * Sem a variável → usa mock local para desenvolvimento offline.
 */

const API    = import.meta.env.VITE_API_BASE_URL ?? '';
const COUPLE = 'alvin-lari';
const IS_MOCK = !API;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface TicketMap {
  sold:    Set<number>;
  pending: Set<number>;
}

export interface BuyTicketInput {
  ticket_number:  number;
  buyer_name:     string;
  buyer_email:    string;
  buyer_phone?:   string;
  payment_method: 'pix' | 'credit_card';
}

export interface PixResult {
  payment_id:     string;
  ticket_id:      string;
  qr_code:        string;
  qr_code_base64: string;
}

export interface CardResult {
  preference_id: string;
  ticket_id:     string;
  init_point:    string;
}

export type BuyTicketResult =
  | { method: 'pix';         data: PixResult  }
  | { method: 'credit_card'; data: CardResult };

// ── Mock (dev sem backend) ────────────────────────────────────────────────────

const MOCK_SOLD    = new Set([3,7,12,15,19,23,28,31,34,37,42,44,48,51,55,58,61,65,68,72,75,79,82,85,88,91,95,98,103,107,112,115,119,123,128,131,134,137,142,144,148,151,155,158,161,165,168,172,175,179,182,185,188,191,195,198]);
const MOCK_PENDING = new Set([5, 17, 33, 66, 100]);

export interface CardPaymentInput {
  token:                 string;
  payment_method_id:     string;
  installments:          number;
  issuer_id?:            string;
  transaction_amount:    number;
  payer: {
    email:           string;
    identification?: { type: string; number: string };
  };
  ticket_number: number;
  buyer_name:    string;
}

export interface CardPaymentResult {
  status:     'approved' | 'pending' | 'rejected';
  payment_id: string;
  ticket_id:  string;
}

// ── Funções públicas ──────────────────────────────────────────────────────────

export async function fetchRaffleTickets(): Promise<TicketMap> {
  if (IS_MOCK) {
    await tick();
    return { sold: new Set(MOCK_SOLD), pending: new Set(MOCK_PENDING) };
  }
  const res = await fetch(`${API}/rifa/tickets?couple=${COUPLE}`);
  if (!res.ok) throw new Error('Falha ao carregar bilhetes.');
  const json = await res.json() as { sold: number[]; pending: number[] };
  return { sold: new Set(json.sold), pending: new Set(json.pending) };
}

export async function buyRaffleTicket(input: BuyTicketInput): Promise<BuyTicketResult> {
  if (IS_MOCK) {
    await tick(700);
    if (input.payment_method === 'pix') {
      return {
        method: 'pix',
        data: {
          payment_id:     'mock-pay-99999',
          ticket_id:      crypto.randomUUID(),
          qr_code:        '00020126580014br.gov.bcb.pix0136MOCK-KEY-FOR-DEVELOPMENT-ONLY5204000053039865802BR5924LARISSA ALVARO CASAMENTO6009SAO PAULO62070503***6304ABCD',
          qr_code_base64: '', // sem backend real, imagem fica vazia
        },
      };
    }
    return {
      method: 'credit_card',
      data: {
        preference_id: 'mock-pref-id',
        ticket_id:     crypto.randomUUID(),
        init_point:    'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=MOCK',
      },
    };
  }

  const res = await fetch(`${API}/rifa/reserve`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...input, couple: COUPLE }),
  });

  if (res.status === 409) throw new Error('Este bilhete acabou de ser reservado. Escolha outro número.');
  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Falha ao reservar bilhete. Tente novamente.');
  }
  return res.json() as Promise<BuyTicketResult>;
}

export async function processRifaCardPayment(input: CardPaymentInput): Promise<CardPaymentResult> {
  if (IS_MOCK) {
    await tick(900);
    return { status: 'approved', payment_id: 'mock-card-99999', ticket_id: crypto.randomUUID() };
  }
  const res = await fetch(`${API}/rifa/pay-card`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...input, couple: COUPLE }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string; status?: string; payment_id?: string; ticket_id?: string };
  if (res.status === 409) throw new Error('Bilhete reservado enquanto você preenchia. Escolha outro número.');
  if (!res.ok) throw new Error(body.error ?? 'Pagamento recusado. Tente outro cartão.');
  return body as CardPaymentResult;
}

const tick = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));
