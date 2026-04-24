import { memo, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Gift, CheckCircle2, Heart, Ticket } from 'lucide-react';

interface IntroScreenProps {
  introTitle:     string;
  introSubtitle:  string;
  weddingIsoDate: string;
  onStart:        () => void;
  onShowGiftList: () => void;
  onShowRSVP:     () => void;
  onShowRifa:     () => void;
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
  introTitle, introSubtitle, weddingIsoDate,
  onStart, onShowGiftList, onShowRSVP, onShowRifa,
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

      <h1 className="text-4xl md:text-6xl font-serif mb-6 leading-tight text-slate-900 tracking-tighter">
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

      {/* CTAs principais */}
      <div className="flex flex-col gap-3 w-full max-w-sm mx-auto">
        <button
          onClick={onShowRSVP}
          className="flex items-center justify-center gap-3 bg-[#94A684] text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-[#7d9270] transition-all shadow-lg shadow-[#94A684]/30 w-full"
        >
          <CheckCircle2 size={18} />
          Confirmar Presença
        </button>

        <button
          onClick={onShowGiftList}
          className="flex items-center justify-center gap-3 bg-white text-slate-700 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 hover:text-slate-900 transition-all shadow-md border border-slate-200 w-full"
        >
          <Gift size={18} />
          Lista de Presentes
        </button>

        <button
          onClick={onShowRifa}
          className="flex items-center justify-center gap-3 bg-white text-slate-700 px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-sm hover:bg-slate-50 hover:text-slate-900 transition-all shadow-md border border-slate-200 w-full"
        >
          <Ticket size={18} />
          Rifa de Casa Nova
        </button>
      </div>

      {/* Imersão — ação terciária */}
      <button
        onClick={onStart}
        className="mt-2 flex items-center gap-1.5 text-slate-400 hover:text-slate-600 text-[11px] font-bold uppercase tracking-[0.3em] transition-colors mx-auto"
      >
        <Zap size={11} />
        ou explore o apartamento
      </button>
    </motion.div>
  );
});

IntroScreen.displayName = 'IntroScreen';
