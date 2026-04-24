import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardPayment } from '@mercadopago/sdk-react';
import {
  X, Cat, Leaf, Wine, BookOpen, Coffee, Plane, Heart,
  Pizza, Music2, Sparkles, Dumbbell, Gift, QrCode,
  CreditCard, Check, Copy, AlertCircle, Loader2, CheckCircle2,
  ShoppingBag, Trash2,
} from 'lucide-react';
import { contributeGift, processGiftCardPayment, type GiftPixResult, type GiftCardPaymentInput } from '../services/giftPayment';
import { fetchWeddingConfig, type GiftCatalogItem } from '../services/weddingConfig';
import { ensureMPInitialized, IS_MP_READY } from '../lib/mercadopago';

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface CartItem {
  gift:   GiftCatalogItem;
  amount: number;
}

// ── Resolve emoji_name → ícone Lucide ─────────────────────────────────────────

function resolveIcon(name: string, size = 28): React.ReactNode {
  const p = { size };
  switch (name) {
    case 'cat':       return <Cat       {...p} />;
    case 'leaf':      return <Leaf      {...p} />;
    case 'wine':      return <Wine      {...p} />;
    case 'pizza':     return <Pizza     {...p} />;
    case 'coffee':    return <Coffee    {...p} />;
    case 'book-open': return <BookOpen  {...p} />;
    case 'music-2':   return <Music2    {...p} />;
    case 'sparkles':  return <Sparkles  {...p} />;
    case 'dumbbell':  return <Dumbbell  {...p} />;
    case 'plane':     return <Plane     {...p} />;
    case 'heart':     return <Heart     {...p} />;
    default:          return <Gift      {...p} />;
  }
}

// ── Estilo do Brick MP ────────────────────────────────────────────────────────

const MP_BRICK_CUSTOMIZATION = {
  visual: {
    style: {
      theme: 'default' as const,
      customVariables: {
        baseColor:              '#94A684',
        baseColorFirstVariant:  '#7d9270',
        baseColorSecondVariant: '#6b7e61',
        errorColor:             '#ef4444',
        textPrimaryColor:       '#0f172a',
        textSecondaryColor:     '#64748b',
        inputBackgroundColor:   '#f8fafc',
        formBackgroundColor:    '#ffffff',
        borderRadiusFull:       '12px',
        borderRadiusMedium:     '8px',
      },
    },
    hideFormTitle:        true,
    hideRedirectionPanel: true,
  },
  paymentMethods: { maxInstallments: 12 },
} as const;

// ── Modal de valor livre ───────────────────────────────────────────────────────

interface AddAmountModalProps {
  gift:    GiftCatalogItem;
  onAdd:   (amount: number) => void;
  onClose: () => void;
}

