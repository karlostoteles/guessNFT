import { useState, useEffect } from 'react';
import { sfx } from '@/shared/audio/sfx';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { useWalletStatus, useWalletAddress } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { WalletButton } from '../widgets/WalletButton';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useOwnedNFTs } from '@/services/starknet/walletStore';
import { useGameStore } from '@/core/store/gameStore';

type View = 'menu' | 'free-pick' | 'real-pick' | 'online' | 'leaderboard';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const [nftStatus, setNftStatus] = useState<string>('');
  const { startSetup, setGameMode, recoverOnlineGame } = useGameActions();

  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  /** Instant Schizodio free play — loads full collection, no wallet needed */
  const handleSchizodioFreePlay = async () => {
    setLoading(true);
    setNftStatus('Loading Schizodio collection...');
    try {
      const allChars = await generateAllCollectionCharacters();
      setGameMode('nft-free', allChars);
      startSetup();
    } catch (err: any) {
      console.error('[MenuScreen] Collection load failed:', err);
      setNftStatus(`Error: ${err?.message || 'Failed to load collection'}`);
      await new Promise(r => setTimeout(r, 2000));
      setLoading(false);
      setNftStatus('');
    }
  };

  // Attempt session recovery on mount
  useEffect(() => {
    const saved = localStorage.getItem('guessnft_online_session');
    if (saved) {
      setLoading(true);
      setNftStatus('Reconnecting to room...');
      generateAllCollectionCharacters()
        .then((allChars) => {
          recoverOnlineGame(allChars);
          setView('online');
        })
        .finally(() => {
          setLoading(false);
          setNftStatus('');
        });
    }
  }, [recoverOnlineGame]);

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
            onLeaderboard={() => setView('leaderboard')}
          />
        )}
        {view === 'free-pick' && (
          <FreePickView
            key="free-pick"
            onBack={() => setView('menu')}
            onCTVersion={handleFreePlay}
            onSchizodio={handleSchizodioFreePlay}
            onSchizodioRandom={async () => {
              // Assign the player a random character bypassing the setup phase
              setLoading(true);
              setNftStatus('Assigning random character...');
              try {
                const allChars = await generateAllCollectionCharacters();
                setGameMode('nft-free', allChars);
                startSetup();
                useGameStore.getState().assignRandomSecretCharacter('player1');
              } catch (err: any) {
                console.error('[MenuScreen] Random collection load failed:', err);
              } finally {
                setLoading(false);
                setNftStatus('');
              }
            }}
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
        {view === 'leaderboard' && (
          <LeaderboardScreen
            key="leaderboard"
            onBack={() => setView('menu')}
          />
        )}
      </AnimatePresence>

      <LoadingOverlay loading={loading} status={nftStatus} />
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
        onClick={() => { sfx.click(); onBack(); }}
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
  onLeaderboard: () => void;
}

function MenuMain({ onFreePlay, onPlayOnline, onLeaderboard }: MenuMainProps) {
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingBottom: 'clamp(16px, 5vh, 10vh)',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Warm pastel ambient wash behind logo area */}
      <div style={{
        position: 'absolute',
        top: '-10%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '120%',
        height: '60%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(232,164,68,0.06) 0%, rgba(244,114,182,0.04) 30%, rgba(124,58,237,0.03) 50%, transparent 70%)',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* Spacer — pushes content to center when viewport is tall, collapses when scrolling */}
      <div style={{ flex: '1 1 0', minHeight: 0 }} />

      {/* ─── Top Left Controls ─── */}
      <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10 }}>
        <LoginButtonSection />
      </div>

      {/* ─── Top Right Controls ─── */}
      <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 10 }}>
        {/* Leaderboard Button */}
        <motion.button
          onClick={onLeaderboard}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'rgba(232,164,68,0.15)', border: '1px solid rgba(232,164,68,0.3)',
            borderRadius: 8, padding: '6px 10px', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#E8A444', cursor: 'pointer', outline: 'none',
          }}
        >
          🏆
        </motion.button>
        {/* Language Toggle */}
        <motion.button
          onClick={toggleLang}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.95 }}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8, padding: '6px 10px', fontSize: 12, fontWeight: 700,
            color: '#FFFFFE', cursor: 'pointer', fontFamily: "'Space Grotesk', sans-serif",
            outline: 'none',
          }}
        >
          {i18n.language.startsWith('es') ? '🇪🇸 ES' : '🇬🇧 EN'}
        </motion.button>
      </div>

      {/* ─── Logo: alive with pulsing glow + breathing scale ─── */}
      <motion.div
        initial={{ y: -120, opacity: 0, scale: 0.6, rotate: -10 }}
        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: 0.15, type: 'spring', stiffness: 120, damping: 12, mass: 0.8 }}
        style={{
          position: 'relative',
          zIndex: 2,
          marginBottom: 'clamp(-40px, -4vw, -16px)',
        }}
      >
        {/* Blurred gradient glow behind logo — pulses gold/pink/purple */}
        <div
          className="logo-glow-bg"
          style={{
            position: 'absolute',
            inset: '10%',
            borderRadius: '40%',
            background: 'radial-gradient(ellipse at 30% 50%, rgba(232,164,68,0.4) 0%, rgba(244,114,182,0.25) 35%, rgba(124,58,237,0.2) 60%, transparent 80%)',
            filter: 'blur(35px)',
            pointerEvents: 'none',
          }}
        />
        {/* Logo with screen blend — black bg becomes invisible */}
        <motion.img
          src="/newlogo.png"
          alt="guessNFT"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          style={{
            width: 'clamp(180px, 45vw, 360px)',
            height: 'auto',
            display: 'block',
            mixBlendMode: 'screen',
            position: 'relative',
          }}
        />
      </motion.div>

      {/* ─── Title: Pixar-style jumping letters ─── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '4px',
        marginBottom: 12, position: 'relative', zIndex: 1, width: '90%'
      }}>
        {t('menu.title').split(' ').map((word, wordIdx) => (
          <div key={`word-${wordIdx}`} style={{ display: 'flex', whiteSpace: 'pre' }}>
            {word.split('').map((char, charIdx) => {
              const letterIndex = wordIdx * 10 + charIdx; // rough staggered delay grouping
              return (
                <motion.span
                  key={`char-${wordIdx}-${charIdx}`}
                  initial={{ y: -40, opacity: 0, scale: 0.5 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 10 + Math.random() * 5,
                    delay: 0.6 + (letterIndex * 0.05), // stagger effect
                  }}
                  whileHover={{ y: -10, scale: 1.2, color: "#FFF" }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 'clamp(20px, 5vw, 36px)',
                    fontWeight: 800, letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #E8A444 0%, #F472B6 50%, #A78BFA 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 12px rgba(244,114,182,0.25))',
                    display: 'inline-block',
                    cursor: 'default',
                  }}
                >
                  {char}
                </motion.span>
              );
            })}
            {wordIdx !== t('menu.title').split(' ').length - 1 && <span style={{ width: '8px' }}></span>}
          </div>
        ))}
      </div>

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
          color: '#A78BFA', marginBottom: 12,
        }}
      >
        {t('menu.badge')}
      </motion.div>

      {/* ─── Subtitle: gentle fade in ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.8 }}
        style={{ fontSize: 15, color: 'rgba(255,255,254,0.55)', fontWeight: 500, marginBottom: 24, textAlign: 'center' }}
      >
        {t('menu.subtitle')}
      </motion.div>

      {/* Pastel accent divider */}
      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: 1.0, duration: 0.8, ease: 'easeOut' }}
        style={{
          width: 'clamp(120px, 30vw, 200px)',
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.35), rgba(167,139,250,0.35), transparent)',
          marginBottom: 16,
        }}
      />

      {/* ─── Two main tiles: slide in from sides ─── */}
      <div style={{
        display: 'flex', gap: 'clamp(12px, 3vw, 28px)',
        alignItems: 'stretch', justifyContent: 'center',
        flexWrap: 'wrap',
        marginTop: 20,
        padding: '0 16px',
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

      {/* Bottom spacer — mirrors top spacer for centering */}
      <div style={{ flex: '1 1 0', minHeight: 0 }} />
    </motion.div>
  );
}

