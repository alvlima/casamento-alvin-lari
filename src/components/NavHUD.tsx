import { memo } from 'react';
import { motion } from 'framer-motion';
import { Cat, Sparkles, Code } from 'lucide-react';
import { INVENTORY_KEYS, type InventoryKey } from '../constants/theme';

interface NavHUDProps {
  inventory:   InventoryKey[];
  coupleName:  string;
}

const KEY_ICONS: Record<InventoryKey, React.ReactNode> = {
  Afeto:    <Cat      size={18} />,
  Intuição: <Sparkles size={18} />,
  Lógica:   <Code     size={18} />,
};

export const NavHUD = memo(({ inventory, coupleName }: NavHUDProps) => (
  <motion.nav
    initial={{ y: -100 }}
    animate={{ y: 0 }}
    className="fixed top-0 w-full z-50 px-4 py-3 md:px-6 md:py-4 flex justify-between items-center bg-white/80 backdrop-blur-xl border-b border-slate-200"
  >
    <div className="flex items-center gap-2 md:gap-4">
      <span className="hidden sm:block text-[9px] font-black uppercase tracking-widest text-slate-400 leading-tight">
        Progresso<br />do Rito:
      </span>
      <div className="flex gap-1.5 md:gap-2">
        {INVENTORY_KEYS.map((key) => {
          const collected = inventory.includes(key);
          return (
            <motion.div
              key={key}
              animate={{
                scale: collected ? [1, 1.3, 1] : 1,
                backgroundColor: collected ? '#0f172a' : '#e2e8f0',
              }}
              className={`w-8 h-8 md:w-10 md:h-10 rounded-xl flex items-center justify-center transition-colors duration-500 ${
                collected ? 'text-white shadow-lg shadow-slate-300' : 'text-slate-400'
              }`}
            >
              {KEY_ICONS[key]}
            </motion.div>
          );
        })}
      </div>
    </div>
    <div className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em] text-slate-500">
      {coupleName}
    </div>
  </motion.nav>
));

NavHUD.displayName = 'NavHUD';