const AddAmountModal = memo(({ gift, onAdd, onClose }: AddAmountModalProps) => {
  const [amount, setAmount] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = parseFloat(amount.replace(',', '.')) || 0;

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleConfirm = useCallback(() => {
    if (parsed >= 1) { onAdd(parsed); onClose(); }
  }, [parsed, onAdd, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-md flex items-end sm:items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-sm rounded-[32px] p-7"
      >
        <div className="flex items-center gap-3 mb-5">
          <div className="w-11 h-11 bg-white rounded-xl flex items-center justify-center text-slate-500 shadow-sm flex-shrink-0">
            {resolveIcon(gift.emoji_name, 20)}
          </div>
          <div>
            <p className="font-serif text-slate-900 leading-tight">{gift.title}</p>
            <p className="text-xs text-slate-400 italic">{gift.subtitle}</p>
          </div>
        </div>

        <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
          Quanto você quer contribuir?
        </label>
        <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-slate-100 focus-within:border-[#94A684] transition-colors mb-5">
          <span className="text-slate-400 font-black text-sm">R$</span>
          <input
            ref={inputRef} type="number" min="1"
            value={amount} onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
            placeholder="0"
            className="flex-1 text-2xl font-black text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-200"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onClose}
            className="flex-1 py-3.5 bg-white text-slate-500 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-100 transition-all border border-slate-100">
            Cancelar
          </button>
          <button onClick={handleConfirm} disabled={parsed < 1}
            className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#94A684] disabled:opacity-40 disabled:cursor-not-allowed transition-all">
            Adicionar
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
});
AddAmountModal.displayName = 'AddAmountModal';

// ── Modal de checkout ─────────────────────────────────────────────────────────

type CheckoutStep = 'form' | 'pix_qr' | 'card_form' | 'card_done';

interface CartCheckoutModalProps {
  cart:    CartItem[];
  onClose: () => void;
}

const CartCheckoutModal = memo(({ cart, onClose }: CartCheckoutModalProps) => {
  const [step,    setStep]    = useState<CheckoutStep>('form');
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [pixData, setPixData] = useState<GiftPixResult | null>(null);
  const [copied,  setCopied]  = useState(false);

  const total      = cart.reduce((sum, i) => sum + i.amount, 0);
  const isFormValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const payGiftId = cart[0]?.gift.id ?? '';
  const payTitle  = cart.length === 1
    ? cart[0].gift.title
    : `Lista de Presentes (${cart.length} itens)`;

  const handlePix = useCallback(async () => {
    if (!isFormValid) return;
    setError('');
    try {
      const result = await contributeGift({
        gift_item_id: payGiftId, gift_title: payTitle,
        amount: total, contributor_name: name.trim() || undefined,
        contributor_email: email.trim(), payment_method: 'pix',
      });
      if (result.method === 'pix') { setPixData(result.data); setStep('pix_qr'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    }
  }, [isFormValid, payGiftId, payTitle, total, name, email]);

  const handleGoToCard = useCallback(() => {
    if (!isFormValid) return;
    ensureMPInitialized();
    setError('');
    setStep('card_form');
  }, [isFormValid]);

  const handleCardSubmit = useCallback(async (formData: GiftCardPaymentInput) => {
    setError('');
    try {
      await processGiftCardPayment({
        ...formData,
        gift_item_id: payGiftId, gift_title: payTitle,
        contributor_name: name.trim() || undefined,
        transaction_amount: total,
      });
      setStep('card_done');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Pagamento recusado. Tente outro cartão.';
      setError(msg);
      setStep('form');
      throw new Error(msg);
    }
  }, [payGiftId, payTitle, name, total]);

  const handleCopy = useCallback(() => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [pixData]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl overflow-y-auto flex items-start md:items-center justify-center p-4 py-8"
      onClick={step !== 'card_form' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="bg-slate-900 px-7 pt-7 pb-6 relative">
          <button onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition-colors">
            <X size={14} />
          </button>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              {step === 'pix_qr'     ? <QrCode       size={22} className="text-white"       />
              : step === 'card_done' ? <CheckCircle2  size={22} className="text-[#94A684]"  />
              :                        <ShoppingBag   size={22} className="text-white"       />}
            </div>
            <div>
              <p className="text-white/50 text-[10px] font-black uppercase tracking-widest">
                {cart.length} presente{cart.length > 1 ? 's' : ''}
              </p>
              <p className="text-white font-black text-xl">
                R$&nbsp;{total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>

          {/* Lista de itens */}
          <div className="space-y-1.5">
            {cart.map((item) => (
              <div key={item.gift.id} className="flex items-center justify-between text-sm">
                <span className="text-white/60 truncate mr-2">{item.gift.title}</span>
                <span className="text-white/80 font-bold flex-shrink-0">
                  R$&nbsp;{item.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-7 space-y-4">

          {step === 'form' && (
            <>
              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                    Seu nome (opcional)
                  </label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="Como quer ser identificado?"
                    className="w-full bg-white border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">
                    E-mail para confirmação *
                  </label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    className="w-full bg-white border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
              )}

              <div className="space-y-2.5 pt-1">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Como você quer pagar?</p>
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
                  <p className="text-sm font-black uppercase tracking-widest">Pix gerado!</p>
                </div>
                {pixData.qr_code_base64 ? (
                  <img src={`data:image/png;base64,${pixData.qr_code_base64}`} alt="QR Code Pix"
                    className="w-52 h-52 rounded-2xl border-2 border-white shadow-md" />
                ) : (
                  <div className="w-52 h-52 bg-white rounded-2xl border-2 border-slate-100 flex items-center justify-center shadow-sm">
                    <QrCode size={72} className="text-slate-200" />
                  </div>
                )}
                <p className="text-xs text-slate-500 text-center">Abra seu banco → Pix → QR Code</p>
              </div>

              <div className="space-y-1.5">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Código copia e cola</p>
                <div className="flex items-center gap-2 bg-white rounded-2xl p-3 border border-slate-200">
                  <span className="flex-1 text-xs font-mono text-slate-500 truncate">{pixData.qr_code || 'Disponível no backend'}</span>
                  <button onClick={handleCopy}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex-shrink-0 ${copied ? 'bg-[#94A684] text-white' : 'bg-slate-900 text-white hover:bg-[#94A684]'}`}>
                    {copied ? <Check size={11} /> : <Copy size={11} />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </button>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                <p className="text-xs text-amber-700 font-bold">
                  Total: R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-amber-600 mt-1">
                  Confirmação enviada para <strong>{email}</strong>.
                </p>
              </div>

              <button onClick={onClose}
                className="w-full py-4 bg-white text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 transition-all border border-slate-100 shadow-sm">
                Fechar
              </button>
            </>
          )}

          {step === 'card_form' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button onClick={() => { setError(''); setStep('form'); }}
                  className="w-7 h-7 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors flex-shrink-0 shadow-sm">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
                </button>
                <p className="text-sm font-bold text-slate-700">Dados do cartão</p>
              </div>

              {error && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                  <AlertCircle size={14} className="text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-600 font-medium">{error}</p>
                </div>
              )}

              {IS_MP_READY ? (
                <CardPayment
                  key={`card-gift-${cart.map(i => i.gift.id).join('-')}`}
                  initialization={{ amount: total, payer: { email: email.trim() } }}
                  customization={MP_BRICK_CUSTOMIZATION}
                  onSubmit={handleCardSubmit as Parameters<typeof CardPayment>[0]['onSubmit']}
                  onError={(err) => {
                    const raw = String(err?.message ?? '');
                    const msg = raw.toLowerCase().includes('secure fields') || raw.toLowerCase().includes('integration')
                      ? 'Erro ao carregar o formulário de cartão. Verifique sua conexão e tente novamente.'
                      : (raw || 'Erro no formulário de cartão.');
                    setError(msg);
                    setStep('form');
                  }}
                />
              ) : (
                <div className="bg-white rounded-2xl p-6 border-2 border-dashed border-slate-200 text-center space-y-4">
                  <CreditCard size={36} className="mx-auto text-slate-300" />
                  <div>
                    <p className="text-sm font-bold text-slate-600">Formulário de Cartão MP</p>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                      Configure <code className="bg-slate-100 px-1 rounded text-[10px]">VITE_MP_PUBLIC_KEY</code> para ativar o checkout real.
                    </p>
                  </div>
                  <button
                    onClick={() => handleCardSubmit({ token: 'mock-token', payment_method_id: 'visa', installments: 1, transaction_amount: total, payer: { email: email.trim() }, gift_item_id: payGiftId, gift_title: payTitle, contributor_name: name.trim() || undefined } as GiftCardPaymentInput)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-black text-sm uppercase tracking-widest hover:bg-[#94A684] transition-all flex items-center justify-center gap-2">
                    <Loader2 size={14} />Simular Pagamento (Mock)
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'card_done' && (
            <div className="py-4 space-y-5 text-center">
              <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <CheckCircle2 size={56} className="mx-auto text-[#94A684]" />
              </motion.div>
              <div>
                <p className="text-xl font-black text-slate-900">Presente enviado!</p>
                <p className="text-sm text-slate-500 mt-1">
                  Sua contribuição de <strong>R$&nbsp;{total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> foi aprovada.
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
CartCheckoutModal.displayName = 'CartCheckoutModal';

// ── Gift Card ─────────────────────────────────────────────────────────────────

interface GiftCardProps {
  gift:     GiftCatalogItem;
  inCart:   boolean;
  onAdd:    (gift: GiftCatalogItem) => void;
  onRemove: (id: string) => void;
}

const GiftCard = memo(({ gift, inCart, onAdd, onRemove }: GiftCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-[28px] p-6 shadow-lg shadow-slate-100 border border-slate-100 flex flex-col h-full"
  >
    <div className="flex justify-end mb-2">
      <span className={`text-[10px] font-black uppercase tracking-wider rounded-full px-3 py-1 max-w-[140px] text-center leading-tight ${gift.tag_color}`}>
        {gift.tag}
      </span>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0 mb-3">
      {resolveIcon(gift.emoji_name, 22)}
    </div>
    <div className="mb-3">
      <h3 className="font-serif text-lg text-slate-900 leading-tight">{gift.title}</h3>
      <p className="text-xs text-slate-400 mt-0.5 italic">{gift.subtitle}</p>
    </div>
    <p className="text-sm text-slate-500 leading-relaxed flex-1 mb-4">{gift.description}</p>
    <div className="flex flex-col gap-3 pt-3 border-t border-slate-100 mt-auto">
      <div>
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sugestão</span>
        <p className="text-2xl font-black text-slate-900 leading-none mt-0.5">
          {gift.suggested_amount != null
            ? `R$ ${gift.suggested_amount.toLocaleString('pt-BR')}`
            : 'Livre'}
        </p>
      </div>

      {inCart ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center justify-center gap-2 bg-[#94A684]/10 text-[#94A684] text-xs font-black uppercase tracking-widest px-4 py-3 rounded-xl">
            <Check size={14} />Adicionado
          </div>
          <button
            onClick={() => onRemove(gift.id)}
            className="w-11 h-11 bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
            aria-label="Remover da lista">
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => onAdd(gift)}
          className="flex items-center justify-center gap-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-4 py-3 rounded-xl hover:bg-[#94A684] transition-colors w-full">
          <Gift size={14} />Adicionar
        </button>
      )}
    </div>
  </motion.div>
));
GiftCard.displayName = 'GiftCard';

// ── GiftList ──────────────────────────────────────────────────────────────────

export const GiftList = memo(({ onClose }: { onClose: () => void }) => {
  const [gifts,        setGifts]        = useState<GiftCatalogItem[]>([]);
  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [addingGift,   setAddingGift]   = useState<GiftCatalogItem | null>(null);

  useEffect(() => {
    ensureMPInitialized();
    fetchWeddingConfig().then((cfg) => setGifts(cfg.gifts)).catch(() => {});
  }, []);

  const handleAdd = useCallback((gift: GiftCatalogItem) => {
    if (gift.suggested_amount != null) {
      setCart((prev) => [...prev, { gift, amount: gift.suggested_amount! }]);
    } else {
      setAddingGift(gift);
    }
  }, []);

  const handleAddFromModal = useCallback((amount: number) => {
    if (!addingGift) return;
    setCart((prev) => [...prev, { gift: addingGift, amount }]);
    setAddingGift(null);
  }, [addingGift]);

  const handleRemove = useCallback((id: string) => {
    setCart((prev) => prev.filter((i) => i.gift.id !== id));
  }, []);

  const handleCheckoutClose = useCallback(() => setCheckoutOpen(false), []);

  const cartTotal = cart.reduce((sum, i) => sum + i.amount, 0);
  const cartIds   = new Set(cart.map((i) => i.gift.id));

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto"
        style={{ backgroundColor: '#F2F1EC' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-[#F2F1EC]/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#94A684]">Álvaro & Larissa</p>
            <h1 className="text-2xl font-serif text-slate-900 leading-tight">Lista de Presentes</h1>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-colors border border-slate-100">
            <X size={18} />
          </button>
        </div>

        {/* Aviso sobre tradição */}
        <div className="max-w-4xl mx-auto px-6 pt-4 pb-2">
          <div className="bg-[#E8C9B5]/20 border border-[#D6BC9D]/40 rounded-2xl px-5 py-4 flex gap-3 items-start">
            <span className="text-xl flex-shrink-0">💛</span>
            <p className="text-sm text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Optamos por não passar o sapatinho ou gravata durante a festa.</strong>{' '}
              Nossa maior alegria é a sua presença! Se quiser nos presentear, fique à vontade para contribuir online pela lista abaixo ou deixar um envelopinho na caixinha de dinheiro que estará na festa.
            </p>
          </div>
        </div>

        {/* Métodos de pagamento */}
        <div className="max-w-4xl mx-auto px-6 pt-3 pb-2 flex items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aceita</p>
          <span className="flex items-center gap-1.5 bg-[#94A684]/10 text-[#94A684] text-xs font-black px-3 py-1.5 rounded-xl"><QrCode size={12}/>Pix</span>
          <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-black px-3 py-1.5 rounded-xl"><CreditCard size={12}/>Cartão até 12×</span>
        </div>

        {/* Descrição */}
        <div className="max-w-4xl mx-auto px-6 pt-4 pb-6">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-slate-600 text-lg italic max-w-2xl mx-auto leading-relaxed border-l-4 border-[#D6BC9D] pl-6">
              Nosso lar já está quase pronto. O que falta é o calor das pessoas que amamos — e talvez uma cafeteira. Cada item desta lista não é um objeto, é uma memória que você ajuda a criar dentro do lar de Álvaro & Larissa.
            </p>
          </motion.div>
        </div>

        {/* Grade */}
        <div className="max-w-4xl mx-auto px-6 pb-32">
          {gifts.length === 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-[28px] h-72 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 auto-rows-fr">
              {gifts.map((gift, i) => (
                <motion.div key={gift.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="h-full">
                  <GiftCard
                    gift={gift}
                    inCart={cartIds.has(gift.id)}
                    onAdd={handleAdd}
                    onRemove={handleRemove}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Barra flutuante do carrinho */}
      <AnimatePresence>
        {cart.length > 0 && !checkoutOpen && !addingGift && (
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            className="fixed bottom-0 left-0 right-0 z-[150] px-4 pb-5 pt-3"
          >
            <div className="max-w-4xl mx-auto bg-slate-900 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-black text-sm">
                  {cart.length} presente{cart.length > 1 ? 's' : ''} selecionado{cart.length > 1 ? 's' : ''}
                </p>
                <p className="text-white/50 text-xs mt-0.5">
                  Total: <span className="text-white/80 font-bold">R$&nbsp;{cartTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                </p>
              </div>
              <button
                onClick={() => setCart([])}
                className="text-white/40 hover:text-white/70 transition-colors text-xs font-bold px-2 py-1 flex-shrink-0">
                Limpar
              </button>
              <button
                onClick={() => setCheckoutOpen(true)}
                className="bg-[#94A684] hover:bg-[#7d9270] text-white font-black text-sm px-5 py-2.5 rounded-xl transition-colors flex-shrink-0 flex items-center gap-2">
                <Gift size={15} />Presentear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal de valor livre */}
      <AnimatePresence>
        {addingGift && (
          <AddAmountModal
            gift={addingGift}
            onAdd={handleAddFromModal}
            onClose={() => setAddingGift(null)}
          />
        )}
      </AnimatePresence>

      {/* Modal de checkout */}
      <AnimatePresence>
        {checkoutOpen && (
          <CartCheckoutModal cart={cart} onClose={handleCheckoutClose} />
        )}
      </AnimatePresence>
    </>
  );
});
GiftList.displayName = 'GiftList';
