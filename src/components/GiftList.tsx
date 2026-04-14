import { memo, useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardPayment } from '@mercadopago/sdk-react';
import {
  X, Cat, Leaf, Wine, BookOpen, Coffee, Plane, Heart,
  Pizza, Music2, Sparkles, Dumbbell, Gift, QrCode,
  CreditCard, Check, Copy, AlertCircle, Loader2, CheckCircle2,
} from 'lucide-react';
import { contributeGift, processGiftCardPayment, type GiftPixResult, type GiftCardPaymentInput } from '../services/giftPayment';
import { fetchWeddingConfig, type GiftCatalogItem } from '../services/weddingConfig';
import { ensureMPInitialized, IS_MP_READY } from '../lib/mercadopago';

// ── Resolve emoji_name (string do banco) → ícone Lucide ──────────────────────

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
        baseColor: '#94A684', baseColorFirstVariant: '#7d9270', baseColorSecondVariant: '#6b7e61',
        errorColor: '#ef4444', textPrimaryColor: '#0f172a', textSecondaryColor: '#64748b',
        inputBackgroundColor: '#ffffff', formBackgroundColor: '#F2F1EC',
        inputFocusedBorderColor: '#94A684', borderRadiusFull: '14px', borderRadiusMedium: '8px',
      },
    },
    hideFormTitle: true,
    hideRedirectionPanel: true,
  },
  paymentMethods: { maxInstallments: 12 },
} as const;

// ── Modal de pagamento ────────────────────────────────────────────────────────

type PayStep = 'form' | 'pix_qr' | 'card_form' | 'card_done';

interface PayModalProps {
  gift:    GiftCatalogItem;
  onClose: () => void;
}

