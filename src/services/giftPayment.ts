/**
 * giftPayment.ts — Pagamento da lista de presentes via Mercado Pago
 *
 * Endpoint PHP:
 *   POST /api/gifts/contribute
 *   Body: { gift_item_id, gift_title, amount, contributor_name?, contributor_email, payment_method, couple }
 */

const API    = import.meta.env.VITE_API_BASE_URL ?? '';
const COUPLE = 'alvin-lari';
const IS_MOCK = !API;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface GiftContributeInput {
  gift_item_id:      string;
  gift_title:        string;
  amount:            number;
  contributor_name?: string;
  contributor_email: string;
  payment_method:    'pix' | 'credit_card';
}

export interface GiftPixResult {
  payment_id:      string;
  contribution_id: string;
  qr_code:         string;
  qr_code_base64:  string;
}

export interface GiftCardResult {
  preference_id:   string;
  contribution_id: string;
  init_point:      string;
}

export type GiftPaymentResult =
  | { method: 'pix';         data: GiftPixResult  }
  | { method: 'credit_card'; data: GiftCardResult };

export interface GiftCardPaymentInput {
  token:              string;
  payment_method_id:  string;
  installments:       number;
  issuer_id?:         string;
  transaction_amount: number;
  payer: {
    email:           string;
    identification?: { type: string; number: string };
  };
  gift_item_id:       string;
  gift_title:         string;
  contributor_name?:  string;
}

export interface GiftCardPaymentResult {
  status:          'approved' | 'pending' | 'rejected';
  payment_id:      string;
  contribution_id: string;
}

// ── API ───────────────────────────────────────────────────────────────────────

export async function contributeGift(input: GiftContributeInput): Promise<GiftPaymentResult> {
  if (IS_MOCK) {
    await tick(700);
    if (input.payment_method === 'pix') {
      return {
        method: 'pix',
        data: {
          payment_id:      'mock-gift-pay-99999',
          contribution_id: crypto.randomUUID(),
          qr_code:         '00020126580014br.gov.bcb.pix0136MOCK-KEY-FOR-DEVELOPMENT-ONLY5204000053039865802BR5924LARISSA ALVARO CASAMENTO6009SAO PAULO62070503***6304ABCD',
          qr_code_base64:  '',
        },
      };
    }
    return {
      method: 'credit_card',
      data: {
        preference_id:   'mock-gift-pref',
        contribution_id: crypto.randomUUID(),
        init_point:      'https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=MOCK',
      },
    };
  }

  const res = await fetch(`${API}/gifts/contribute`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...input, couple: COUPLE }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? 'Falha ao processar pagamento. Tente novamente.');
  }
  return res.json() as Promise<GiftPaymentResult>;
}

export async function processGiftCardPayment(input: GiftCardPaymentInput): Promise<GiftCardPaymentResult> {
  if (IS_MOCK) {
    await tick(900);
    return { status: 'approved', payment_id: 'mock-gift-card-99999', contribution_id: crypto.randomUUID() };
  }
  const res = await fetch(`${API}/gifts/pay-card`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ ...input, couple: COUPLE }),
  });
  const body = await res.json().catch(() => ({})) as { error?: string; status?: string; payment_id?: string; contribution_id?: string };
  if (!res.ok) throw new Error(body.error ?? 'Pagamento recusado. Tente outro cartão.');
  return body as GiftCardPaymentResult;
}

const tick = (ms = 300) => new Promise<void>((r) => setTimeout(r, ms));
