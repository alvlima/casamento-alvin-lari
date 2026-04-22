import { memo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, CheckCircle2, Gift, Home } from 'lucide-react';

interface FloatingMenuProps {
  onShowRSVP:     () => void;
  onShowGiftList: () => void;
  onGoHome:       () => void;
}

export const FloatingMenu = memo(({ onShowRSVP, onShowGiftList, onGoHome }: FloatingMenuProps) => {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((v) => !v), []);

  const handle = useCallback((fn: () => void) => {
    setOpen(false);
    fn();
  }, []);

  const items = [
    { icon: <Home size={18} />,         label: 'Início',              action: onGoHome,       color: 'bg-white text-slate-700 border border-slate-200' },
    { icon: <Gift size={18} />,         label: 'Lista de Presentes',  action: onShowGiftList, color: 'bg-white text-slate-700 border border-slate-200' },
    { icon: <CheckCircle2 size={18} />, label: 'Confirmar Presença',  action: onShowRSVP,     color: 'bg-[#94A684] text-white' },
  ];

  return (
    <div className="fixed bottom-6 right-4 md:right-6 z-40 flex flex-col items-end gap-3">
      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 -z-10"
              onClick={() => setOpen(false)}
            />

            {/* Itens */}
            {items.map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, y: 16, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.9 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => handle(item.action)}
                className={`flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl shadow-lg font-black text-sm uppercase tracking-widest whitespace-nowrap ${item.color}`}
              >
                {item.icon}
                {item.label}
              </motion.button>
            ))}
          </>
        )}
      </AnimatePresence>

      {/* Botão principal */}
      <motion.button
        onClick={toggle}
        whileTap={{ scale: 0.92 }}
        className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center shadow-xl shadow-slate-900/30 hover:bg-[#94A684] transition-colors"
        aria-label={open ? 'Fechar menu' : 'Abrir menu'}
      >
        <motion.div
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </motion.div>
      </motion.button>
    </div>
  );
});

FloatingMenu.displayName = 'FloatingMenu';