const PayModal = memo(({ gift, onClose }: PayModalProps) => {
  const [step,    setStep]    = useState<PayStep>('form');
  const [amount,  setAmount]  = useState(gift.suggested_amount?.toString() ?? '');
  const [name,    setName]    = useState('');
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [pixData, setPixData] = useState<GiftPixResult | null>(null);
  const [copied,  setCopied]  = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);

  const parsedAmount = parseFloat(amount.replace(',', '.')) || 0;
  const isFormValid  = parsedAmount >= 1 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const handlePix = useCallback(async () => {
    if (!isFormValid) return;
    setError('');
    try {
      const result = await contributeGift({
        gift_item_id: gift.id, gift_title: gift.title,
        amount: parsedAmount, contributor_name: name.trim() || undefined,
        contributor_email: email.trim(), payment_method: 'pix',
      });
      if (result.method === 'pix') { setPixData(result.data); setStep('pix_qr'); }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado.');
    }
  }, [isFormValid, gift, parsedAmount, name, email]);

  const handleGoToCard = useCallback(() => {
    if (!isFormValid) return;
    ensureMPInitialized();
    setError('');
    setStep('card_form');
  }, [isFormValid]);

  const handleCardSubmit = useCallback(async (formData: GiftCardPaymentInput) => {
    try {
      await processGiftCardPayment({
        ...formData,
        gift_item_id:       gift.id,
        gift_title:         gift.title,
        contributor_name:   name.trim() || undefined,
        transaction_amount: parsedAmount,
      });
      setStep('card_done');
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Pagamento recusado.');
    }
  }, [gift, name, parsedAmount]);

  const handleCopy = useCallback(() => {
    if (!pixData?.qr_code) return;
    navigator.clipboard.writeText(pixData.qr_code).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }, [pixData]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl overflow-y-auto flex items-start md:items-center justify-center p-6 py-10"
      onClick={step !== 'card_form' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 30, scale: 0.95 }} animate={{ y: 0, scale: 1 }} exit={{ y: 30, scale: 0.95 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-md rounded-[40px] p-8 relative"
      >
        <button onClick={onClose}
          className="absolute top-6 right-6 w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
          <X size={16} />
        </button>

        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-md text-[#94A684]">
            {resolveIcon(gift.emoji_name)}
          </div>
          <h3 className="text-2xl font-serif text-slate-900">{gift.title}</h3>
          <p className="text-slate-500 text-sm mt-1 italic">{gift.subtitle}</p>
        </div>

        {step === 'form' && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1 block">Quanto você quer contribuir?</label>
              <div className="flex items-center gap-3 bg-white rounded-2xl px-5 py-4 border-2 border-slate-100 focus-within:border-[#94A684] transition-colors">
                <span className="text-slate-400 font-black text-sm">R$</span>
                <input
                  ref={amountRef} type="number" min="1"
                  value={amount} onChange={(e) => setAmount(e.target.value)}
                  placeholder={gift.suggested_amount?.toString() ?? '0'}
                  className="flex-1 text-2xl font-black text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-200"
                />
              </div>
              {gift.suggested_amount != null && (
                <p className="text-xs text-slate-400 italic ml-1">Sugestão: R$&nbsp;{gift.suggested_amount.toLocaleString('pt-BR')} — qualquer valor é bem-vindo.</p>
              )}
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">Seu nome (opcional)</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                placeholder="Como quer ser identificado?"
                className="w-full bg-white border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
            </div>

            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block ml-1">E-mail para confirmação *</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="w-full bg-white border-2 border-slate-100 focus:border-[#94A684] rounded-xl px-4 py-3 text-sm font-medium text-slate-900 placeholder:text-slate-300 focus:outline-none transition-colors" />
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
            <p className="text-[10px] text-slate-400 text-center italic">Pagamento seguro via Mercado Pago.</p>
          </div>
        )}

        {step === 'pix_qr' && pixData && (
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-3">
              <div className="flex items-center gap-2 text-[#94A684]">
                <CheckCircle2 size={18} />
                <p className="text-sm font-black uppercase tracking-widest">Pagamento gerado!</p>
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

            <div className="space-y-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Código copia e cola</p>
              <div className="flex items-center gap-2 bg-white rounded-2xl p-3 border border-slate-200">
                <span className="flex-1 text-xs font-mono text-slate-500 truncate">{pixData.qr_code || 'Disponível após conectar ao backend'}</span>
                <button onClick={handleCopy}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase tracking-wide transition-all flex-shrink-0 ${copied ? 'bg-[#94A684] text-white' : 'bg-slate-900 text-white hover:bg-[#94A684]'}`}>
                  {copied ? <Check size={11} /> : <Copy size={11} />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-xs text-amber-700 font-bold">Valor: R$ {parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              <p className="text-xs text-amber-600 mt-1">Confirmação enviada para <strong>{email}</strong>.</p>
            </div>

            <button onClick={onClose}
              className="w-full py-4 bg-white text-slate-700 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 transition-all border border-slate-100 shadow-sm">
              Fechar
            </button>
          </div>
        )}

        {step === 'card_form' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-1">
              <button onClick={() => setStep('form')}
                className="w-7 h-7 rounded-full bg-white hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors flex-shrink-0 shadow-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <p className="text-sm font-bold text-slate-700">Dados do cartão</p>
              <span className="ml-auto text-xs font-black text-[#94A684]">
                R$ {parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>

            {IS_MP_READY ? (
              <CardPayment
                initialization={{ amount: parsedAmount, payer: { email: email.trim() } }}
                customization={MP_BRICK_CUSTOMIZATION}
                onSubmit={handleCardSubmit as Parameters<typeof CardPayment>[0]['onSubmit']}
                onError={(err) => { setError(String(err?.message ?? 'Erro no formulário.')); setStep('form'); }}
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
                  onClick={() => handleCardSubmit({ token: 'mock-token', payment_method_id: 'visa', installments: 1, transaction_amount: parsedAmount, payer: { email: email.trim() }, gift_item_id: gift.id, gift_title: gift.title, contributor_name: name.trim() || undefined } as GiftCardPaymentInput)}
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
                Sua contribuição de <strong>R$ {parsedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> foi aprovada.
              </p>
              <p className="text-xs text-slate-400 mt-2">Comprovante enviado para <strong>{email}</strong></p>
            </div>
            <button onClick={onClose}
              className="w-full py-4 bg-[#94A684] text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#7d9270] transition-all">
              Fechar
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
});
PayModal.displayName = 'PayModal';

// ── Gift Card ─────────────────────────────────────────────────────────────────

const GiftCard = memo(({ gift, onSelect }: { gift: GiftCatalogItem; onSelect: (g: GiftCatalogItem) => void }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -4 }}
    className="bg-white rounded-[28px] p-6 shadow-lg shadow-slate-100 border border-slate-100 flex flex-col group cursor-pointer h-full"
    onClick={() => onSelect(gift)}
  >
    <div className="flex justify-end mb-2">
      <span className={`text-[10px] font-black uppercase tracking-wider rounded-full px-3 py-1 max-w-[140px] text-center leading-tight ${gift.tag_color}`}>{gift.tag}</span>
    </div>
    <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-600 flex-shrink-0 group-hover:bg-[#94A684]/10 group-hover:text-[#94A684] transition-colors mb-3">
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
          {gift.suggested_amount != null ? `R$\u00a0${gift.suggested_amount.toLocaleString('pt-BR')}` : 'Livre'}
        </p>
      </div>
      <div className="flex items-center justify-center gap-2 bg-slate-900 text-white text-xs font-black uppercase tracking-widest px-4 py-3 rounded-xl group-hover:bg-[#94A684] transition-colors w-full">
        <Gift size={14} />Presentear
      </div>
    </div>
  </motion.div>
));
GiftCard.displayName = 'GiftCard';

// ── GiftList ──────────────────────────────────────────────────────────────────

export const GiftList = memo(({ onClose }: { onClose: () => void }) => {
  const [gifts,        setGifts]        = useState<GiftCatalogItem[]>([]);
  const [selectedGift, setSelectedGift] = useState<GiftCatalogItem | null>(null);

  useEffect(() => {
    fetchWeddingConfig().then((cfg) => setGifts(cfg.gifts)).catch(() => {});
  }, []);

  const handleSelect     = useCallback((g: GiftCatalogItem) => setSelectedGift(g), []);
  const handleCloseModal = useCallback(() => setSelectedGift(null), []);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] overflow-y-auto"
        style={{ backgroundColor: '#F2F1EC' }}
      >
        <div className="sticky top-0 z-10 bg-[#F2F1EC]/80 backdrop-blur-xl border-b border-slate-200 px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] text-[#94A684]">AP Patinhas</p>
            <h1 className="text-2xl font-serif text-slate-900 leading-tight">Lista de Presentes</h1>
          </div>
          <button onClick={onClose}
            className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-colors border border-slate-100">
            <X size={18} />
          </button>
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-4 pb-2 flex items-center gap-3">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aceita</p>
          <span className="flex items-center gap-1.5 bg-[#94A684]/10 text-[#94A684] text-xs font-black px-3 py-1.5 rounded-xl"><QrCode size={12}/>Pix</span>
          <span className="flex items-center gap-1.5 bg-slate-100 text-slate-700 text-xs font-black px-3 py-1.5 rounded-xl"><CreditCard size={12}/>Cartão</span>
        </div>

        <div className="max-w-4xl mx-auto px-6 pt-4 pb-6 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <p className="text-slate-600 text-lg italic max-w-2xl mx-auto leading-relaxed border-l-4 border-[#D6BC9D] pl-6 text-left">
              Nosso lar já está quase pronto. O que falta é o calor das pessoas que amamos — e talvez uma cafeteira. Cada item desta lista não é um objeto, é uma memória que você ajuda a criar dentro do AP Patinhas.
            </p>
          </motion.div>
        </div>

        <div className="max-w-4xl mx-auto px-6 pb-20">
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
                  <GiftCard gift={gift} onSelect={handleSelect} />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {selectedGift && <PayModal gift={selectedGift} onClose={handleCloseModal} />}
      </AnimatePresence>
    </>
  );
});
GiftList.displayName = 'GiftList';
