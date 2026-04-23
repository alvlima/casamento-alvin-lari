import { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Gift, CheckCircle2, Heart } from 'lucide-react';

interface IntroScreenProps {
  introTitle:     string;
  introSubtitle:  string;
  homeName:       string;
  weddingIsoDate: string; // ex: "2026-07-18T16:00:00"
  onStart:        () => void;
  onShowGiftList: () => void;
  onShowRSVP:     () => void;
}

function useCountdown(targetIso: string) {
  const calc = () => {
    const diff = new Date(targetIso).getTime() - Date.now();
    if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, over: true };
    const s = Math.floor(diff / 1000);
    return {
      days:    Math.floor(s / 86400),
      hours:   Math.floor((s % 86400) / 3600),
      minutes: Math.floor((s % 3600) / 60),
      seconds: s % 60,
      over:    false,
    };
  };

  const [time, setTime] = useState(calc);

  useEffect(() => {
    const id = setInterval(() => setTime(calc()), 1000);
    return () => clearInterval(id);
  }, [targetIso]);

  return time;
}

const Digit = ({ value, label }: { value: number; label: string }) => (
  <div className="flex flex-col items-center">
    <div className="bg-white/70 backdrop-blur rounded-xl px-3 py-1.5 md:px-4 md:py-2 shadow-sm min-w-[48px] md:min-w-[60px]">
      <span className="text-xl md:text-3xl font-black text-slate-700 tabular-nums">
        {String(value).padStart(2, '0')}
      </span>
    </div>
    <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-1">
      {label}
    </span>
  </div>
);

export const IntroScreen = memo(({
  introTitle, introSubtitle, homeName, weddingIsoDate,
  onStart, onShowGiftList, onShowRSVP,
}: IntroScreenProps) => {
  const { days, hours, minutes, seconds, over } = useCountdown(weddingIsoDate);

  return (
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
        className="mb-8 inline-block p-4 bg-white rounded-full shadow-2xl text-[#E8C9B5]"
      >
        <Heart size={48} fill="currentColor" />
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

      <p className="text-slate-500 mb-8 text-lg md:text-xl italic max-w-md mx-auto">
        {introSubtitle}
      </p>

      {/* Countdown */}
      <div className="mb-10 pt-6 border-t border-slate-100">
        {over ? (
          <p className="text-[#94A684] font-black uppercase tracking-widest text-sm">
            Hoje é o grande dia!
          </p>
        ) : (
          <>
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mb-4">
              Faltam
            </p>
            <div className="flex items-start justify-center gap-2 md:gap-3">
              <Digit value={days}    label="dias"     />
              <span className="text-xl md:text-3xl font-black text-slate-200 mt-2 md:mt-3">:</span>
              <Digit value={hours}   label="horas"    />
              <span className="text-xl md:text-3xl font-black text-slate-200 mt-2 md:mt-3">:</span>
              <Digit value={minutes} label="min"      />
              <span className="text-xl md:text-3xl font-black text-slate-200 mt-2 md:mt-3">:</span>
              <Digit value={seconds} label="seg"      />
            </div>
          </>
        )}
      </div>

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
  );
});

IntroScreen.displayName = 'IntroScreen';
