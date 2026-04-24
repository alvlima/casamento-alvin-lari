import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { validateInviteToken } from '../services/adminData';
import { fetchWeddingConfig, formatWeddingDate } from '../services/weddingConfig';
import { Calendar, MapPin } from 'lucide-react';

const API    = import.meta.env.VITE_API_BASE_URL as string;
const COUPLE = 'alvin-lari';

interface RSVPOverlayProps {
  onClose: () => void;
}

type Step = 'validating' | 'blocked' | 'form' | 'edit' | 'success';

interface GuestResponse {
  name:       string;
  attendance: 1 | 0;
}

export const RSVPOverlay = memo(({ onClose }: RSVPOverlayProps) => {
  const [step,        setStep]      = useState<Step>('validating');
  const [guests,      setGuests]    = useState<GuestResponse[]>([]);
  const [message,     setMessage]   = useState('');
  const [error,       setError]     = useState('');
  const [loading,     setLoading]   = useState(false);
  const [blockMsg,    setBlockMsg]  = useState('');
  const [token,       setToken]     = useState('');
  const [isFamily,    setIsFamily]  = useState(false);
  const [dateStr,     setDateStr]   = useState('18 de Julho de 2026 • 16:00h');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv    = params.get('invite') ?? '';
    setToken(inv);

    if (!inv) {
      setBlockMsg('Acesso restrito. Use o link do seu convite.');
      setStep('blocked');
      return;
    }

    fetchWeddingConfig().then((cfg) => {
      setDateStr(`${formatWeddingDate(cfg.couple.wedding_date)} • ${cfg.couple.wedding_time}h`);
    }).catch(() => {});

    validateInviteToken(inv, COUPLE).then(({ valid, guest_name, guests: guestList, used, previous_responses }) => {
      if (!valid) {
        setBlockMsg('Convite inválido. Verifique o link recebido.');
        setStep('blocked');
        return;
      }

      // Normaliza guests: backend retorna GuestItem[] ({name, is_child}) ou string[]
      const names = guestList && guestList.length > 0
        ? guestList.map((g: unknown) => (typeof g === 'string' ? g : (g as { name: string }).name))
        : (guest_name ? [guest_name] : []);

      setIsFamily(names.length > 1);

      if (used && Object.keys(previous_responses).length > 0) {
        setGuests(names.map((name) => ({
          name,
          attendance: previous_responses[name] === true ? 1 : 0,
        })));
        setStep('edit');
      } else {
        setGuests(names.map((name) => ({ name, attendance: 1 })));
        setStep('form');
      }
    }).catch(() => {
      setBlockMsg('Não foi possível validar seu convite. Tente novamente.');
      setStep('blocked');
    });
  }, []);

  const toggleAttendance = useCallback((index: number) => {
    setGuests((prev) => prev.map((g, i) =>
      i === index ? { ...g, attendance: g.attendance === 1 ? 0 : 1 } : g
    ));
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const body = isFamily
        ? { invite_token: token, message, responses: guests }
        : { invite_token: token, message, name: guests[0]?.name, attendance: guests[0]?.attendance };

      const res = await fetch(`${API}/rsvp?couple=${COUPLE}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) { setError(data.error ?? 'Erro ao registrar. Tente novamente.'); return; }
      setStep('success');
    } catch {
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [guests, message, token, isFamily]);

  const confirmedCount = guests.filter((g) => g.attendance === 1).length;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl overflow-y-auto flex items-start md:items-center justify-center p-6 py-10"
      onClick={step !== 'form' && step !== 'edit' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 50, scale: 0.9 }} animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-xl rounded-[50px] p-10 md:p-12 relative shadow-[0_0_100px_-20px_rgba(255,255,255,0.2)]"
      >
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#A899B5] via-[#E8C9B5] to-[#8FA9B8] rounded-t-[50px]" />
        <button onClick={onClose}
          className="absolute top-8 right-8 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-colors"
          aria-label="Fechar">✕</button>

        <AnimatePresence mode="wait">

          {step === 'validating' && (
            <motion.div key="validating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-12">
              <Loader2 size={40} className="mx-auto animate-spin text-[#94A684] mb-4" />
              <p className="text-slate-500 text-sm">Verificando seu convite…</p>
            </motion.div>
          )}

          {step === 'blocked' && (
            <motion.div key="blocked" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-8">
              <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Lock size={28} className="text-slate-400" />
              </div>
              <h2 className="text-2xl font-serif text-slate-900 mb-3">Acesso Restrito</h2>
              <p className="text-slate-500 italic text-sm leading-relaxed max-w-xs mx-auto">{blockMsg}</p>
              <button onClick={onClose}
                className="mt-8 px-8 py-3 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-[#94A684] transition-all">
                Fechar
              </button>
            </motion.div>
          )}

          {(step === 'form' || step === 'edit') && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Heart className="mx-auto mb-5 text-orange-400" fill="currentColor" size={44} />
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-serif text-slate-900">
                  {step === 'edit' ? 'Alterar Resposta' : 'Confirmar Presença'}
                </h2>
                <p className="text-slate-500 italic mt-3 px-4 text-sm md:text-base">
                  {step === 'edit'
                    ? 'Você já respondeu. Altere abaixo e confirme novamente.'
                    : isFamily
                      ? 'Confirme a presença de cada convidado individualmente.'
                      : 'Confirmar sua participação é o último dado que precisamos.'}
                </p>
              </div>

              {/* Card de data e local */}
              <div className="bg-white rounded-2xl px-5 py-4 mb-4 space-y-2.5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-3 text-slate-700">
                  <Calendar size={16} className="text-[#94A684] flex-shrink-0" />
                  <span className="text-sm font-semibold">{dateStr}</span>
                </div>
                <div className="flex items-center gap-3">
                  <MapPin size={16} className="text-[#94A684] flex-shrink-0" />
                  <span className="text-sm text-slate-700 font-semibold">Mogi das Cruzes, SP <span className="font-normal text-slate-400 italic">— endereço a ser confirmado em breve</span></span>
                </div>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                {/* Lista de convidados com toggle */}
                <div className="space-y-2">
                  {guests.map((g, i) => (
                    <button
                      key={g.name}
                      type="button"
                      onClick={() => toggleAttendance(i)}
                      className={`w-full flex items-center justify-between p-4 rounded-[20px] border-2 transition-all text-left ${
                        g.attendance
                          ? 'bg-[#94A684]/10 border-[#94A684] text-slate-900'
                          : 'bg-white border-slate-200 text-slate-500'
                      }`}
                    >
                      <span className="font-semibold text-sm">{g.name}</span>
                      <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                        g.attendance
                          ? 'bg-[#94A684] text-white'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        {g.attendance ? 'Vou!' : 'Não vou'}
                      </span>
                    </button>
                  ))}
                </div>

                {isFamily && (
                  <p className="text-xs text-slate-400 italic text-center">
                    {confirmedCount === guests.length
                      ? 'Todos confirmados'
                      : confirmedCount === 0
                        ? 'Nenhum confirmado'
                        : `${confirmedCount} de ${guests.length} confirmados`}
                  </p>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Mensagem para os Noivos (opcional)
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Deixe um conselho junguiano ou um log de alegria…"
                    className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white h-24 resize-none focus:outline-none focus:border-[#94A684] transition-colors"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-[25px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-400/20 hover:bg-[#94A684] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <><Loader2 size={16} className="animate-spin" />Registrando…</> : 'Enviar resposta'}
                </button>
              </form>
            </motion.div>
          )}

          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <CheckCircle2 size={56} className="mx-auto text-[#94A684] mb-6" />
              </motion.div>
              <h2 className="text-3xl font-serif text-slate-900 mb-3">Resposta Registrada!</h2>
              <p className="text-slate-500 italic text-sm leading-relaxed max-w-xs mx-auto">
                {confirmedCount > 0
                  ? `Mal podemos esperar para ver ${confirmedCount === 1 ? 'você' : `vocês ${confirmedCount}`} lá! 💚`
                  : 'Obrigado por nos avisar. Sua presença fará falta.'}
              </p>
              <button onClick={onClose}
                className="mt-8 px-8 py-3 bg-[#94A684] text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-slate-900 transition-all">
                Fechar
              </button>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
});

RSVPOverlay.displayName = 'RSVPOverlay';