// ─── Tile: Play for Real ───────────────────────────────────────────────────────

function PlayRealTile({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={() => { sfx.cardClick(); onClick(); }}
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
        <img
          src="/vs_background.jpg"
          alt="1Vs1 Background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 60%, rgba(14,12,30,0.9) 100%)',
        }} />
        <svg viewBox="0 0 120 120" width="100%" height="100%"
          style={{ position: 'absolute', inset: 0 }} preserveAspectRatio="xMidYMid meet">
          <text x="60" y="112" textAnchor="middle" fill="#E8A444" fontSize="14" fontWeight="900"
            fontFamily="Space Grotesk, sans-serif" opacity="0.9" letterSpacing="0.1em">1Vs1</text>
        </svg>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,164,68,0.45), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {t('menu.play_real')}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(232,164,68,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          {t('menu.play_real_sub')}
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
  const { t } = useTranslation();
  return (
    <motion.button
      onClick={() => { sfx.cardClick(); onClick(); }}
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
        <img
          src="/ai_background.jpg"
          alt="AI Background"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(8,12,30,0.95) 100%)',
        }} />
        {/* Free badge */}
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.28)', border: '1px solid rgba(124,58,237,0.5)',
          borderRadius: 10, padding: '2px 10px', fontSize: 10, fontWeight: 700,
          letterSpacing: '0.1em', color: '#A78BFA',
          fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' as const,
        }}>
          {t('menu.free_to_play')}
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.38), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {t('menu.practice')}
        </div>
        <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          {t('menu.practice_sub')}
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
  onSchizodioRandom: () => void;
}

