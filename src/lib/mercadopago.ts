/**
 * mercadopago.ts — Inicialização única do SDK do Mercado Pago
 *
 * O SDK carrega o JS do CDN do MP na primeira chamada a initMercadoPago().
 * Chame ensureMPInitialized() antes de renderizar qualquer Brick.
 *
 * Variável de ambiente necessária:
 *   VITE_MP_PUBLIC_KEY = APP_USR-xxxxxxxx-... (chave PÚBLICA — segura para frontend)
 *   Obter em: mercadopago.com.br/developers > Suas integrações > Credenciais
 */

import { initMercadoPago } from '@mercadopago/sdk-react';

export const MP_PUBLIC_KEY  = import.meta.env.VITE_MP_PUBLIC_KEY ?? '';
export const IS_MP_READY    = Boolean(MP_PUBLIC_KEY);

let initialized = false;

/** Inicializa o SDK do MP. Idempotente — pode ser chamado múltiplas vezes. */
export function ensureMPInitialized(): void {
  if (initialized || !IS_MP_READY) return;
  initMercadoPago(MP_PUBLIC_KEY, { locale: 'pt-BR' });
  initialized = true;
}
