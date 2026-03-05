import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { useWalletStore, useWalletStatus, useWalletAddress } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { WalletButton } from '../widgets/WalletButton';

type View = 'menu' | 'free-pick' | 'real-pick' | 'online';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const [nftStatus, setNftStatus] = useState<string>('');
  const { startSetup, setGameMode } = useGameActions();
  const { connectWallet } = useWalletConnection();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  /** Connect wallet → read owned Schizodios → start free game with those NFTs */
  const handleNFTFreePlay = async () => {
    setLoading(true);
    setNftStatus('Connecting wallet...');
    try {
      // Use the robust connection hook used in Online mode
      await connectWallet();

      const state = useWalletStore.getState();
      if (state.status === 'error') {
        throw new Error(state.error || 'Connection failed');
      }

      setNftStatus('Loading your collection...');

      // Wait for the hook to finish loading NFTs
      // We check every 500ms for up to 15 seconds
      let attempts = 0;
      while (useWalletStore.getState().status === 'loading_nfts' && attempts < 30) {
        await new Promise(r => setTimeout(r, 500));
        attempts++;
      }

      const finalState = useWalletStore.getState();
      const ownedCount = finalState.ownedNFTs.length;

      if (ownedCount === 0) {
        setNftStatus('No Schizodios found! Using full collection instead...');
        await new Promise(r => setTimeout(r, 1500));
      } else {
        setNftStatus(`Found ${ownedCount} Schizodios! Loading the board...`);
      }

      // Load the FULL collection (999 chars) for the board
      const allChars = await generateAllCollectionCharacters();

      setGameMode('nft-free', allChars);
      startSetup();
    } catch (err: any) {
      console.error('[MenuScreen] NFT ownership check failed:', err);
      setNftStatus(`Error: ${err?.message || 'Failed to connect'}`);
      await new Promise(r => setTimeout(r, 2000));
    } finally {
      setLoading(false);
      setNftStatus('');
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
            nftStatus={nftStatus}
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
        overflow: 'hidden',
      }}
    >
      {/* ─── Animated floating particles (background decoration) ─── */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`p${i}`}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.15, 0],
            y: [0, -60 - i * 20],
            x: [0, (i % 2 === 0 ? 30 : -30)],
          }}
          transition={{ duration: 4 + i, repeat: Infinity, delay: i * 0.7 }}
          style={{
            position: 'absolute',
            width: 4 + i * 2, height: 4 + i * 2,
            borderRadius: '50%',
            background: i % 2 === 0 ? '#E8A444' : '#7C3AED',
            left: `${15 + i * 13}%`,
            bottom: `${10 + i * 8}%`,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* ─── Logo: drops from above with bounce ─── */}
      <motion.img
        src="/logo.png"
        alt="guessNFT"
        initial={{ y: -120, opacity: 0, scale: 0.6, rotate: -10 }}
        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 12, mass: 0.8 }}
        style={{
          width: 'clamp(120px, 30vw, 200px)',
          height: 'auto',
          borderRadius: '50%',
          filter: 'drop-shadow(0 0 50px rgba(124,58,237,0.5))',
          marginBottom: 12,
        }}
      />

      {/* ─── Title: scales in with spring ─── */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 180, damping: 14 }}
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 'clamp(28px, 8vw, 48px)',
          fontWeight: 800, letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          filter: 'drop-shadow(0 0 30px rgba(232,164,68,0.3))',
          marginBottom: 4, textAlign: 'center',
        }}
      >
        guessNFT
      </motion.div>

      {/* ─── Badge: slides up with fade ─── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7, type: 'spring', stiffness: 200, damping: 20 }}
        style={{
          display: 'inline-block',
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(91,33,182,0.3))',
          border: '1px solid rgba(124,58,237,0.5)', borderRadius: 20,
          padding: '3px 14px', fontSize: 11, fontWeight: 700,
          letterSpacing: '0.12em', textTransform: 'uppercase' as const,
          color: '#A78BFA', marginBottom: 8,
        }}
      >
        SCHIZODIO Premiere
      </motion.div>

      {/* ─── Subtitle: gentle fade in ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.8 }}
        style={{ fontSize: 15, color: 'rgba(255,255,254,0.38)', fontWeight: 500, marginBottom: 24, textAlign: 'center' }}
      >
        The classic family game, made schizo
      </motion.div>

      {/* Login Button (if not connected) */}
      <LoginButtonSection />

      {/* ─── Two main tiles: slide in from sides ─── */}
      <div style={{
        display: 'flex', gap: 'clamp(16px, 4vw, 28px)',
        alignItems: 'stretch', justifyContent: 'center',
        marginTop: 24,
      }}>
        <motion.div
          initial={{ x: -100, opacity: 0, rotate: -5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 1.1, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <PlayRealTile onClick={onPlayOnline} />
        </motion.div>
        <motion.div
          initial={{ x: 100, opacity: 0, rotate: 5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 1.25, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <PlayFreeTile onClick={onFreePlay} />
        </motion.div>
      </div>
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
        <svg viewBox="0 0 120 120" width="100%" height="100%"
          style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="xMidYMid meet">

          {/* Penguin Mascot (Left) */}
          <g transform="translate(15, 35) scale(0.8)">
            {/* Body */}
            <ellipse cx="25" cy="45" rx="20" ry="25" fill="#FFFFFE" />
            <ellipse cx="25" cy="45" rx="16" ry="22" fill="#0F0E17" />
            <ellipse cx="25" cy="50" rx="10" ry="14" fill="#FFFFFE" />
            {/* Eyes */}
            <circle cx="18" cy="38" r="3" fill="#FFFFFE" />
            <circle cx="18" cy="38" r="1.5" fill="#000" />
            <circle cx="32" cy="38" r="3" fill="#FFFFFE" />
            <circle cx="32" cy="38" r="1.5" fill="#000" />
            {/* Beak */}
            <path d="M22 42 L28 42 L25 48 Z" fill="#E8A444" />
          </g>

          {/* VS Circle */}
          <circle cx="60" cy="65" r="15" fill="rgba(15, 14, 23, 0.8)" stroke="rgba(232, 164, 68, 0.3)" strokeWidth="1" />
          <text x="60" y="70" textAnchor="middle" fill="#E8A444" fontSize="12" fontWeight="900" fontFamily="Space Grotesk">VS</text>

          {/* Ape Mascot (Right) */}
          <g transform="translate(65, 35) scale(0.8)">
            {/* Head */}
            <rect x="5" y="25" width="40" height="35" rx="12" fill="#E8A444" opacity="0.9" />
            {/* Mouth/Muzzle */}
            <rect x="10" y="45" width="30" height="15" rx="8" fill="#F0C060" />
            {/* Eyes */}
            <rect x="12" y="32" width="8" height="8" rx="2" fill="#0F0E17" />
            <rect x="30" y="32" width="8" height="8" rx="2" fill="#0F0E17" />
            {/* Ears */}
            <circle cx="5" cy="40" r="6" fill="#E8A444" />
            <circle cx="45" cy="40" r="6" fill="#E8A444" />
          </g>

          <text x="60" y="112" textAnchor="middle" fill="#E8A444" fontSize="14" fontWeight="900"
            fontFamily="Space Grotesk, sans-serif" opacity="0.9" letterSpacing="0.1em">PENGU vs APE</text>
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
  nftStatus?: string;
}

function FreePickView({ onBack, onCTVersion, onSchizodio, loading, nftStatus }: FreePickProps) {
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
          {/* Schizodio vs AI — connects wallet & checks NFT ownership */}
          <OptionCard
            onClick={loading ? () => { } : onSchizodio}
            accent="#06B6D4"
            accentRgb="6,182,212"
            icon="💀"
            title={nftStatus || "Schizodio vs AI"}
            subtitle="Connect wallet & play with your NFTs"
            tag="NFT"
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

// ─── Login Button Section ──────────────────────────────────────────────────

function LoginButtonSection() {
  const status = useWalletStatus();
  const address = useWalletAddress();
  const { connectWallet } = useWalletConnection();
  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';
  const isConnecting = status === 'connecting' || status === 'loading_nfts';

  if (isConnected && address) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.0 }}
      style={{ marginBottom: 8 }}
    >
      <motion.button
        onClick={connectWallet}
        disabled={isConnecting}
        whileHover={isConnecting ? {} : { scale: 1.04, filter: 'brightness(1.1)', boxShadow: '0 0 40px rgba(124,58,237,0.45)' }}
        whileTap={isConnecting ? {} : { scale: 0.97 }}
        style={{
          background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
          border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 12,
          padding: '12px 32px',
          color: '#FFFFFE',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 15,
          cursor: isConnecting ? 'wait' : 'pointer',
          opacity: isConnecting ? 0.7 : 1,
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 0 20px rgba(124,58,237,0.25)',
        }}
      >
        {isConnecting ? <><Spinner /> Authenticating...</> : '🔐 Connect Wallet to Play'}
      </motion.button>
    </motion.div>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: 14, height: 14,
        border: '2px solid rgba(255,255,254,0.2)',
        borderTopColor: '#FFFFFE',
        borderRadius: '50%',
      }}
    />
  );
}