function FreePickView({ onBack, onCTVersion, onSchizodio, onSchizodioRandom, loading, nftStatus }: FreePickProps) {
  const { t } = useTranslation();
  const { connectWallet } = useWalletConnection();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const [showNoNFTModal, setShowNoNFTModal] = useState(false);

  const handleSchizodioClick = () => {
    if (loading) return;
    if (walletStatus !== 'ready') {
      connectWallet();
      return;
    }
    // Logged in. Check NFTs.
    if (ownedNFTs.length === 0) {
      setShowNoNFTModal(true);
    } else {
      onSchizodio();
    }
  };

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
        <SubHeader onBack={onBack} title={t('menu.practice')} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* CT Version */}
          <OptionCard
            onClick={onCTVersion}
            accent="#7C3AED"
            accentRgb="124,58,237"
            icon="🤖"
            title={t('menu.ct_version')}
            subtitle={t('menu.ct_version_sub')}
            tag="24 CHARACTERS"
          />
          {/* Schizodio vs AI — requires login, prompts random if 0 NFTs */}
          <OptionCard
            onClick={handleSchizodioClick}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon="💀"
            title={nftStatus || t('menu.nft_version')}
            subtitle={walletStatus === 'ready' ? "Play with the full Schizodio collection." : "Login required to play Schizodio mode."}
            tag="999 CHARACTERS"
            disabled={loading}
          />
        </div>
      </div>

      {/* No NFT Modal */}
      <AnimatePresence>
        {showNoNFTModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 50,
              background: 'rgba(15,14,23,0.85)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              style={{
                width: '100%', maxWidth: 400,
                background: '#1c1228', border: '1px solid rgba(232,164,68,0.4)',
                borderRadius: 24, padding: 32,
                display: 'flex', flexDirection: 'column', gap: 24,
                boxShadow: '0 24px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>💀</div>
                <h3 style={{
                  fontFamily: "'Space Grotesk', sans-serif", fontSize: 24,
                  color: '#FFFFFE', margin: '0 0 8px 0'
                }}>
                  No Schizodios Found
                </h3>
                <p style={{
                  color: 'rgba(255,255,254,0.7)', fontSize: 15,
                  lineHeight: 1.5, margin: 0
                }}>
                  You need a Schizodio to select your own character. You can still play by letting us assign you a random character!
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => {
                    sfx.click();
                    setShowNoNFTModal(false);
                    onSchizodioRandom();
                  }}
                  style={{
                    width: '100%', padding: '16px',
                    background: '#E8A444', color: '#0f0e17',
                    border: 'none', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700,
                    cursor: 'pointer', outline: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🎲 Play with Random
                </button>
                <button
                  onClick={() => {
                    sfx.click();
                    window.open('https://schizodio.art', '_blank');
                  }}
                  style={{
                    width: '100%', padding: '16px',
                    background: 'rgba(255,255,255,0.05)', color: '#FFFFFE',
                    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600,
                    cursor: 'pointer', outline: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}
                >
                  🛒 Get an NFT at schizodio.art
                </button>
                <button
                  onClick={() => {
                    sfx.click();
                    setShowNoNFTModal(false);
                  }}
                  style={{
                    width: '100%', padding: '12px',
                    background: 'transparent', color: 'rgba(255,255,254,0.5)',
                    border: 'none', borderRadius: 12,
                    fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600,
                    cursor: 'pointer', outline: 'none', marginTop: 8,
                  }}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Real pick sub-view ─────────────────────────────────────────────────────────

interface RealPickProps {
  onBack: () => void;
  onNormal: () => void;
}

function RealPickView({ onBack, onNormal }: RealPickProps) {
  const { t } = useTranslation();
  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'fixed', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
        overflowY: 'auto',
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column', paddingTop: 24, paddingBottom: 32 }}>
        <SubHeader onBack={onBack} title={t('menu.play_real')} />

        {/* ─── SCHIZODIO Collection ─── */}
        <CollectionBadge label="SCHIZODIO" accentRgb="232,164,68" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <OptionCard
            onClick={onNormal}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon="⚔️"
            title={t('menu.normal')}
            subtitle={t('menu.normal_sub')}
            tag={t('menu.online')}
          />
          <OptionCard
            onClick={() => { }}
            accent="#E05555"
            accentRgb="224,85,85"
            icon="🔥"
            title={t('menu.schizo_mode')}
            subtitle={t('menu.schizo_mode_sub')}
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── DUCKS Collection ─── */}
        <CollectionBadge label="DUCKS" accentRgb="251,191,36" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <OptionCard
            onClick={() => { }}
            accent="#FBBF24"
            accentRgb="251,191,36"
            icon="D"
            title="Starknet Ducks"
            subtitle="The quackiest collection descends on the board"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── BLOBERT Collection ─── */}
        <CollectionBadge label="BLOBERT" accentRgb="167,139,250" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
          <OptionCard
            onClick={() => { }}
            accent="#A78BFA"
            accentRgb="167,139,250"
            icon="B"
            title="Blobert"
            subtitle="A magical assembly of highly intelligent blobs"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── SCHIZOSOL Collection ─── */}
        <CollectionBadge label="SCHIZOSOL" accentRgb="20,241,149" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <OptionCard
            onClick={() => { }}
            accent="#14F195"
            accentRgb="20,241,149"
            icon="S"
            title="SchizoSol"
            subtitle="The Solana integration expands the madness"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>
      </div>
    </motion.div>
  );
}

