import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';

type View = 'menu' | 'free-pick' | 'real-pick' | 'online';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const { startSetup, setGameMode } = useGameActions();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  const handleNFTFreePlay = async () => {
    setLoading(true);
    try {
      const chars = await generateAllCollectionCharacters();
      setGameMode('nft-free', chars);
      startSetup();
    } finally {
      setLoading(false);
    }
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
            onFreePlay={() => setView('free-pick')}
            onPlayOnline={() => setView('real-pick')}
          />
        )}
        {view === 'free-pick' && (
          <FreePickView
            key="free-pick"
            onBack={() => setView('menu')}
            onCTVersion={handleFreePlay}
            onSchizodio={handleNFTFreePlay}
            loading={loading}
          />
        )}
        {view === 'real-pick' && (
          <RealPickView
            key="real-pick"
            onBack={() => setView('menu')}
            onNormal={() => setView('online')}
          />
        )}
        {view === 'online' && (
          <OnlineLobbyScreen
            key="online"
            onBack={() => setView('real-pick')}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Shared header / back button ───────────────────────────────────────────────

function SubHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      marginBottom: 32,
    }}>
      <motion.button
        onClick={onBack}
        whileHover={{ scale: 1.08, background: 'rgba(255,255,255,0.1)' }}
        whileTap={{ scale: 0.94 }}
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 10, padding: '8px 14px',
          cursor: 'pointer', outline: 'none',
          color: 'rgba(255,255,254,0.55)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14, fontWeight: 600,
          display: 'flex', alignItems: 'center', gap: 6,
        }}
      >
        ← Back
      </motion.button>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 18, fontWeight: 700, color: '#FFFFFE',
      }}>
        {title}
      </span>
    </div>
  );
}

// ─── Main menu view ─────────────────────────────────────────────────────────────

interface MenuMainProps {
  onFreePlay: () => void;
  onPlayOnline: () => void;
}

function MenuMain({ onFreePlay, onPlayOnline }: MenuMainProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
      }}
    >
      {/* Logo & Title */}
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <img
          src="/logo.png"
          alt="guessNFT"
          style={{
            width: 'clamp(120px, 30vw, 200px)',
            height: 'auto',
            borderRadius: '50%',
            filter: 'drop-shadow(0 0 40px rgba(124,58,237,0.4))',
            marginBottom: 12,
          }}
        />
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(28px, 8vw, 48px)',
          fontWeight: 800, letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          marginBottom: 4, filter: 'drop-shadow(0 0 30px rgba(232,164,68,0.3))',
        }}>
          guessNFT
        </div>
        <div style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.3))',
          border: '1px solid rgba(124,58,237,0.5)', borderRadius: 20,
          padding: '3px 14px', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          color: '#A78BFA', marginBottom: 14,
        }}>
          SCHIZODIO Premiere
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,254,0.38)', fontWeight: 500 }}>
          The classic family game, made schizo
        </div>
      </motion.div>

      {/* Two main tiles */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.42 }}
        style={{
          display: 'flex', gap: 'clamp(16px, 4vw, 28px)',
          alignItems: 'stretch', justifyContent: 'center',
        }}
      >
        <PlayRealTile onClick={onPlayOnline} />
        <PlayFreeTile onClick={onFreePlay} />
      </motion.div>
    </motion.div>
  );
}

// ─── Tile: Play for Real ───────────────────────────────────────────────────────

