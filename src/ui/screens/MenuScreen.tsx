import { useState, useEffect } from 'react';
import { sfx } from '@/shared/audio/sfx';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { useWalletStore, useWalletStatus, useWalletAddress } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { WalletButton } from '../widgets/WalletButton';
import { LeaderboardScreen } from './LeaderboardScreen';

type View = 'menu' | 'free-pick' | 'real-pick' | 'online' | 'leaderboard';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const [nftStatus, setNftStatus] = useState<string>('');
  const { startSetup, setGameMode, recoverOnlineGame } = useGameActions();
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
        alignItems: 'center', justifyContent: 'center',
        paddingBottom: '10vh', // shifts the entire block slightly upwards
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        overflow: 'hidden',
      }}
    >
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

      {/* ─── Animated floating meme NFTs (background decoration) ─── */}
      {[...Array(6)].map((_, i) => (
        <motion.img
          key={`nft_float_${i}`}
          src={`/nft/${i + 1}.png`} // Assuming nft 1.png to 6.png exist based on standard Schizodio numbers
          alt="Floating Meme"
          initial={{ opacity: 0, rotate: Math.random() * 360, scale: 0.5 }}
          animate={{
            opacity: [0, 0.25, 0],
            y: [0, -100 - i * 30],
            x: [0, (i % 2 === 0 ? 50 : -50)],
            rotate: [Math.random() * 360, Math.random() * 360 + 100],
          }}
          transition={{ duration: 6 + i, repeat: Infinity, delay: i * 0.9, ease: "linear" }}
          style={{
            position: 'absolute',
            width: 40 + i * 10, height: 40 + i * 10,
            borderRadius: '12px',
            left: `${15 + i * 13}%`,
            bottom: `${5 + i * 10}%`,
            pointerEvents: 'none',
            filter: 'drop-shadow(0 0 10px rgba(0,0,0,0.5))',
            objectFit: 'cover'
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
          width: 'clamp(180px, 45vw, 360px)',
          height: 'auto',
          filter: 'drop-shadow(0 0 50px rgba(124,58,237,0.5))',
          marginBottom: -32, // Aggressively reduced spacing between logo and subtitle
          position: 'relative',
          zIndex: 2,
        }}
      />

      {/* ─── Title: Pixar-style jumping letters ─── */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '4px',
        marginBottom: 8, position: 'relative', zIndex: 1, width: '90%'
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
                    background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 10px rgba(232,164,68,0.2))',
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
          color: '#A78BFA', marginBottom: 8,
        }}
      >
        {t('menu.badge')}
      </motion.div>

      {/* ─── Subtitle: gentle fade in ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.95, duration: 0.8 }}
        style={{ fontSize: 15, color: 'rgba(255,255,254,0.38)', fontWeight: 500, marginBottom: 24, textAlign: 'center' }}
      >
        {t('menu.subtitle')}
      </motion.div>

      {/* Login Button (if not connected) */}
      <LoginButtonSection />

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
}

function FreePickView({ onBack, onCTVersion, onSchizodio, loading, nftStatus }: FreePickProps) {
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
          {/* Schizodio vs AI — connects wallet & checks NFT ownership */}
          <OptionCard
            onClick={loading ? () => { } : onSchizodio}
            accent="#06B6D4"
            accentRgb="6,182,212"
            icon="💀"
            title={nftStatus || t('menu.nft_version')}
            subtitle={t('menu.nft_version_sub')}
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
        alignItems: 'center', justifyContent: 'center',
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
        padding: 24,
      }}
    >
      <div style={{ width: 'min(480px, 100%)', display: 'flex', flexDirection: 'column' }}>
        <SubHeader onBack={onBack} title={t('menu.play_real')} />

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
            title={t('menu.normal')}
            subtitle={t('menu.normal_sub')}
            tag={t('menu.online')}
          />
          {/* SCHIZO Mode — soon */}
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
          {/* Ducks — soon */}
          <OptionCard
            onClick={() => { }}
            accent="#FBBF24"
            accentRgb="251,191,36"
            icon="🦆"
            title="Starknet Ducks"
            subtitle="The quackiest collection descends on the board"
            tag={t('menu.coming_soon')}
            disabled
          />
          {/* Blobert — soon */}
          <OptionCard
            onClick={() => { }}
            accent="#A78BFA"
            accentRgb="167,139,250"
            icon="🧙‍♂️"
            title="Blobert"
            subtitle="A magical assembly of highly intelligent blobs"
            tag={t('menu.coming_soon')}
            disabled
          />
          {/* SchizoSol — soon */}
          <OptionCard
            onClick={() => { }}
            accent="#14F195"
            accentRgb="20,241,149"
            icon="☀️"
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
