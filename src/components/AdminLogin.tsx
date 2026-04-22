import { memo, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, X, Heart } from 'lucide-react';

// Senha simples para o painel dos noivos.
// Em produção: mover para variável de ambiente e validar no backend.
const ADMIN_PASSWORD = 'alvinelari2026';

interface AdminLoginProps {
  onSuccess: () => void;
  onClose: () => void;
}

export const AdminLogin = memo(({ onSuccess, onClose }: AdminLoginProps) => {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (value === ADMIN_PASSWORD) {
        onSuccess();
      } else {
        setError(true);
        setValue('');
        setTimeout(() => setError(false), 1500);
      }
    },
    [value, onSuccess]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[300] bg-slate-900/90 backdrop-blur-xl flex items-center justify-center p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, scale: 0.96 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 24, scale: 0.96 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#F2F1EC] w-full max-w-sm rounded-[36px] p-10 relative"
      >
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors shadow-sm"
        >
          <X size={14} />
        </button>

        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-4 text-white">
            <Lock size={24} />
          </div>
          <h2 className="text-2xl font-serif text-slate-900">Área dos Noivos</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400 mt-2">Álvaro & Larissa</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={visible ? 'text' : 'password'}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="Senha"
              autoFocus
              className={`w-full px-5 py-4 pr-12 rounded-2xl border-2 bg-white text-slate-900 focus:outline-none transition-colors text-sm font-medium ${
                error
                  ? 'border-red-300 bg-red-50 placeholder:text-red-300'
                  : 'border-slate-100 focus:border-[#94A684]'
              }`}
            />
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition-colors"
            >
              {visible ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-red-500 font-bold text-center uppercase tracking-widest"
            >
              Senha incorreta
            </motion.p>
          )}

          <button
            type="submit"
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#94A684] transition-all"
          >
            Entrar
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-6">
          <Heart size={10} className="text-[#E8C9B5]" fill="currentColor" />
          <p className="font-script text-lg text-slate-400">Álvaro & Larissa</p>
          <Heart size={10} className="text-[#E8C9B5]" fill="currentColor" />
        </div>
      </motion.div>
    </motion.div>
  );
});

AdminLogin.displayName = 'AdminLogin';
