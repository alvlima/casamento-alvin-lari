import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Cat, Code, Sparkles, Heart, DoorOpen, ArrowRight, ArrowLeft, Lock, MapPin, Calendar, Music, Gift } from 'lucide-react';
import { colors, type RoomId, type InventoryKey } from '../constants/theme';
import type { RoomContent } from '../services/weddingConfig';

// ── Visual estático dos cômodos (cores e ícones — não vêm do banco) ────────────

interface RoomVisual {
  next?: RoomId;
  bg:   string;
  icon: React.ReactNode;
}

const ROOM_VISUAL: Record<RoomId, RoomVisual> = {
  entrada:   { next: 'sala',       bg: colors.sonhoAnjo,   icon: <DoorOpen size={48} className="text-slate-400" /> },
  sala:      { next: 'escritorio', bg: colors.damasco,     icon: <Cat      size={48} className="text-white opacity-20" /> },
  escritorio:{ next: 'varanda',    bg: colors.azulAstral,  icon: <Code     size={48} className="text-white opacity-20" /> },
  varanda:   {                     bg: colors.tomilhoSeco,  icon: <Heart    size={48} className="text-white opacity-20" /> },
};

// ── Sub-components (memoized) ───────────────────────────────────────────────

interface SalaInteractiveProps {
  collected: boolean;
  onCollect: (key: InventoryKey) => void;
}

const SalaInteractive = memo(({ collected, onCollect }: SalaInteractiveProps) => (
  <motion.div
    whileHover={{ scale: 1.1, rotate: 5 }}
    whileTap={{ scale: 0.9 }}
    onClick={() => onCollect('Afeto')}
    className={`cursor-pointer p-8 bg-white rounded-full shadow-2xl border-4 border-[#D6BC9D] flex flex-col items-center transition-colors ${
      collected ? 'text-[#D6BC9D] opacity-60' : 'text-[#D6BC9D]'
    }`}
  >
    <Cat size={48} />
    <p className="text-[10px] mt-2 font-black tracking-widest uppercase">
      {collected ? 'Coletado!' : 'Coletar Afeto'}
    </p>
  </motion.div>
));
SalaInteractive.displayName = 'SalaInteractive';

interface EscritorioInteractiveProps {
  inventory: InventoryKey[];
  onCollect: (key: InventoryKey) => void;
}

const EscritorioInteractive = memo(({ inventory, onCollect }: EscritorioInteractiveProps) => (
  <div className="flex gap-6">
    {(['Intuição', 'Lógica'] as const).map((key) => {
      const collected  = inventory.includes(key);
      const isIntuicao = key === 'Intuição';
      return (
        <motion.div
          key={key}
          whileHover={{ y: -5 }}
          onClick={() => onCollect(key)}
          className={`cursor-pointer p-6 rounded-3xl transition-all border-b-8 ${
            collected
              ? isIntuicao ? 'bg-purple-500 text-white border-purple-700' : 'bg-blue-500 text-white border-blue-700'
              : isIntuicao ? 'bg-white text-purple-400 border-purple-100 shadow-xl' : 'bg-white text-blue-400 border-blue-100 shadow-xl'
          }`}
        >
          {isIntuicao ? <Sparkles size={32} /> : <Code size={32} />}
          <p className="text-[10px] mt-2 font-bold uppercase">{key}</p>
        </motion.div>
      );
    })}
  </div>
));
EscritorioInteractive.displayName = 'EscritorioInteractive';

interface VarandaContentProps {
  allKeysCollected: boolean;
  weddingLocation:  string;
  weddingDateStr:   string;
  onShowRSVP:       () => void;
  onShowGiftList:   () => void;
}

