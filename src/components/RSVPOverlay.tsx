import { memo } from 'react';
import { motion } from 'framer-motion';
import { Heart } from 'lucide-react';

interface RSVPOverlayProps {
  onClose: () => void;
}

export const RSVPOverlay = memo(({ onClose }: RSVPOverlayProps) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 z-[100] bg-slate-900/95 backdrop-blur-2xl overflow-y-auto flex items-start md:items-center justify-center p-6 py-10"
  >
    <motion.div
      initial={{ y: 50, scale: 0.9 }}
      animate={{ y: 0, scale: 1 }}
      className="bg-[#F2F1EC] w-full max-w-xl rounded-[50px] p-12 relative shadow-[0_0_100px_-20px_rgba(255,255,255,0.2)]"
    >
      <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-[#A899B5] via-[#E8C9B5] to-[#8FA9B8] rounded-t-[50px]" />

      <button
        onClick={onClose}
        className="absolute top-8 right-8 w-10 h-10 bg-white rounded-full flex items-center justify-center text-slate-400 hover:text-slate-900 shadow-sm transition-colors"
        aria-label="Fechar"
      >
        ✕
      </button>

      <div className="text-center mb-10">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <Heart className="mx-auto mb-6 text-orange-400" fill="currentColor" size={48} />
        </motion.div>
        <h2 className="text-4xl font-serif text-slate-900">Validar Presença?</h2>
        <p className="text-slate-500 italic mt-4 px-8">
          Confirmar sua participação é o último dado que precisamos para completar este algoritmo de amor.
        </p>
      </div>

      <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
            Nome dos Convidados
          </label>
          <input
            type="text"
            placeholder="Ex: Maria e João"
            className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white focus:outline-none focus:border-[#94A684] transition-colors"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
            Status da Energia
          </label>
          <select className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white focus:outline-none focus:border-[#94A684] appearance-none">
            <option>🔋 Energia Total (Vou com certeza!)</option>
            <option>🪫 Servidor em Manutenção (Não poderei ir)</option>
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-4">
            Mensagem para os Noivos
          </label>
          <textarea
            placeholder="Deixe um conselho junguiano ou um log de alegria..."
            className="w-full p-5 rounded-[25px] border-2 border-slate-100 bg-white h-32 resize-none focus:outline-none focus:border-[#94A684] transition-colors"
          />
        </div>

        <button
          type="submit"
          className="w-full py-6 bg-slate-900 text-white rounded-[25px] font-black uppercase tracking-[0.2em] shadow-2xl shadow-slate-400/20 hover:bg-[#94A684] transition-all transform hover:scale-[1.02] active:scale-95"
        >
          Registrar no Banco de Dados
        </button>
      </form>
    </motion.div>
  </motion.div>
));

RSVPOverlay.displayName = 'RSVPOverlay';