function PlayRealTile({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -6, boxShadow: '0 0 56px rgba(232,164,68,0.35), 0 8px 32px rgba(0,0,0,0.5)' }}
      whileTap={{ scale: 0.97 }}
      initial={false}
      style={{
        width: 'clamp(156px, 42vw, 188px)',
        height: 'clamp(228px, 60vw, 272px)',
        background: 'linear-gradient(165deg, #1c1228 0%, #0e0c1e 100%)',
        border: '1.5px solid rgba(232,164,68,0.5)', borderRadius: 16,
        cursor: 'pointer', outline: 'none', padding: 0, overflow: 'hidden',
        boxShadow: '0 0 28px rgba(232,164,68,0.16), 0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 55%, rgba(232,164,68,0.13) 0%, transparent 68%)',
        }} />
        <svg viewBox="0 0 120 140" width="100%" height="100%"
          style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="xMidYMid meet">
          <g opacity="0.82">
            <circle cx="28" cy="30" r="11" fill="#E8A444" opacity="0.65" />
            <rect x="21" y="41" width="14" height="28" rx="4" fill="#E8A444" opacity="0.45" />
            <line x1="35" y1="50" x2="58" y2="64" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
            <line x1="21" y1="50" x2="10" y2="62" stroke="#E8A444" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
            <line x1="24" y1="69" x2="18" y2="94" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
            <line x1="34" y1="69" x2="38" y2="94" stroke="#E8A444" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>
          <g opacity="0.82">
            <circle cx="92" cy="30" r="11" fill="#60CDFF" opacity="0.65" />
            <rect x="85" y="41" width="14" height="28" rx="4" fill="#60CDFF" opacity="0.45" />
            <line x1="85" y1="50" x2="62" y2="64" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.85" />
            <line x1="99" y1="50" x2="110" y2="62" stroke="#60CDFF" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
            <line x1="88" y1="69" x2="82" y2="94" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
            <line x1="98" y1="69" x2="102" y2="94" stroke="#60CDFF" strokeWidth="3.5" strokeLinecap="round" opacity="0.45" />
          </g>
          <line x1="56" y1="58" x2="64" y2="70" stroke="#E8A444" strokeWidth="2.5" opacity="0.5" />
          <line x1="64" y1="58" x2="56" y2="70" stroke="#60CDFF" strokeWidth="2.5" opacity="0.5" />
          <circle cx="60" cy="64" r="5" fill="none" stroke="#FFFFA0" strokeWidth="1.2" opacity="0.55" />
          <circle cx="60" cy="64" r="2" fill="#FFFFA0" opacity="0.6" />
          <text x="60" y="118" textAnchor="middle" fill="#E8A444" fontSize="20" fontWeight="900"
            fontFamily="Space Grotesk, sans-serif" opacity="0.9">1v1</text>
        </svg>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,164,68,0.45), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          Play for Real
        </div>
        <div style={{ fontSize: 10, color: 'rgba(232,164,68,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          SCHIZODIO NFTs
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#E8A444', boxShadow: '0 0 8px rgba(232,164,68,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Tile: Play for Free ───────────────────────────────────────────────────────

function PlayFreeTile({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, y: -6, boxShadow: '0 0 48px rgba(124,58,237,0.3), 0 8px 32px rgba(0,0,0,0.5)' }}
      whileTap={{ scale: 0.97 }}
      initial={false}
      style={{
        width: 'clamp(156px, 42vw, 188px)',
        height: 'clamp(228px, 60vw, 272px)',
        background: 'linear-gradient(165deg, #101428 0%, #080c1e 100%)',
        border: '1.5px solid rgba(124,58,237,0.4)', borderRadius: 16,
        cursor: 'pointer', outline: 'none', padding: 0, overflow: 'hidden',
        boxShadow: '0 0 22px rgba(124,58,237,0.12), 0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse at 50% 45%, rgba(124,58,237,0.15) 0%, transparent 68%)',
        }} />
        {/* AI brain SVG */}
        <svg viewBox="0 0 120 120" width="72%" height="72%" style={{ position: 'relative', zIndex: 1 }}>
          {/* Outer ring */}
          <circle cx="60" cy="60" r="44" fill="none" stroke="rgba(124,58,237,0.3)" strokeWidth="1.5" strokeDasharray="6 4" />
          {/* Inner circle */}
          <circle cx="60" cy="60" r="28" fill="rgba(124,58,237,0.12)" stroke="rgba(124,58,237,0.5)" strokeWidth="1.5" />
          {/* AI text */}
          <text x="60" y="67" textAnchor="middle" fill="#A78BFA" fontSize="22" fontWeight="800"
            fontFamily="Space Grotesk, sans-serif">AI</text>
          {/* Node dots on ring */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            return (
              <circle key={i}
                cx={60 + 44 * Math.cos(rad)} cy={60 + 44 * Math.sin(rad)}
                r="3.5" fill="#7C3AED" opacity="0.8"
              />
            );
          })}
          {/* Connection lines */}
          {[[0, 120], [60, 240], [300, 180]].map(([a, b], i) => {
            const r = 44;
            const ax = 60 + r * Math.cos((a * Math.PI) / 180);
            const ay = 60 + r * Math.sin((a * Math.PI) / 180);
            const bx = 60 + r * Math.cos((b * Math.PI) / 180);
            const by = 60 + r * Math.sin((b * Math.PI) / 180);
            return <line key={i} x1={ax} y1={ay} x2={bx} y2={by} stroke="rgba(124,58,237,0.25)" strokeWidth="1" />;
          })}
        </svg>
        {/* Free badge */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.28)', border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 10, padding: '2px 10px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', color: '#A78BFA',
          fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' as const,
        }}>
          FREE TO PLAY
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.38), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          Play for Free
        </div>
        <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          vs AI
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Free pick sub-view ─────────────────────────────────────────────────────────

