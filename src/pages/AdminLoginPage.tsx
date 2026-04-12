import { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Heart } from 'lucide-react';
import { login } from '../services/adminData';
import { fetchWeddingConfig } from '../services/weddingConfig';

export default function AdminLoginPage() {
  const navigate  = useNavigate();
  const [value,    setValue]    = useState('');
  const [visible,  setVisible]  = useState(false);
  const [error,    setError]    = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [coupleName, setCoupleName] = useState('Larissa & Alvaro');
  const [homeName,   setHomeName]   = useState('AP Patinhas');

  useEffect(() => {
    fetchWeddingConfig()
      .then((cfg) => {
        setCoupleName(cfg.couple.name);
        setHomeName(cfg.couple.home_name);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setLoading(true);
      try {
        const token = await login(value);
        sessionStorage.setItem('admin_token', token);
        sessionStorage.setItem('admin_auth', 'true');
        navigate('/admin', { replace: true });
      } catch {
        setError(true);
        setValue('');
        setTimeout(() => setError(false), 1500);
      } finally {
        setLoading(false);
      }
    },
    [value, navigate]
  );

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{ backgroundColor: '#F2F1EC' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >
        {/* Card */}
        <div className="bg-white rounded-[36px] p-10 shadow-xl shadow-slate-200/50">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-slate-900 rounded-2xl flex items-center justify-center mx-auto mb-5 text-white">
              <Lock size={24} />
            </div>
            <h1 className="text-2xl font-serif text-slate-900">Área dos Noivos</h1>
            <p className="text-slate-400 text-sm mt-1.5 italic">
              Acesso restrito a {coupleName}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type={visible ? 'text' : 'password'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Senha"
                autoFocus
                disabled={loading}
                className={`w-full px-5 py-4 pr-12 rounded-2xl border-2 bg-slate-50 text-slate-900 focus:outline-none transition-colors text-sm font-medium placeholder:text-slate-300 disabled:opacity-50 ${
                  error
                    ? 'border-red-300 bg-red-50'
                    : 'border-transparent focus:border-[#94A684] focus:bg-white'
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
              disabled={loading || !value}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#94A684] transition-all mt-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Verificando...' : 'Entrar'}
            </button>
          </form>
        </div>

        {/* Voltar ao site */}
        <div className="text-center mt-6 space-y-2">
          <button
            onClick={() => navigate('/')}
            className="text-xs text-slate-400 hover:text-slate-700 transition-colors underline underline-offset-2"
          >
            ← Voltar ao convite
          </button>
          <div className="flex items-center justify-center gap-1.5 mt-3">
            <Heart size={10} className="text-[#E8C9B5]" fill="currentColor" />
            <p className="text-[10px] text-slate-400 italic">{homeName} — painel privado</p>
            <Heart size={10} className="text-[#E8C9B5]" fill="currentColor" />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
