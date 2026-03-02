import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../common/Button';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';

type View = 'menu' | 'online';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const { startSetup, setGameMode } = useGameActions();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  const handleNFTPlay = () => {
    setGameMode('nft');
    startSetup();
  };

  const handlePlayOnline = () => {
    setView('online');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: 20 }}
    >
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <MenuMain
            key="menu"
            onFreePlay={handleFreePlay}
            onNFTPlay={handleNFTPlay}
            onPlayOnline={handlePlayOnline}
          />
        )}

        {view === 'online' && (
          <OnlineLobbyScreen
            key="online"
            onBack={() => setView('menu')}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main menu view ───────────────────────────────────────────────────────────

interface MenuMainProps {
  onFreePlay: () => void;
  onNFTPlay: () => void;
  onPlayOnline: () => void;
}

function MenuMain({ onFreePlay, onNFTPlay, onPlayOnline }: MenuMainProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
      }}
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
        style={{ textAlign: 'center' }}
      >
        {/* Title */}
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(38px, 10vw, 64px)',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 4,
          filter: 'drop-shadow(0 0 40px rgba(232,164,68,0.3))',
        }}>
          WhoisWho
        </div>

        {/* Premiere badge */}
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.3))',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 20,
          padding: '3px 14px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: '#A78BFA',
          marginBottom: 16,
        }}>
          SCHIZODIO Premiere
        </div>

        <div style={{
          fontSize: 16,
          color: 'rgba(255,255,254,0.4)',
          marginBottom: 48,
          fontWeight: 500,
        }}>
          The classic family game, made schizo
        </div>

        {/* Buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
        >
          {/* Play Online — primary CTA */}
          <motion.button
            onClick={onPlayOnline}
            whileHover={{ scale: 1.03, filter: 'brightness(1.15)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontSize: 18,
              padding: '18px 48px',
              minWidth: 'min(280px, calc(100vw - 64px))',
              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              border: '1px solid rgba(124,58,237,0.5)',
              borderRadius: 14,
              color: '#FFFFFE',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              letterSpacing: '0.01em',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 0 40px rgba(124,58,237,0.3)',
            }}
          >
            🌐 Play Online
            <span style={{ opacity: 0.6, fontSize: 13, fontWeight: 500 }}>1v1</span>
          </motion.button>

          {/* Play for Real — NFT local 2P */}
          <motion.button
            onClick={onNFTPlay}
            whileHover={{ scale: 1.03, filter: 'brightness(1.12)' }}
            whileTap={{ scale: 0.97 }}
            style={{
              fontSize: 16,
              padding: '14px 40px',
              minWidth: 'min(280px, calc(100vw - 64px))',
              background: 'linear-gradient(135deg, rgba(232,164,68,0.18), rgba(200,130,30,0.28))',
              border: '1px solid rgba(232,164,68,0.45)',
              borderRadius: 14,
              color: '#E8A444',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(10px)',
              letterSpacing: '0.01em',
              outline: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 0 24px rgba(232,164,68,0.12)',
            }}
          >
            🎴 Play for Real
            <span style={{ opacity: 0.55, fontSize: 12, fontWeight: 500 }}>SCHIZODIO NFTs</span>
          </motion.button>

          {/* Play Free vs CPU — secondary */}
          <Button
            variant="accent"
            size="lg"
            onClick={onFreePlay}
            style={{ minWidth: 'min(280px, calc(100vw - 64px))', fontSize: 15, opacity: 0.85 }}
          >
            Try CT version for Free
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