interface FreePickProps {
  onBack: () => void;
  onCTVersion: () => void;
  onSchizodio: () => void;
  loading?: boolean;
}

function FreePickView({ onBack, onCTVersion, onSchizodio, loading }: FreePickProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column' }}>
        <SubHeader onBack={onBack} title="Play for Free" />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CT Version */}
          <OptionCard
            onClick={onCTVersion}
            accent="#7C3AED"
            accentRgb="124,58,237"
            icon="🤖"
            title="CT Version"
            subtitle="Crypto Twitter meme characters"
            tag="24 CHARACTERS"
          />
          {/* Schizodio vs AI */}
          <OptionCard
            onClick={loading ? () => { } : onSchizodio}
            accent="#06B6D4"
            accentRgb="6,182,212"
            icon="💀"
            title={loading ? "Loading..." : "Schizodio vs AI"}
            subtitle="Full SCHIZODIO NFT collection"
            tag="999 NFTS"
            disabled={loading}
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Real pick sub-view ─────────────────────────────────────────────────────────

interface RealPickProps {
  onBack: () => void;
  onNormal: () => void;
}

function RealPickView({ onBack, onNormal }: RealPickProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column' }}>
        <SubHeader onBack={onBack} title="Play for Real" />

        {/* Collection badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          marginBottom: 16,
        }}>
          <div style={{
            background: 'rgba(232,164,68,0.1)',
            border: '1px solid rgba(232,164,68,0.25)',
            borderRadius: 8, padding: '4px 12px',
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: 'rgba(232,164,68,0.7)',
            fontFamily: "'Space Grotesk', sans-serif",
            textTransform: 'uppercase' as const,
          }}>
            ⬡ SCHIZODIO Collection
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Normal */}
          <OptionCard
            onClick={onNormal}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon="⚔️"
            title="Normal"
            subtitle="Classic 1v1 — each player picks their SCHIZODIO"
            tag="ONLINE"
          />
          {/* SCHIZO Mode — soon */}
          <OptionCard
            onClick={() => { }}
            accent="#E05555"
            accentRgb="224,85,85"
            icon="🔥"
            title="SCHIZO Mode"
            subtitle="Bet your SCHIZODIO against your opponent's"
            tag="SOON"
            disabled
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Reusable horizontal option card ───────────────────────────────────────────

interface OptionCardProps {
  onClick: () => void;
  accent: string;
  accentRgb: string;
  icon: string;
  title: string;
  subtitle: string;
  tag: string;
  disabled?: boolean;
}

function OptionCard({ onClick, accent, accentRgb, icon, title, subtitle, tag, disabled }: OptionCardProps) {
  return (
    <motion.button
      onClick={disabled ? undefined : onClick}
      whileHover={disabled ? {} : { scale: 1.02, x: 4 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        background: disabled
          ? 'rgba(255,255,255,0.02)'
          : `rgba(${accentRgb},0.07)`,
        border: `1.5px solid ${disabled ? 'rgba(255,255,255,0.06)' : `rgba(${accentRgb},0.3)`}`,
        borderRadius: 14, padding: '16px 18px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none', textAlign: 'left', width: '100%',
        display: 'flex', alignItems: 'center', gap: 16,
        opacity: disabled ? 0.45 : 1,
        transition: 'background 0.2s, border-color 0.2s',
        fontFamily: "'Space Grotesk', sans-serif",
      }}
    >
      {/* Icon */}
      <div style={{
        width: 48, height: 48, borderRadius: 12, flexShrink: 0,
        background: disabled ? 'rgba(255,255,255,0.04)' : `rgba(${accentRgb},0.15)`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `rgba(${accentRgb},0.25)`}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>
        {icon}
      </div>

      {/* Text */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 15, fontWeight: 700,
          color: disabled ? 'rgba(255,255,254,0.35)' : '#FFFFFE',
          letterSpacing: '-0.01em', marginBottom: 3,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,254,0.38)',
          fontWeight: 400, lineHeight: 1.4,
        }}>
          {subtitle}
        </div>
      </div>

      {/* Tag */}
      <div style={{
        flexShrink: 0,
        background: disabled ? 'rgba(255,255,255,0.05)' : `rgba(${accentRgb},0.15)`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `rgba(${accentRgb},0.3)`}`,
        borderRadius: 8, padding: '3px 10px',
        fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
        color: disabled ? 'rgba(255,255,254,0.25)' : accent,
        textTransform: 'uppercase' as const,
      }}>
        {tag}
      </div>
    </motion.button>
  );
}