const VarandaContent = memo(({ allKeysCollected, weddingLocation, weddingDateStr, onShowRSVP, onShowGiftList }: VarandaContentProps) => {
  if (!allKeysCollected) {
    return (
      <div className="p-5 md:p-8 bg-slate-100/80 backdrop-blur rounded-[24px] md:rounded-[30px] flex items-center gap-4 md:gap-6 border-2 border-dashed border-slate-200">
        <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-inner">
          <Lock size={28} />
        </div>
        <div>
          <p className="text-sm font-black uppercase tracking-widest text-slate-400">
            Acesso Restrito
          </p>
          <p className="text-xs text-slate-400 mt-1 italic">
            Explore os cômodos e colete as 3 chaves (Afeto, Intuição e Lógica) para revelar o convite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="bg-white p-6 md:p-10 rounded-[28px] md:rounded-[40px] shadow-2xl border-2 border-[#94A684] relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Music size={80} />
      </div>
      <h3 className="text-2xl md:text-3xl font-serif mb-4 md:mb-6 text-[#94A684]">Alinhamento Completo!</h3>
      <div className="space-y-3 mb-5 md:mb-8">
        <div className="flex items-center gap-4 text-slate-600">
          <MapPin size={20} className="text-[#94A684]" />
          <span className="font-bold">{weddingLocation}</span>
        </div>
        <div className="flex items-center gap-4 text-slate-600">
          <Calendar size={20} className="text-[#94A684]" />
          <span className="font-bold">{weddingDateStr}</span>
        </div>
      </div>
      <div className="space-y-3">
        <button
          onClick={onShowRSVP}
          className="w-full py-5 bg-[#94A684] text-white rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-[#94A684]/20"
        >
          Confirmar Presença no Rito
        </button>
        <button
          onClick={onShowGiftList}
          className="w-full py-5 bg-white text-slate-700 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-900 hover:text-white transition-all shadow-md border border-slate-100 flex items-center justify-center gap-3"
        >
          <Gift size={18} />
          Lista de Presentes
        </button>
      </div>
    </motion.div>
  );
});
VarandaContent.displayName = 'VarandaContent';

// ── Main RoomView ───────────────────────────────────────────────────────────

const PREV_ROOM: Partial<Record<RoomId, RoomId>> = {
  sala:       'entrada',
  escritorio: 'sala',
  varanda:    'escritorio',
};

interface RoomViewProps {
  currentRoom:      RoomId;
  inventory:        InventoryKey[];
  roomsConfig:      Record<string, RoomContent>;
  weddingLocation:  string;
  weddingDateStr:   string;
  onCollect:        (key: InventoryKey) => void;
  onNavigate:       (room: RoomId) => void;
  onBack:           () => void;
  onShowRSVP:       () => void;
  onShowGiftList:   () => void;
}

export const RoomView = memo(
  ({ currentRoom, inventory, roomsConfig, weddingLocation, weddingDateStr, onCollect, onNavigate, onBack, onShowRSVP, onShowGiftList }: RoomViewProps) => {
    const visual          = ROOM_VISUAL[currentRoom];
    const content         = roomsConfig[currentRoom] ?? { title: currentRoom, desc: '' };
    const allKeysCollected = inventory.length >= 3;
    const prevRoom        = PREV_ROOM[currentRoom];

    const handleNavigate = useCallback(() => {
      if (visual.next) onNavigate(visual.next);
    }, [visual.next, onNavigate]);

    const handleBack = useCallback(() => {
      if (prevRoom) onNavigate(prevRoom); else onBack();
    }, [prevRoom, onNavigate, onBack]);

    return (
      <motion.div
        key={currentRoom}
        initial={{ opacity: 0, x: 60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -60 }}
        className="w-full max-w-5xl grid md:grid-cols-2 gap-6 md:gap-12 items-start md:items-center py-2 md:py-8"
      >
        {/* Visual do Cômodo */}
        <div className="relative group perspective-1000">
          <motion.div
            initial={{ rotateY: -20, opacity: 0 }}
            animate={{ rotateY: 0, opacity: 1 }}
            className="relative aspect-[5/3] sm:aspect-[4/3] md:aspect-square rounded-[28px] md:rounded-[40px] border-[8px] md:border-[12px] border-white shadow-[0_30px_60px_-15px_rgba(0,0,0,0.12)] flex items-center justify-center overflow-hidden"
            style={{ backgroundColor: visual.bg }}
          >
            <div className="absolute inset-0 opacity-20 mix-blend-overlay pointer-events-none">
              <div className="w-full h-full bg-[radial-gradient(circle,white_1px,transparent_1px)] bg-[size:20px_20px]" />
            </div>
            <div className="z-10 flex flex-col items-center gap-3">
              <div className="scale-75 md:scale-100">{visual.icon}</div>
              <div className="text-slate-800 font-serif text-xl md:text-3xl text-center px-4 uppercase tracking-[0.2em] md:tracking-[0.3em]">
                {content.title}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Storytelling e Ações */}
        <div className="space-y-5 md:space-y-10">
          <div className="space-y-3 md:space-y-6">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBack}
                className="flex items-center gap-1.5 bg-white text-slate-600 hover:text-slate-900 hover:shadow-md px-3 py-1.5 rounded-xl shadow-sm border border-slate-100 transition-all group"
                aria-label="Voltar"
              >
                <ArrowLeft size={13} className="group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em]">Voltar</span>
              </button>
              <span className="text-slate-200">·</span>
              <span className="text-[9px] md:text-[10px] font-black uppercase tracking-[0.4em] md:tracking-[0.5em] text-[#94A684]">
                Localização Atual
              </span>
            </div>
            <h2 className="text-3xl md:text-5xl font-serif text-slate-900 leading-tight -mt-1">{content.title}</h2>
            <p className="text-slate-600 text-base md:text-lg leading-relaxed italic border-l-4 border-slate-200 pl-4 md:pl-6">
              {content.desc}
            </p>
          </div>

          {/* Interactive elements per room */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="py-1 md:py-2"
          >
            {currentRoom === 'sala' && (
              <SalaInteractive
                collected={inventory.includes('Afeto')}
                onCollect={onCollect}
              />
            )}
            {currentRoom === 'escritorio' && (
              <EscritorioInteractive inventory={inventory} onCollect={onCollect} />
            )}
          </motion.div>

          <div className="pt-1 md:pt-4">
            {visual.next && content.nextText && (
              <button
                onClick={handleNavigate}
                className="group flex items-center gap-3 md:gap-4 bg-white px-6 md:px-8 py-4 md:py-5 rounded-2xl shadow-xl shadow-slate-200/50 hover:shadow-2xl hover:shadow-slate-300 transition-all text-slate-900"
              >
                <span className="font-black uppercase tracking-widest text-xs md:text-sm">
                  {content.nextText}
                </span>
                <div className="bg-slate-900 text-white p-1.5 md:p-2 rounded-lg group-hover:translate-x-2 transition-transform">
                  <ArrowRight size={18} />
                </div>
              </button>
            )}

            {currentRoom === 'varanda' && (
              <VarandaContent
                allKeysCollected={allKeysCollected}
                weddingLocation={weddingLocation}
                weddingDateStr={weddingDateStr}
                onShowRSVP={onShowRSVP}
                onShowGiftList={onShowGiftList}
              />
            )}
          </div>
        </div>
      </motion.div>
    );
  }
);

RoomView.displayName = 'RoomView';
