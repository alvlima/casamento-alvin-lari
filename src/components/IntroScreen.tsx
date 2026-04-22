import { memo } from 'react';
import { motion } from 'framer-motion';
import { Zap, Gift, CheckCircle2 } from 'lucide-react';

interface IntroScreenProps {
  introTitle:    string;
  introSubtitle: string;
  homeName:      string;
  onStart:       () => void;
  onShowGiftList: () => void;
  onShowRSVP:    () => void;
}

export const IntroScreen = memo(({ introTitle, introSubtitle, homeName, onStart, onShowGiftList, onShowRSVP }: IntroScreenProps) => (
  <motion.div
    key="intro"
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
    className="text-center max-w-2xl px-4"
  >
    <motion.div
      animate={{ y: [0, -10, 0] }}
      transition={{ repeat: Infinity, duration: 3 }}
      className="mb-8 inline-block"
    >
      <img src="/nome.png" alt="Álvaro & Larissa" className="w-64 md:w-80 drop-shadow-xl" />
    </motion.div>

    <h1 className="text-6xl md:text-8xl font-serif mb-6 leading-tight text-slate-900 tracking-tighter">
      {introTitle.includes('|') ? (
        <>
          {introTitle.split('|')[0].trim()} <br />
          <span className="italic text-slate-400">{introTitle.split('|')[1].trim()}</span>
        </>
      ) : (
        introTitle
      )}
    </h1>

    <p className="text-slate-500 mb-10 text-lg md:text-xl italic max-w-md mx-auto">
      {introSubtitle}
    </p>

    {/* CTA principal */}
    <button
      onClick={onStart}
      className="group relative bg-slate-900 text-white px-12 py-6 rounded-full font-black uppercase tracking-[0.2em] hover:bg-[#94A684] transition-all shadow-2xl hover:shadow-[#94A684]/40"
    >
      <span className="relative z-10 flex items-center gap-3">
        Iniciar Imersão <Zap size={20} className="fill-current" />
      </span>
      <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 rounded-full transition-opacity" />
    </button>

    {/* Atalhos */}
    <div className="flex items-center justify-center gap-3 mt-8 flex-wrap">
      <button
        onClick={onShowRSVP}
        className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest shadow-md hover:shadow-lg hover:text-[#94A684] transition-all border border-slate-100"
      >
        <CheckCircle2 size={16} />
        Confirmar Presença
      </button>

      <button
        onClick={onShowGiftList}
        className="flex items-center gap-2 bg-white text-slate-700 px-6 py-3 rounded-full text-sm font-black uppercase tracking-widest shadow-md hover:shadow-lg hover:text-[#94A684] transition-all border border-slate-100"
      >
        <Gift size={16} />
        Lista de Presentes
      </button>
    </div>

    <p className="text-slate-400 text-xs mt-4 italic">
      ou explore o {homeName} antes de decidir
    </p>
  </motion.div>
));

IntroScreen.displayName = 'IntroScreen';