// ─── Reusable collection section badge ──────────────────────────────────────

function CollectionBadge({ label, accentRgb }: { label: string; accentRgb: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      marginBottom: 12,
    }}>
      <div style={{
        background: `rgba(${accentRgb},0.1)`,
        border: `1px solid rgba(${accentRgb},0.25)`,
        borderRadius: 8, padding: '4px 12px',
        fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
        color: `rgba(${accentRgb},0.7)`,
        fontFamily: "'Space Grotesk', sans-serif",
        textTransform: 'uppercase' as const,
      }}>
        ⬡ {label} Collection
      </div>
    </div>
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
      onClick={disabled ? undefined : () => { sfx.click(); onClick(); }}
      whileHover={disabled ? {} : { scale: 1.02, x: 4 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        background: disabled
          ? 'rgba(255,255,255,0.04)'
          : `rgba(${accentRgb},0.15)`,
        border: `1.5px solid ${disabled ? 'rgba(255,255,255,0.1)' : `rgba(${accentRgb},0.4)`}`,
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
        background: disabled ? 'rgba(255,255,255,0.06)' : `rgba(${accentRgb},0.2)`,
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.1)' : `rgba(${accentRgb},0.35)`}`,
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
  const { t } = useTranslation();
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
        {isConnecting ? <><Spinner /> {t('auth.authenticating')}</> : (
          <>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 8, opacity: 0.9 }}>
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            {t('auth.login')}
          </>
        )}
      </motion.button>
    </motion.div>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const size = large ? 32 : 14;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: size, height: size,
        border: `${large ? 3 : 2}px solid rgba(255,255,254,0.2)`,
        borderTopColor: '#FFFFFE',
        borderRadius: '50%',
      }}
    />
  );
}

function LoadingOverlay({ loading, status }: { loading: boolean; status: string }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 14, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            pointerEvents: 'auto',
          }}
        >
          <Card style={{ padding: '40px 60px', textAlign: 'center', minWidth: 280 }}>
            <Spinner large />
            <div style={{
              marginTop: 24,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 18,
              color: '#FFFFFE',
              letterSpacing: '-0.01em',
            }}>
              {status || 'Loading...'}
            </div>
            <div style={{
              marginTop: 8,
              fontSize: 12,
              color: 'rgba(255,255,254,0.4)',
            }}>
              Please wait while we sync with the blockchain
            </div>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'rgba(255, 255, 255, 0.05)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 16,
      padding: 24,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      ...style,
    }}>
      {children}
    </div>
  );
}
