import { memo, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { CardPayment } from '@mercadopago/sdk-react';
import {
  X, Copy, Check, Trophy, Ticket, Heart, PartyPopper,
  Sparkles, Zap, CreditCard, QrCode, AlertCircle,
  Loader2, CheckCircle2,
} from 'lucide-react';
import {
  fetchRaffleTickets,
  buyRaffleTicket,
  processRifaCardPayment,
  type PixResult,
  type CardPaymentInput,
} from '../services/rifaData';
import { fetchWeddingConfig } from '../services/weddingConfig';
import { ensureMPInitialized, IS_MP_READY } from '../lib/mercadopago';

// ── Estilo visual dos prêmios por posição (estático — só títulos vêm da API) ──

const PRIZE_VISUAL = [
  { place: '1º', icon: <Trophy size={22} className="text-yellow-500" />, bg: 'bg-yellow-50 border-yellow-200',       badge: 'bg-yellow-100 text-yellow-700'  },
  { place: '2º', icon: <Trophy size={22} className="text-[#8FA9B8]" />,  bg: 'bg-[#8FA9B8]/10 border-[#8FA9B8]/30', badge: 'bg-[#8FA9B8]/20 text-[#8FA9B8]' },
  { place: '3º', icon: <Trophy   size={22} className="text-[#94A684]" />,  bg: 'bg-[#94A684]/10 border-[#94A684]/30', badge: 'bg-[#94A684]/20 text-[#94A684]' },
] as const;

// ── Estilo customizado do Brick MP ────────────────────────────────────────────

const MP_BRICK_CUSTOMIZATION = {
  visual: {
    style: {
      theme: 'default' as const,
      customVariables: {
        baseColor:               '#94A684',
        baseColorFirstVariant:   '#7d9270',
        baseColorSecondVariant:  '#6b7e61',
        errorColor:              '#ef4444',
        textPrimaryColor:        '#0f172a',
        textSecondaryColor:      '#64748b',
        inputBackgroundColor:    '#f8fafc',
        formBackgroundColor:     '#ffffff',
        borderRadiusFull:        '12px',
        borderRadiusMedium:      '8px',
      },
    },
    hideFormTitle:        true,
    hideRedirectionPanel: true,
  },
  paymentMethods: { maxInstallments: 12 },
} as const;

// ── Modal de compra ───────────────────────────────────────────────────────────

type ModalStep = 'form' | 'pix_qr' | 'card_form' | 'card_done';

interface BuyModalProps {
  numbers:     number[];
  ticketPrice: number;
  drawTarget:  number;
  drawPct:     number;
  soldCount:   number;
  onClose:     () => void;
  onReserved:  (ns: number[]) => void;
}

const BuyModal = memo(({ numbers, ticketPrice, drawTarget, drawPct, soldCount, onClose, onReserved }: BuyModalProps) => {
  const [step,    setStep]    = useState<ModalStep>('form');
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [phone,   setPhone]   = useState('');
  const [error,   setError]   = useState('');
  const [pixData, setPixData] = useState<PixResult | null>(null);
  const [copied,  setCopied]  = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  const count      = numbers.length;
  const total      = count * ticketPrice;
  const remaining  = Math.max(0, drawTarget - soldCount);
  const drawReady  = soldCount >= drawTarget;
  const ticketList = numbers.map((n) => `#${String(n).padStart(3, '0')}`).join(' · ');

  const isFormValid =
    name.trim().length >= 2 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  useEffect(() => { nameRef.current?.focus(); }, []);

  const handlePix = useCallback(async () => {
    if (!isFormValid) return;
    setError('');
    try {
      const result = await buyRaffleTicket({
        ticket_numbers: numbers,
        buyer_name:     name.trim(),
        buyer_email:    email.trim(),
        buyer_phone:    phone.trim() || undefined,
        payment_method: 'pix',
      });
      onReserved(numbers);
      if (result.method === 'pix') { setPixData(result.data); setStep('pix_qr'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    }
  }, [isFormValid, numbers, name, email, phone, onReserved]);

  const handleGoToCard = useCallback(() => {
    if (!isFormValid) return;
    ensureMPInitialized();
    setError('');
    setStep('card_form');
  }, [isFormValid]);

  const handleCardSubmit = useCallback(async (formData: CardPaymentInput) => {
    try {
      await processRifaCardPayment({ ...formData, ticket_numbers: numbers, buyer_name: name.trim() });
      onReserved(numbers);
      setStep('card_done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pagamento recusado. Tente outro cartão.';
      setError(msg);
      setStep('form');
      throw new Error(msg);
    }
  }, [numbers, name, onReserved]);

  const handleCopyCode = useCallback(() => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [pixData]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xl overflow-y-auto flex items-start md:items-center justify-center p-4 py-8"
      onClick={step !== 'card_form' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 24, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 24, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white w-full max-w-sm rounded-[32px] overflow-hidden shadow-2xl"
      >
        <div className="bg-slate-900 px-7 pt-7 pb-8 text-center relative">
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
            <X size={14} />
          </button>
          <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3">
            {step === 'pix_qr'     ? <QrCode      size={28} className="text-white"       />
            : step === 'card_done' ? <CheckCircle2 size={28} className="text-[#94A684]" />
            :                        <Ticket       size={28} className="text-white"       />}
          </div>
          <p className="text-white/60 text-xs font-black uppercase tracking-widest mb-1">
            {count === 1 ? 'Bilhete' : `${count} Bilhetes`}
          </p>
          {count === 1
            ? <p className="text-5xl font-black text-white">{ticketList}</p>
            : <p className="text-base font-black text-white/90 leading-relaxed">{ticketList}</p>
          }
          <p className="text-white/60 text-sm mt-2 font-bold">
            R$ {total},00{count > 1 && <span className="text-white/40 font-normal"> · R$ {ticketPrice} cada</span>}
          </p>
        </div>

        <div className="p-6 space-y-4">

          {step === 'form' && (
            <>
              <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2">
                <div className="flex items-start gap-2 text-slate-600 text-sm">
                  <PartyPopper size={14} className="text-[#94A684] flex-shrink-0 mt-0.5" />
                  {drawReady
                    ? <span>Meta atingida! <strong>Sorteio pode acontecer em breve.</strong></span>
                    : <span>Sorteio ao atingir {drawPct}% — faltam <strong>{remaining} bilhetes</strong>.</span>
                  }
                </div>
                <div className="flex items-center gap-2 text-slate-600 text-sm">
                  <Trophy size={14} className="text-yellow-500 flex-shrink-0" />
                  <span>3 prêmios em dinheiro</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Seu nome *</label>
                  <input ref={nameRef} type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Nome completo"
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">E-mail *</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">WhatsApp (opcional)</label>
                  <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="w-full bg-slate-50 border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Escolha como pagar</p>
                <button onClick={handlePix} disabled={!isFormValid}
                  className="w-full py-4 bg-[#94A684] text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#7d9270] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  <QrCode size={16} />Pix
                </button>
                <button onClick={handleGoToCard} disabled={!isFormValid}
                  className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                  <CreditCard size={16} />Cartão de Crédito
                </button>
              </div>
              <p className="text-[10px] text-slate-400 text-center italic">Pagamento seguro via Mercado Pago. Dados criptografados.</p>
            </>
          )}

          {step === 'pix_qr' && pixData && (
            <>
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-[#94A684]">
                  <CheckCircle2 size={18} />
                  <p className="text-sm font-black uppercase tracking-widest">Pagamento gerado!</p>
                </div>
                {pixData.qr_code_base64 ? (
                  <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix"
                    className="w-48 h-48 rounded-2xl border-2 border-slate-100" />
                ) : (
                  <div className="w-48 h-48 bg-slate-50 rounded-2xl border-2 border-slate-100 flex items-center justify-center">
                    <QrCode size={64} className="text-slate-300" />
                  </div>
                )}
                <p className="text-xs text-slate-500 text-center">Abra seu banco → Pix → QR Code</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Código copia e cola</p>
                <div className="flex items-center gap-2 bg-slate-50 rounded-xl p-3 border border-slate-100">
                  <span className="flex-1 text-xs font-mono text-slate-500 truncate">{pixData.qr_code || 'Disponível no backend'}</span>
                  <button onClick={handleCopyCode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-black text-xs uppercase tracking-wide transition-all flex-shrink-0 ${copied ? 'bg-[#94A684] text-white' : 'bg-slate-900 text-white hover:bg-[#94A684]'}`}>
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1">
                <p className="text-xs text-amber-700 font-bold">Valor exato: R$ {total},00</p>
                <p className="text-xs text-amber-600">
                  {count === 1 ? `Bilhete ${ticketList}` : `${count} bilhetes (${ticketList})`} reservado{count > 1 ? 's' : ''} por <strong>30 minutos</strong>.
                  Confirmado automaticamente após o pagamento.
                </p>
              </div>

              <button onClick={onClose}
                className="w-full py-4 bg-slate-100 text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-200 transition-all">
                Fechar
              </button>
            </>
          )}

          {step === 'card_form' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => setStep('form')}
                  className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors flex-shrink-0" title="Voltar">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <p className="text-sm font-bold text-slate-700">Dados do cartão</p>
              </div>

              {IS_MP_READY ? (
                <CardPayment
                  initialization={{ amount: total, payer: { email: email.trim() } }}
                  customization={MP_BRICK_CUSTOMIZATION}
                  onSubmit={handleCardSubmit as Parameters<typeof CardPayment>[0]['onSubmit']}
                  onError={(err) => { setError(String(err?.message ?? 'Erro no formulário de cartão.')); setStep('form'); }}
                />
              ) : (
                <div className="bg-slate-50 rounded-2xl p-6 border-2 border-dashed border-slate-200 text-center space-y-4">
                  <CreditCard size={36} className="mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm font-bold text-slate-600">Formulário de Cartão MP</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Configure <code className="bg-slate-200 px-1 rounded text-[10px]">VITE_MP_PUBLIC_KEY</code> para exibir o checkout real.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCardSubmit({ token: 'mock-token', payment_method_id: 'visa', installments: 1, transaction_amount: total, payer: { email: email.trim() }, ticket_numbers: numbers, buyer_name: name.trim() } as CardPaymentInput)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#94A684] transition-all flex items-center justify-center gap-2">
                    <Loader2 size={14} />Simular Pagamento (Mock)
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'card_done' && (
            <div className="py-4 space-y-4 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <CheckCircle2 size={56} className="mx-auto text-[#94A684]" />
              </motion.div>
              <div>
                <p className="text-xl font-black text-slate-900">Pagamento aprovado!</p>
                <p className="text-sm text-slate-500 mt-1">
                  {count === 1
                    ? <>Bilhete <strong>{ticketList}</strong> confirmado no seu nome.</>
                    : <><strong>{count} bilhetes</strong> ({ticketList}) confirmados no seu nome.</>
                  }
                </p>
                <p className="text-xs text-slate-400 mt-2">Comprovante enviado para <strong>{email}</strong></p>
              </div>
              <button onClick={onClose}
                className="w-full py-4 bg-[#94A684] text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#7d9270] transition-all">
                Fechar
              </button>
            </div>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
});
BuyModal.displayName = 'BuyModal';

// ── Grade de bilhetes ─────────────────────────────────────────────────────────

interface TicketGridProps {
  sold:         Set<number>;
  pending:      Set<number>;
  selected:     Set<number>;
  loading:      boolean;
  totalTickets: number;
  onSelect:     (n: number) => void;
}

const TicketGrid = memo(({ sold, pending, selected, loading, totalTickets, onSelect }: TicketGridProps) => {
  if (loading) {
    return (
      <div className="grid grid-cols-10 gap-1.5">
        {Array.from({ length: totalTickets }, (_, i) => (
          <div key={i} className="aspect-square rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-10 gap-1.5">
      {Array.from({ length: totalTickets }, (_, i) => i + 1).map((n) => {
        const isSold       = sold.has(n);
        const isPending    = !isSold && pending.has(n);
        const isSelected   = !isSold && !isPending && selected.has(n);
        const isAvailable  = !isSold && !isPending;
        return (
          <motion.button key={n}
            whileHover={isAvailable ? { scale: 1.12 } : {}}
            whileTap={isAvailable   ? { scale: 0.95 } : {}}
            onClick={() => isAvailable && onSelect(n)}
            disabled={!isAvailable}
            title={isPending ? 'Em processo de pagamento' : undefined}
            className={`aspect-square rounded-xl text-[10px] font-black flex items-center justify-center transition-colors ${
              isSold      ? 'bg-slate-200 text-slate-400 cursor-not-allowed line-through'
              : isPending ? 'bg-amber-100 text-amber-500 cursor-not-allowed'
              : isSelected ? 'bg-[#94A684] border-2 border-[#7d9270] text-white shadow-sm cursor-pointer'
              : 'bg-white border-2 border-slate-200 text-slate-700 hover:border-[#94A684] hover:text-[#94A684] hover:bg-[#94A684]/5 cursor-pointer shadow-sm'
            }`}
          >
            {String(n).padStart(3, '0')}
          </motion.button>
        );
      })}
    </div>
  );
});
TicketGrid.displayName = 'TicketGrid';

// ── Banner de retorno MP ──────────────────────────────────────────────────────

const PaymentReturnBanner = memo(({ status, onDismiss }: { status: string; onDismiss: () => void }) => {
  const map = {
    success: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', icon: <CheckCircle2 size={18} />, msg: 'Pagamento aprovado! Seu bilhete está confirmado.' },
    pending: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: <Loader2 size={18} />,       msg: 'Pagamento em análise. Você receberá uma confirmação por e-mail.' },
    failure: { bg: 'bg-red-50 border-red-200',     text: 'text-red-700',   icon: <AlertCircle size={18} />,   msg: 'Pagamento não aprovado. Tente novamente com outro método.' },
  } as const;
  const s = map[status as keyof typeof map];
  if (!s) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
      className={`max-w-2xl mx-auto mt-4 mx-4 flex items-center gap-3 rounded-2xl border px-5 py-4 ${s.bg}`}>
      <span className={s.text}>{s.icon}</span>
      <p className={`flex-1 text-sm font-bold ${s.text}`}>{s.msg}</p>
      <button onClick={onDismiss} className={`${s.text} hover:opacity-70`}><X size={16} /></button>
    </motion.div>
  );
});
PaymentReturnBanner.displayName = 'PaymentReturnBanner';

// ── Página principal ──────────────────────────────────────────────────────────

export default function RifaPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const paymentReturn = searchParams.get('payment');

  const [soldTickets,     setSoldTickets]     = useState<Set<number>>(new Set());
  const [pendingTickets,  setPendingTickets]  = useState<Set<number>>(new Set());
  const [loadingTickets,  setLoadingTickets]  = useState(true);
  const [selectedTickets, setSelectedTickets] = useState<Set<number>>(new Set());
  const [modalOpen,       setModalOpen]       = useState(false);

  // Config carregada do banco — defaults enquanto aguarda
  const [coupleName,    setCoupleName]    = useState('Larissa & Alvaro');
  const [ticketPrice,   setTicketPrice]   = useState(18);
  const [totalTickets,  setTotalTickets]  = useState(200);
  const [drawTarget,    setDrawTarget]    = useState(180);
  const [prizes, setPrizes] = useState(() =>
    PRIZE_VISUAL.map((v, i) => ({
      ...v,
      title: ['R$ 250,00 em dinheiro', 'R$ 150,00 em dinheiro', 'R$ 80,00 em dinheiro'][i],
      desc:  ['Primeiro lugar leva R$ 250 no bolso — gaste como quiser!', 'Segundo lugar garante R$ 150 para usar como preferir.', 'Terceiro lugar recebe R$ 80 para celebrar junto com a gente!'][i],
    }))
  );

  // Carga inicial — config + bilhetes em paralelo
  useEffect(() => {
    Promise.all([fetchRaffleTickets(), fetchWeddingConfig()])
      .then(([{ sold, pending }, cfg]) => {
        setSoldTickets(sold);
        setPendingTickets(pending);
        setCoupleName(cfg.couple.name);
        setTicketPrice(cfg.raffle.ticket_price);
        setTotalTickets(cfg.raffle.total_tickets);
        setDrawTarget(Math.round(cfg.raffle.total_tickets * cfg.raffle.draw_threshold_pct));
        if (cfg.raffle.prizes.length > 0) {
          setPrizes(cfg.raffle.prizes.map((p, i) => ({
            ...PRIZE_VISUAL[i % 3],
            title: p.title,
            desc:  p.description,
          })));
        }
      })
      .catch(() => {})
      .finally(() => setLoadingTickets(false));
  }, []);

  // Polling a cada 30s — reflete pagamentos confirmados via webhook do MP
  useEffect(() => {
    const id = setInterval(() => {
      fetchRaffleTickets()
        .then(({ sold, pending }) => {
          setSoldTickets(sold);
          setPendingTickets(pending);
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, []);

  const handleSelect = useCallback((n: number) => {
    setSelectedTickets((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }, []);
  const handleClose = useCallback(() => {
    setModalOpen(false);
    setSelectedTickets(new Set());
  }, []);
  const handleReserved = useCallback((ns: number[]) => {
    // Marca como pendente na grade mas NÃO fecha o modal —
    // PIX precisa manter o modal aberto para mostrar o QR code.
    // O modal fecha quando o usuário clica em "Fechar".
    setPendingTickets((prev) => new Set([...prev, ...ns]));
  }, []);
  const dismissBanner = useCallback(() => {
    setSearchParams((p) => { p.delete('payment'); return p; });
  }, [setSearchParams]);

  const stats = useMemo(() => {
    const sold      = soldTickets.size;
    const pending   = pendingTickets.size;
    const available = totalTickets - sold - pending;
    const pct       = Math.round((sold / totalTickets) * 100);
    const drawPct   = Math.round((drawTarget / totalTickets) * 100);
    const toTarget  = Math.max(0, drawTarget - sold);
    return { sold, pending, available, pct, drawPct, toTarget, drawReady: sold >= drawTarget };
  }, [soldTickets, pendingTickets, totalTickets, drawTarget]);

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F2F1EC' }}>

      <AnimatePresence>
        {paymentReturn && (
          <div className="px-4">
            <PaymentReturnBanner status={paymentReturn} onDismiss={dismissBanner} />
          </div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-slate-900 text-white text-center px-5 pt-12 pb-10">
        <motion.div animate={{ y: [0, -6, 0] }} transition={{ repeat: Infinity, duration: 3 }}
          className="inline-flex items-center justify-center w-14 h-14 bg-white/10 rounded-2xl mb-5">
          <Ticket size={28} />
        </motion.div>
        <p className="text-white/50 text-[10px] font-black uppercase tracking-[0.5em] mb-2">{coupleName}</p>
        <h1 className="text-3xl md:text-4xl font-serif font-bold mb-2">Rifa do Chá de Casa Nova</h1>

        <div className="mt-8 max-w-sm mx-auto">
          <div className="flex justify-between text-xs text-white/50 mb-2">
            <span>{stats.sold} vendidos</span>
            <span>{stats.available} disponíveis</span>
          </div>
          <div className="relative h-3 bg-white/10 rounded-full overflow-visible">
            <motion.div initial={{ width: 0 }} animate={{ width: `${stats.pct}%` }}
              transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              className="h-full bg-[#94A684] rounded-full" />
            <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-0.5 h-5 bg-white/60 rounded-full"
              style={{ left: `${stats.drawPct}%` }} />
          </div>
          <div className="relative mt-1" style={{ paddingLeft: `${stats.drawPct}%` }}>
            <p className="text-[10px] text-white/40 -translate-x-1/2 inline-block">sorteio</p>
          </div>
          {stats.pending > 0 && (
            <p className="text-white/30 text-xs text-center mt-1">
              <span className="text-amber-400/80">{stats.pending}</span> em processo de pagamento
            </p>
          )}
          {stats.drawReady ? (
            <motion.p initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-xs font-black uppercase tracking-widest text-[#94A684]">
              🎉 Meta atingida — sorteio pode acontecer!
            </motion.p>
          ) : (
            <p className="text-white/30 text-xs text-center mt-3">
              Faltam <strong className="text-white/60">{stats.toTarget}</strong> bilhetes para o sorteio
            </p>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-8">

        {/* Prêmios */}
        <section>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#94A684] mb-4">Prêmios</p>
          <div className="space-y-3">
            {prizes.map((p) => (
              <div key={p.place} className={`flex items-start gap-4 p-4 rounded-2xl border ${p.bg}`}>
                <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex-shrink-0 ${p.badge}`}>{p.place}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">{p.icon}<p className="font-bold text-slate-900 text-sm">{p.title}</p></div>
                  <p className="text-xs text-slate-500 leading-relaxed">{p.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Info preço */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Valor por bilhete</p>
              <p className="text-3xl font-black text-slate-900 mt-1">R$ {ticketPrice},00</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sorteio</p>
              <div className="flex items-center gap-1 justify-end mt-1">
                <Zap size={14} className="text-[#94A684]" />
                <p className="text-sm font-bold text-slate-700">ao atingir {stats.drawPct}%</p>
              </div>
              <p className="text-xs text-slate-400">{drawTarget} de {totalTickets} bilhetes</p>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0">Aceita</p>
            <span className="flex items-center gap-1.5 bg-[#94A684]/10 text-[#94A684] text-xs font-black px-3 py-1.5 rounded-xl"><QrCode size={13} /> Pix</span>
            <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-black px-3 py-1.5 rounded-xl"><CreditCard size={13} /> Cartão</span>
          </div>
        </div>

        {/* Grade */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#94A684]">Escolha seu(s) bilhete(s)</p>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#94A684] inline-block" />Selecionado</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-amber-100 inline-block" />Reservado</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-slate-200 inline-block" />Vendido</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
            <TicketGrid
              sold={soldTickets}
              pending={pendingTickets}
              selected={selectedTickets}
              loading={loadingTickets}
              totalTickets={totalTickets}
              onSelect={handleSelect}
            />
          </div>
        </section>

        {/* Como participar */}
        <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-3">Como participar</p>
          <ol className="space-y-2">
            {[
              'Clique nos números disponíveis para selecioná-los (pode escolher mais de um)',
              'Clique em "Comprar" na barra que aparece na parte inferior',
              'Preencha nome e e-mail',
              'Pague com Pix (QR Code) ou Cartão de Crédito',
              `Sorteio ao vivo quando pelo menos ${stats.drawPct}% dos bilhetes forem vendidos (${drawTarget}/${totalTickets})`,
            ].map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-center gap-2 pb-6 text-slate-400">
          <Heart size={12} fill="currentColor" className="text-[#E8C9B5]" />
          <p className="text-xs italic">AP Patinhas — Chá de Casa Nova 2026</p>
          <Sparkles size={12} className="text-[#D6BC9D]" />
        </div>
      </div>

      {/* Carrinho flutuante */}
      <AnimatePresence>
        {selectedTickets.size > 0 && !modalOpen && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-40 px-4 pb-5 pt-3"
          >
            <div className="max-w-2xl mx-auto bg-slate-900 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm">
                  {selectedTickets.size} bilhete{selectedTickets.size > 1 ? 's' : ''} selecionado{selectedTickets.size > 1 ? 's' : ''}
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  Total: <span className="text-white/80 font-bold">R$ {selectedTickets.size * ticketPrice},00</span>
                </p>
              </div>
              <button
                onClick={() => setSelectedTickets(new Set())}
                className="text-white/40 hover:text-white/70 transition-colors text-xs font-bold px-2 py-1 flex-shrink-0"
              >
                Limpar
              </button>
              <button
                onClick={() => setModalOpen(true)}
                className="bg-[#94A684] hover:bg-[#7d9270] text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors flex-shrink-0"
              >
                Comprar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && selectedTickets.size > 0 && (
          <BuyModal
            numbers={[...selectedTickets].sort((a, b) => a - b)}
            ticketPrice={ticketPrice}
            drawTarget={drawTarget}
            drawPct={stats.drawPct}
            soldCount={soldTickets.size}
            onClose={handleClose}
            onReserved={handleReserved}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
