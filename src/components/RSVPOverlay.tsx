import { memo, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Loader2, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import { validateInviteToken } from '../services/adminData';

const API    = import.meta.env.VITE_API_BASE_URL as string;
const COUPLE = 'alvin-lari';

interface RSVPOverlayProps {
  onClose: () => void;
}

type Step = 'validating' | 'blocked' | 'form' | 'edit' | 'success';

export const RSVPOverlay = memo(({ onClose }: RSVPOverlayProps) => {
  const [step,       setStep]       = useState<Step>('validating');
  const [guestName,  setGuestName]  = useState('');
  const [attendance, setAttendance] = useState<1 | 0>(1);
  const [message,    setMessage]    = useState('');
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);
  const [blockMsg,   setBlockMsg]   = useState('');
  const [token,      setToken]      = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const inv    = params.get('invite') ?? '';
    setToken(inv);

    if (!inv) {
      setBlockMsg('Acesso restrito. Use o link do seu convite.');
      setStep('blocked');
      return;
    }

    validateInviteToken(inv, COUPLE).then(({ valid, guest_name, used, previous_attendance }) => {
      if (!valid) {
        setBlockMsg('Convite inválido. Verifique o link recebido.');
        setStep('blocked');
      } else {
        if (guest_name) setGuestName(guest_name);
        if (used && previous_attendance !== null) setAttendance(previous_attendance ? 1 : 0);
        setStep(used ? 'edit' : 'form');
      }
    }).catch(() => {
      setBlockMsg('Não foi possível validar seu convite. Tente novamente.');
      setStep('blocked');
    });
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) { setError('Informe seu nome.'); return; }
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API}/rsvp?couple=${COUPLE}`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          name:         guestName.trim(),
          attendance,
          message:      message.trim(),
          invite_token: token,
        }),
      });
      const body = await res.json().catch(() => ({})) as { error?: string };
      if (!res.ok) {
        setError(body.error ?? 'Erro ao registrar. Tente novamente.');
        return;
      }
      setStep('success');
    } catch {
      setError('Sem conexão. Verifique sua internet e tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [guestName, attendance, message, token]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl overflow-y-auto flex items-start md:items-center justify-center p-6 py-10"
      onClick={step !== 'form' ? onClose : undefined}
    >
      <motion.div
        initial={{ y: 50, scale: 0.9 }}
        animate={{ y: 0, scale: 1 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-xl rounded-[50px] p-10 md:p-12 relative shadow-[0_0_100px_-20px_rgba(255,255,255,0.2)]"
      >
        <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#A899B5] via-[#E8C9B5] to-[#8FA9B8] rounded-t-[50px]" />

        <button
          onClick={onClose}
          className="absolute top-8 right-8 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-colors"
          aria-label="Fechar"
        >
          ✕
        </button>

        <AnimatePresence mode="wait">

          {/* Validando token */}
          {step === 'validating' && (
            <motion.div key="validating" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="text-center py-12">
              <Loader2 size={40} className="mx-auto animate-spin text-[#94A684] mb-4" />
              <p className="text-slate-500 text-sm">Verificando seu convite…</p>
            </motion.div>
          )}

          {/* Bloqueado */}
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

          {/* Formulário (primeira vez ou alteração) */}
          {(step === 'form' || step === 'edit') && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="text-center mb-8">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Heart className="mx-auto mb-5 text-orange-400" fill="currentColor" size={44} />
                </motion.div>
                <h2 className="text-3xl md:text-4xl font-serif text-slate-900">
                  {step === 'edit' ? 'Alterar Resposta' : 'Validar Presença?'}
                </h2>
                <p className="text-slate-500 italic mt-3 px-4 text-sm md:text-base">
                  {step === 'edit'
                    ? 'Você já enviou uma resposta. Altere abaixo e confirme novamente.'
                    : 'Confirmar sua participação é o último dado que precisamos para completar este algoritmo de amor.'}
                </p>
              </div>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Nome dos Convidados
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Ex: Maria e João"
                    className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white focus:outline-none focus:border-[#94A684] transition-colors"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Status da Energia
                  </label>
                  <select
                    value={attendance}
                    onChange={(e) => setAttendance(Number(e.target.value) as 1 | 0)}
                    className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white focus:outline-none focus:border-[#94A684] appearance-none"
                  >
                    <option value={1}>🔋 Energia Total (Vou com certeza!)</option>
                    <option value={0}>🪫 Servidor em Manutenção (Não poderei ir)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
                    Mensagem para os Noivos
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Deixe um conselho junguiano ou um log de alegria…"
                    className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white h-28 resize-none focus:outline-none focus:border-[#94A684] transition-colors"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3">
                    <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
                    <p className="text-xs text-red-600 font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-5 bg-slate-900 text-white rounded-[25px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-400/20 hover:bg-[#94A684] transition-all transform hover:scale-[1.02] active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={16} className="animate-spin" />Registrando…</> : 'Registrar confirmação'}
                </button>
              </form>
            </motion.div>
          )}

          {/* Sucesso */}
          {step === 'success' && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="text-center py-8">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
                <CheckCircle2 size={56} className="mx-auto text-[#94A684] mb-6" />
              </motion.div>
              <h2 className="text-3xl font-serif text-slate-900 mb-3">
                {attendance ? 'Presença Confirmada!' : 'Recebemos sua resposta'}
              </h2>
              <p className="text-slate-500 italic text-sm leading-relaxed max-w-xs mx-auto">
                {attendance
                  ? `Mal podemos esperar para te ver lá, ${guestName.split(' ')[0]}! 💚`
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
