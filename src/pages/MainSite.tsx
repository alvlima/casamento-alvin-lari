import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { AnimatePresence } from 'framer-motion';
import { colors, type RoomId, type InventoryKey } from '../constants/theme';
import { NavHUD } from '../components/NavHUD';
import { IntroScreen } from '../components/IntroScreen';
import { RoomView } from '../components/RoomView';
import { FloatingMenu } from '../components/FloatingMenu';
import { fetchWeddingConfig, formatWeddingDate, type RoomContent } from '../services/weddingConfig';

const RSVPOverlay = lazy(() =>
  import('../components/RSVPOverlay').then((m) => ({ default: m.RSVPOverlay }))
);
const GiftList = lazy(() =>
  import('../components/GiftList').then((m) => ({ default: m.GiftList }))
);

export default function MainSite() {
  const [currentRoom, setCurrentRoom] = useState<RoomId>('entrada');
  const [inventory,   setInventory]   = useState<InventoryKey[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [showRSVP,    setShowRSVP]    = useState(false);
  const [showGiftList,setShowGiftList]= useState(false);

  // Configurações do casal vindas do banco de dados
  const [coupleName,     setCoupleName]     = useState('Álvaro & Larissa');
  const [homeName,       setHomeName]       = useState('Álvaro & Larissa');
  const [introTitle,     setIntroTitle]     = useState('Um Convite | para o lar que construímos.');
  const [introSubtitle,  setIntroSubtitle]  = useState('Cada cômodo tem uma história. Caminhe pelo nosso apartamento antes de nos encontrar no altar.');
  const [weddingLocation,  setWeddingLocation]   = useState('Mogi das Cruzes, SP');
  const [weddingDateStr,   setWeddingDateStr]    = useState('18 de Julho, 2026 • 16:00h');
  const [weddingIsoDate,   setWeddingIsoDate]    = useState('2026-07-18T16:00:00');
  const [roomsConfig,    setRoomsConfig]    = useState<Record<string, RoomContent>>({});

  useEffect(() => {
    fetchWeddingConfig().then((cfg) => {
      setCoupleName(cfg.couple.name);
      setHomeName(cfg.couple.home_name);
      setIntroTitle(cfg.site.intro_title);
      setIntroSubtitle(cfg.site.intro_subtitle);
      setWeddingLocation(cfg.couple.wedding_location);
      setWeddingDateStr(`${formatWeddingDate(cfg.couple.wedding_date)} • ${cfg.couple.wedding_time}h`);
      setWeddingIsoDate(`${cfg.couple.wedding_date}T${cfg.couple.wedding_time}:00`);
      if (Object.keys(cfg.rooms).length > 0) setRoomsConfig(cfg.rooms);
    }).catch(() => {/* mantém os defaults */});

    // Abre RSVP automaticamente quando há token de convite na URL
    if (new URLSearchParams(window.location.search).has('invite')) {
      setShowRSVP(true);
    }
  }, []);

  const handleStart        = useCallback(() => setGameStarted(true), []);
  const handleBack         = useCallback(() => { setGameStarted(false); setCurrentRoom('entrada'); }, []);
  const handleShowRSVP     = useCallback(() => setShowRSVP(true), []);
  const handleCloseRSVP    = useCallback(() => setShowRSVP(false), []);
  const handleShowGiftList = useCallback(() => setShowGiftList(true), []);
  const handleCloseGiftList= useCallback(() => setShowGiftList(false), []);

  const handleCollect = useCallback((key: InventoryKey) => {
    setInventory((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }, []);

  const handleNavigate = useCallback((room: RoomId) => {
    setCurrentRoom(room);
  }, []);

  return (
    <div className="min-h-screen font-sans" style={{ backgroundColor: colors.sonhoAnjo }}>
      <AnimatePresence>
        {gameStarted && <NavHUD inventory={inventory} coupleName={coupleName} />}
      </AnimatePresence>

      <main
        className={`min-h-screen flex justify-center px-4 relative ${
          gameStarted ? 'items-start pt-20 md:pt-28 pb-12 md:pb-16' : 'items-center p-6'
        }`}
      >
        <AnimatePresence mode="wait">
          {!gameStarted ? (
            <IntroScreen
              key="intro"
              introTitle={introTitle}
              introSubtitle={introSubtitle}
              homeName={homeName}
              weddingIsoDate={weddingIsoDate}
              onStart={handleStart}
              onShowRSVP={handleShowRSVP}
              onShowGiftList={handleShowGiftList}
            />
          ) : (
            <RoomView
              key={currentRoom}
              currentRoom={currentRoom}
              inventory={inventory}
              roomsConfig={roomsConfig}
              weddingLocation={weddingLocation}
              weddingDateStr={weddingDateStr}
              onCollect={handleCollect}
              onNavigate={handleNavigate}
              onBack={handleBack}
              onShowRSVP={handleShowRSVP}
              onShowGiftList={handleShowGiftList}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {(gameStarted || showRSVP || showGiftList) && (
          <FloatingMenu
            onShowRSVP={handleShowRSVP}
            onShowGiftList={handleShowGiftList}
            onGoHome={handleBack}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showRSVP && (
          <Suspense fallback={null}>
            <RSVPOverlay onClose={handleCloseRSVP} />
          </Suspense>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showGiftList && (
          <Suspense fallback={null}>
            <GiftList onClose={handleCloseGiftList} />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
