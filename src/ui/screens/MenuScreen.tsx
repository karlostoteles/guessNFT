import { useState, useEffect } from 'react';
import { sfx } from '@/shared/audio/sfx';
import { AnimatePresence, motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { OnlineLobbyScreen } from './OnlineLobbyScreen';
import { useGameActions } from '@/core/store/selectors';
import { MEME_CHARACTERS } from '@/core/data/memeCharacters';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { useWalletStatus } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { WalletButton } from '../widgets/WalletButton';
import { LeaderboardScreen } from './LeaderboardScreen';
import { useOwnedNFTs, useWalletAddress } from '@/services/starknet/walletStore';
import { useGameStore } from '@/core/store/gameStore';

import { getActiveGamesForAddress } from '@/services/supabase/gameService';
import type { SupabaseGame } from '@/services/supabase/types';

type View = 'menu' | 'free-pick' | 'real-pick' | 'online' | 'leaderboard';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const [loading, setLoading] = useState(false);
  const [nftStatus, setNftStatus] = useState<string>('');
  const [recoverableGames, setRecoverableGames] = useState<SupabaseGame[]>([]);
  const { startSetup, setGameMode, recoverOnlineGame, setOnlineGame } = useGameActions();
  const walletStatus = useWalletStatus();
  const walletAddress = useWalletAddress();

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

  // Attempt session recovery on mount or wallet change
  useEffect(() => {
    const saved = localStorage.getItem('guessnft_online_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        const ONE_HOUR = 60 * 60 * 1000;
        if (Date.now() - parsed.timestamp < ONE_HOUR) {
          // If wallet matches or we don't have a wallet yet, try automatic recovery
          if (!walletAddress || parsed.playerAddress === walletAddress) {
            setLoading(true);
            setNftStatus('Reconnecting to room...');
            generateAllCollectionCharacters()
              .then((allChars) => {
                recoverOnlineGame(allChars, walletAddress || undefined);
                // If it successfully recovered (phase changed), go to online view
                if (useGameStore.getState().onlineGameId) {
                  setView('online');
                }
              })
              .finally(() => {
                setLoading(false);
                setNftStatus('');
              });
          }
        } else {
          localStorage.removeItem('guessnft_online_session');
        }
      } catch (e) {
        localStorage.removeItem('guessnft_online_session');
      }
    }

    // Also look for active games in DB when wallet is ready
    if (walletStatus === 'ready' && walletAddress) {
      getActiveGamesForAddress(walletAddress).then(games => {
        setRecoverableGames(games);
      });
    }
  }, [walletStatus, walletAddress, recoverOnlineGame]);

  const handleResumeGame = async (game: SupabaseGame) => {
    setLoading(true);
    setNftStatus('Resuming game...');
    try {
      const allChars = await generateAllCollectionCharacters();
      const playerNum = game.player1_address === walletAddress ? 1 : 2;
      setGameMode('online', allChars);
      setOnlineGame(game.id, game.room_code, playerNum as 1 | 2, walletAddress!);
      setView('online');
    } catch (err) {
      console.error('Failed to resume game:', err);
    } finally {
      setLoading(false);
      setNftStatus('');
    }
  };

  // Compute which sub-view to show within the 'menu' view
  const mainSubView =
    walletStatus === 'ready' ? 'mode-select' :
      (walletStatus === 'connecting' || walletStatus === 'connected' || walletStatus === 'loading_nfts') ? 'connecting' :
        'landing';

  // AnimatePresence key — drives transitions for all views
  const animKey = view === 'menu' ? mainSubView : view;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, pointerEvents: 'auto', zIndex: 20 }}
    >
      <AnimatePresence mode="wait">
        {animKey === 'landing' && (
          <LandingView
            key="landing"
            onFreePlay={() => setView('free-pick')}
            onLeaderboard={() => setView('leaderboard')}
          />
        )}
        {animKey === 'connecting' && (
          <ConnectingView
            key="connecting"
            walletStatus={walletStatus}
          />
        )}
        {animKey === 'mode-select' && (
          <ModeSelectView
            key="mode-select"
            onLocal={() => setView('free-pick')}
            onOnline={() => setView('real-pick')}
            onLeaderboard={() => setView('leaderboard')}
            recoverableGames={recoverableGames}
            onResumeGame={handleResumeGame}
          />
        )}
        {animKey === 'free-pick' && (
          <FreePickView
            key="free-pick"
            onBack={() => setView('menu')}
            onCTVersion={handleFreePlay}
            onSchizodio={handleSchizodioFreePlay}
            onSchizodioRandom={async () => {
              setLoading(true);
              setNftStatus('Assigning random character...');
              try {
                // If we don't have the characters yet, load them ONCE.
                if (useGameStore.getState().characters.length < 900) {
                  const allChars = await generateAllCollectionCharacters();
                  setGameMode('nft-free', allChars);
                }
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
        {animKey === 'real-pick' && (
          <RealPickView
            key="real-pick"
            onBack={() => setView('menu')}
            onNormal={() => setView('online')}
          />
        )}
        {animKey === 'online' && (
          <OnlineLobbyScreen
            key="online"
            onBack={() => setView('real-pick')}
          />
        )}
        {animKey === 'leaderboard' && (
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

// ─── Shared top-right controls (leaderboard + lang toggle) ───────────────────

function TopRightControls({ onLeaderboard }: { onLeaderboard: () => void }) {
  const { i18n } = useTranslation();
  const toggleLang = () => {
    i18n.changeLanguage(i18n.language.startsWith('es') ? 'en' : 'es');
  };
  return (
    <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, display: 'flex', gap: 10 }}>
      <motion.button
        onClick={onLeaderboard}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        style={{
          background: 'rgba(232,164,68,0.15)', border: '1px solid rgba(232,164,68,0.3)',
          borderRadius: 8, padding: '6px 10px', fontSize: 13,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#E8A444', cursor: 'pointer', outline: 'none',
        }}
      >
        🏆
      </motion.button>
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
  );
}

// ─── Shared logo + title block ────────────────────────────────────────────────

function LogoAndTitle({ delayBase = 0.15 }: { delayBase?: number }) {
  const { t } = useTranslation();
  return (
    <>
      <motion.div
        initial={{ y: -120, opacity: 0, scale: 0.6, rotate: -10 }}
        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0 }}
        transition={{ delay: delayBase, type: 'spring', stiffness: 120, damping: 12, mass: 0.8 }}
        style={{ position: 'relative', zIndex: 2, marginBottom: 'clamp(-40px, -4vw, -16px)' }}
      >
        <div
          className="logo-glow-bg"
          style={{
            position: 'absolute', inset: '10%', borderRadius: '40%',
            background: 'radial-gradient(ellipse at 30% 50%, rgba(232,164,68,0.4) 0%, rgba(244,114,182,0.25) 35%, rgba(124,58,237,0.2) 60%, transparent 80%)',
            filter: 'blur(35px)', pointerEvents: 'none',
          }}
        />
        <motion.img
          src="/newlogo.png"
          alt="guessNFT"
          animate={{ scale: [1, 1.03, 1] }}
          transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
          style={{
            width: 'clamp(180px, 45vw, 360px)', height: 'auto',
            display: 'block', mixBlendMode: 'screen', position: 'relative',
          }}
        />
      </motion.div>

      <div style={{
        display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center',
        gap: '4px', marginBottom: 12, position: 'relative', zIndex: 1, width: '90%',
      }}>
        {t('menu.title').split(' ').map((word, wordIdx) => (
          <div key={`word-${wordIdx}`} style={{ display: 'flex', whiteSpace: 'pre' }}>
            {word.split('').map((char, charIdx) => {
              const letterIndex = wordIdx * 10 + charIdx;
              return (
                <motion.span
                  key={`char-${wordIdx}-${charIdx}`}
                  initial={{ y: -40, opacity: 0, scale: 0.5 }}
                  animate={{ y: 0, opacity: 1, scale: 1 }}
                  transition={{
                    type: 'spring', stiffness: 300,
                    damping: 10 + Math.random() * 5,
                    delay: delayBase + 0.45 + (letterIndex * 0.05),
                  }}
                  whileHover={{ y: -10, scale: 1.2, color: '#FFF' }}
                  style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 'clamp(20px, 5vw, 36px)', fontWeight: 800, letterSpacing: '-0.02em',
                    background: 'linear-gradient(135deg, #E8A444 0%, #F472B6 50%, #A78BFA 100%)',
                    WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                    filter: 'drop-shadow(0 0 12px rgba(244,114,182,0.25))',
                    display: 'inline-block', cursor: 'default',
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

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delayBase + 0.8, duration: 0.8 }}
        style={{
          fontSize: 15, color: 'rgba(255,255,254,0.55)',
          fontWeight: 500, marginBottom: 24, textAlign: 'center',
        }}
      >
        {t('menu.subtitle')}
      </motion.div>

      <motion.div
        initial={{ scaleX: 0, opacity: 0 }}
        animate={{ scaleX: 1, opacity: 1 }}
        transition={{ delay: delayBase + 0.85, duration: 0.8, ease: 'easeOut' }}
        style={{
          width: 'clamp(120px, 30vw, 200px)', height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(244,114,182,0.35), rgba(167,139,250,0.35), transparent)',
          marginBottom: 32,
        }}
      />
    </>
  );
}

// ─── Landing view — shown when wallet is disconnected / error ─────────────────

function LandingView({ onFreePlay, onLeaderboard }: { onFreePlay: () => void; onLeaderboard: () => void }) {
  const { connectWallet } = useWalletConnection();

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
        overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      {/* Warm ambient glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '120%', height: '60%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(232,164,68,0.06) 0%, rgba(244,114,182,0.04) 30%, rgba(124,58,237,0.03) 50%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      <TopRightControls onLeaderboard={onLeaderboard} />

      <div style={{ flex: '1 1 0', minHeight: 0 }} />

      <LogoAndTitle delayBase={0.15} />

      {/* Primary CTA + Free mode link */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1, type: 'spring', stiffness: 260, damping: 24 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, position: 'relative', zIndex: 2 }}
      >
        <motion.button
          onClick={() => { sfx.click(); connectWallet(); }}
          whileHover={{ scale: 1.05, boxShadow: '0 0 48px rgba(232,164,68,0.5), 0 8px 32px rgba(0,0,0,0.5)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: 'linear-gradient(135deg, #E8A444, #D4922A)',
            border: '1px solid rgba(232,164,68,0.6)',
            borderRadius: 14, padding: '16px 48px',
            color: '#0f0e17', fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 17, fontWeight: 800, cursor: 'pointer', outline: 'none',
            boxShadow: '0 0 28px rgba(232,164,68,0.3), 0 4px 20px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Connect with Cartridge
        </motion.button>

        <motion.button
          onClick={() => { sfx.click(); onFreePlay(); }}
          whileHover={{ color: 'rgba(255,255,254,0.8)' }}
          whileTap={{ scale: 0.97 }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', outline: 'none',
            color: 'rgba(255,255,254,0.4)', fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14, fontWeight: 500,
          }}
        >
          Try free mode →
        </motion.button>
      </motion.div>

      <div style={{ flex: '1 1 0', minHeight: 0 }} />
    </motion.div>
  );
}

// ─── Connecting view — shown while wallet is connecting / loading NFTs ─────────

function ConnectingView({ walletStatus }: { walletStatus: string }) {
  const statusText =
    walletStatus === 'loading_nfts' ? 'Loading NFTs...' :
      walletStatus === 'connected' ? 'Checking NFTs...' :
        'Connecting...';

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
      <motion.img
        src="/newlogo.png"
        alt="guessNFT"
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        style={{
          width: 'clamp(120px, 30vw, 220px)', height: 'auto',
          display: 'block', mixBlendMode: 'screen', marginBottom: 32,
        }}
      />
      <Spinner large />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        style={{
          marginTop: 20,
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 16, fontWeight: 600,
          color: 'rgba(255,255,254,0.6)',
        }}
      >
        {statusText}
      </motion.div>
    </motion.div>
  );
}

// ─── Mode select view — shown after wallet is ready ───────────────────────────

function ModeSelectView({
  onLocal,
  onOnline,
  onLeaderboard,
  recoverableGames = [],
  onResumeGame
}: {
  onLocal: () => void;
  onOnline: () => void;
  onLeaderboard: () => void;
  recoverableGames?: SupabaseGame[];
  onResumeGame: (game: SupabaseGame) => void;
}) {
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
        overflowY: 'auto', overflowX: 'hidden',
      }}
    >
      {/* Warm ambient glow */}
      <div style={{
        position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)',
        width: '120%', height: '60%',
        background: 'radial-gradient(ellipse at 50% 40%, rgba(232,164,68,0.06) 0%, rgba(244,114,182,0.04) 30%, rgba(124,58,237,0.03) 50%, transparent 70%)',
        pointerEvents: 'none', zIndex: 0,
      }} />

      {/* WalletButton positions itself fixed top-left */}
      <WalletButton />

      <TopRightControls onLeaderboard={onLeaderboard} />

      <div style={{ flex: '1 1 0', minHeight: 0 }} />

      <LogoAndTitle delayBase={0} />

      {/* Recoverable Games Section */}
      {recoverableGames.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            width: 'min(400px, 90%)',
            background: 'rgba(232,164,68,0.05)',
            border: '1px solid rgba(232,164,68,0.2)',
            borderRadius: 16,
            padding: '16px 20px',
            marginBottom: 24,
            zIndex: 10,
          }}
        >
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#E8A444',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8
          }}>
            <span style={{ fontSize: 16 }}>⚡</span> Active Games Found
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {recoverableGames.slice(0, 2).map((game) => (
              <div
                key={game.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '10px 14px',
                  border: '1px solid rgba(255,255,255,0.05)'
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#FFFFFE' }}>Room: {game.room_code}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,254,0.4)', marginTop: 2 }}>
                    Last move {new Date(game.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <motion.button
                  whileHover={{ scale: 1.05, background: '#E8A444', color: '#0F0E17' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onResumeGame(game)}
                  style={{
                    background: 'rgba(232,164,68,0.15)',
                    border: '1px solid rgba(232,164,68,0.4)',
                    borderRadius: 8, padding: '6px 14px',
                    fontSize: 12, fontWeight: 700, color: '#E8A444',
                    cursor: 'pointer', outline: 'none', transition: 'all 0.2s'
                  }}
                >
                  Resume
                </motion.button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Two mode tiles */}
      <div style={{
        display: 'flex', gap: 'clamp(12px, 3vw, 28px)',
        alignItems: 'stretch', justifyContent: 'center',
        flexWrap: 'wrap', marginTop: 20, padding: '0 16px',
      }}>
        <motion.div
          initial={{ x: -100, opacity: 0, rotate: -5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <LocalGameTile onClick={onLocal} />
        </motion.div>
        <motion.div
          initial={{ x: 100, opacity: 0, rotate: 5 }}
          animate={{ x: 0, opacity: 1, rotate: 0 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 130, damping: 16 }}
        >
          <OnlineGameTile onClick={onOnline} />
        </motion.div>
      </div>

      <div style={{ flex: '1 1 0', minHeight: 0 }} />
    </motion.div>
  );
}

// ─── Tile: Local Game ──────────────────────────────────────────────────────────

function LocalGameTile({ onClick }: { onClick: () => void }) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setIsClicked(false);
    }, 250);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={!isClicked ? { scale: 1.04, y: -6, boxShadow: '0 0 48px rgba(124,58,237,0.3), 0 8px 32px rgba(0,0,0,0.5)' } : {}}
      whileTap={!isClicked ? { scale: 0.97 } : {}}
      animate={isClicked ? { scale: 0.95, rotateX: 60, y: 15, opacity: 0 } : { scale: 1, rotateX: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
      initial={false}
      style={{
        transformPerspective: 800, transformOrigin: 'bottom center',
        width: 'clamp(156px, 42vw, 188px)', height: 'clamp(228px, 60vw, 272px)',
        background: 'linear-gradient(165deg, #101428 0%, #080c1e 100%)',
        border: '1.5px solid rgba(124,58,237,0.4)', borderRadius: 16,
        cursor: 'pointer', outline: 'none', padding: 0, overflow: 'hidden',
        boxShadow: '0 0 22px rgba(124,58,237,0.12), 0 4px 20px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', position: 'relative',
      }}
    >
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          src="/images/practice-bg.jpg"
          alt="Local Game"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 40%, rgba(8,12,30,0.95) 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.4)',
          borderRadius: 8, padding: '2px 8px', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.08em', color: '#A78BFA',
          fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' as const,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          LOCAL
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(124,58,237,0.38), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          Local Game
        </div>
        <div style={{ fontSize: 10, color: 'rgba(167,139,250,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          Pass &amp; play or vs AI
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#7C3AED', boxShadow: '0 0 8px rgba(124,58,237,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Tile: Online Game ────────────────────────────────────────────────────────

function OnlineGameTile({ onClick }: { onClick: () => void }) {
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = () => {
    if (isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => {
      onClick();
      setIsClicked(false);
    }, 250);
  };

  return (
    <motion.button
      onClick={handleClick}
      whileHover={!isClicked ? { scale: 1.04, y: -6, boxShadow: '0 0 56px rgba(232,164,68,0.35), 0 8px 32px rgba(0,0,0,0.5)' } : {}}
      whileTap={!isClicked ? { scale: 0.97 } : {}}
      animate={isClicked ? { scale: 0.95, rotateX: 60, y: 15, opacity: 0 } : { scale: 1, rotateX: 0, y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeIn' }}
      initial={false}
      style={{
        transformPerspective: 800, transformOrigin: 'bottom center',
        width: 'clamp(156px, 42vw, 188px)', height: 'clamp(228px, 60vw, 272px)',
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
          alt="Online Game"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, transparent 60%, rgba(14,12,30,0.9) 100%)',
        }} />
        <div style={{
          position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(232,164,68,0.2)', border: '1px solid rgba(232,164,68,0.4)',
          borderRadius: 8, padding: '2px 8px', fontSize: 9, fontWeight: 700,
          letterSpacing: '0.08em', color: '#E8A444',
          fontFamily: "'Space Grotesk', sans-serif", whiteSpace: 'nowrap' as const,
          boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
        }}>
          ONLINE · LIVE
        </div>
      </div>
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(232,164,68,0.45), transparent)', flexShrink: 0 }} />
      <div style={{ padding: '11px 13px 13px', textAlign: 'left', fontFamily: "'Space Grotesk', sans-serif", flexShrink: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#FFFFFE', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          Online Game
        </div>
        <div style={{ fontSize: 10, color: 'rgba(232,164,68,0.65)', fontWeight: 700, marginTop: 3, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
          1v1 with Schizodio
        </div>
      </div>
      <div style={{
        position: 'absolute', top: 9, right: 9, width: 6, height: 6, borderRadius: '50%',
        background: '#E8A444', boxShadow: '0 0 8px rgba(232,164,68,0.9)',
      }} />
    </motion.button>
  );
}

// ─── Shared header / back button ───────────────────────────────────────────────

function SubHeader({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
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
  const ownedNFTs = useOwnedNFTs();
  const [showNoNFTModal, setShowNoNFTModal] = useState(false);

  const handleSchizodioClick = () => {
    if (loading) return;
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* CT Version */}
          <OptionCard
            onClick={onCTVersion}
            accent="#7C3AED"
            accentRgb="124,58,237"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2" />
                <circle cx="12" cy="5" r="2" />
                <path d="M12 7v4" />
                <line x1="8" y1="16" x2="8" y2="16" />
                <line x1="16" y1="16" x2="16" y2="16" />
              </svg>
            }
            title={t('menu.ct_version')}
            subtitle={t('menu.ct_version_sub')}
            tag="24 CHARS"
          />
          {/* Schizodio local — no mid-flow login; no-NFT modal handles zero-NFT case */}
          <OptionCard
            onClick={handleSchizodioClick}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2c-4.4 0-8 3.6-8 8 0 5 4 9 4 12h8c0-3 4-7 4-12 0-4.4-3.6-8-8-8z" />
                <path d="M5 10c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                <path d="M12 11v2" />
                <path d="M9 14h6" />
              </svg>
            }
            title={nftStatus || t('menu.nft_version')}
            subtitle="Play with the full Schizodio collection."
            tag="999 CHARS"
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
                <h3 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, color: '#FFFFFE', margin: '0 0 8px 0' }}>
                  No Schizodios Found
                </h3>
                <p style={{ color: 'rgba(255,255,254,0.7)', fontSize: 15, lineHeight: 1.5, margin: 0 }}>
                  You need a Schizodio to select your own character. You can still play by letting us assign you a random character!
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => { sfx.click(); setShowNoNFTModal(false); onSchizodioRandom(); }}
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
                  onClick={() => { sfx.click(); window.open('https://schizodio.art', '_blank'); }}
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
                  onClick={() => { sfx.click(); setShowNoNFTModal(false); }}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="SCHIZODIO" accentRgb="232,164,68" />
          <OptionCard
            onClick={onNormal}
            accent="#E8A444"
            accentRgb="232,164,68"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
                <path d="M13 19l6 2 3-3-2-6" />
                <path d="M9.5 14.5L3 21" />
                <path d="M21 3l-6.5 6.5" />
              </svg>
            }
            title={t('menu.normal')}
            subtitle={t('menu.normal_sub')}
            tag={t('menu.online')}
          />
          <OptionCard
            onClick={() => { }}
            accent="#E05555"
            accentRgb="224,85,85"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.5 3.5 6.5 1.5 2 1.5 3.5 1.5 4.5a2.5 2.5 0 0 1-5 0Z" />
                <path d="M12 22s-7-3-7-8c0-3.5 4.5-5.5 4.5-5.5s1.5 2.5 1.5 4c0 1.5-1.5 2.5-1.5 4 0 2 2.5 2 2.5 2s2.5 0 2.5-2c0-1.5-1.5-2.5-1.5-4 0-1.5 1.5-4 1.5-4s4.5 2 4.5 5.5c0 5-7 8-7 8Z" />
              </svg>
            }
            title={t('menu.schizo_mode')}
            subtitle={t('menu.schizo_mode_sub')}
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── DUCKS Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="DUCKS" accentRgb="251,191,36" />
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
        </div>

        {/* ─── BLOBERT Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
          <CollectionBadge label="BLOBERT" accentRgb="167,139,250" />
          <OptionCard
            onClick={() => { }}
            accent="#A78BFA"
            accentRgb="167,139,250"
            icon="🔮"
            title="Blobert"
            subtitle="A magical assembly of highly intelligent blobs"
            tag={t('menu.coming_soon')}
            disabled
          />
        </div>

        {/* ─── SCHIZOSOL Collection ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CollectionBadge label="SCHIZOSOL" accentRgb="20,241,149" />
          <OptionCard
            onClick={() => { }}
            accent="#14F195"
            accentRgb="20,241,149"
            icon="⛓️"
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

// ─── Reusable collection section badge ───────────────────────────────────────

function CollectionBadge({ label, accentRgb }: { label: string; accentRgb: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
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

// ─── Reusable horizontal option card ─────────────────────────────────────────

interface OptionCardProps {
  onClick: () => void;
  accent: string;
  accentRgb: string;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  tag: string;
  disabled?: boolean;
}

function OptionCard({ onClick, accent, accentRgb, icon, title, subtitle, tag, disabled }: OptionCardProps) {
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isClicked, setIsClicked] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (disabled || isClicked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    setRotateX((y - centerY) / 8);
    setRotateY((centerX - x) / 12);
  };

  const handleMouseLeave = () => {
    if (isClicked) return;
    setRotateX(0);
    setRotateY(0);
  };

  const handleClick = () => {
    if (disabled || isClicked) return;
    sfx.cardClick();
    setIsClicked(true);
    setTimeout(() => { onClick(); }, 300);
  };

  return (
    <div style={{ perspective: '800px', width: '100%' }}>
      <motion.button
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        animate={isClicked
          ? { rotateX: 60, opacity: 0, y: 20, scale: 0.95 }
          : { rotateX, rotateY, opacity: 1, y: 0, scale: 1 }
        }
        whileHover={(disabled || isClicked) ? {} : { scale: 1.02 }}
        whileTap={(disabled || isClicked) ? {} : { scale: 0.98, rotateX: 0, rotateY: 0 }}
        transition={{
          type: isClicked ? 'spring' : 'tween',
          stiffness: 300, damping: 20,
          duration: isClicked ? 0.3 : 0.1,
        }}
        style={{
          position: 'relative',
          background: disabled
            ? 'rgba(255,255,255,0.03)'
            : `linear-gradient(145deg, rgba(${accentRgb},0.2) 0%, rgba(${accentRgb},0.08) 100%)`,
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.08)' : `rgba(${accentRgb},0.45)`}`,
          borderRadius: 18, padding: '20px 22px',
          cursor: (disabled || isClicked) ? 'not-allowed' : 'pointer',
          outline: 'none', textAlign: 'left', width: '100%',
          display: 'flex', alignItems: 'center', gap: 20,
          opacity: disabled ? 0.4 : 1,
          boxShadow: (disabled || isClicked)
            ? '0 4px 12px rgba(0,0,0,0.2)'
            : `0 12px 28px rgba(0,0,0,0.35), 0 0 0 1px rgba(${accentRgb}, 0.1), inset 0 1px 1px rgba(255,255,255,0.1)`,
          transformStyle: 'preserve-3d',
          transformOrigin: 'bottom center',
          fontFamily: "'Space Grotesk', sans-serif",
          overflow: 'hidden',
        }}
      >
        {/* Shine */}
        {!disabled && !isClicked && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 40%, transparent 60%, rgba(255,255,255,0.05) 100%)',
            pointerEvents: 'none', zIndex: 1,
          }} />
        )}
        {/* Noise */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          opacity: 0.04, mixBlendMode: 'overlay',
          pointerEvents: 'none', zIndex: 0,
        }} />
        {/* Icon */}
        <div style={{
          width: 56, height: 56, borderRadius: 14, flexShrink: 0,
          background: disabled ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.25)',
          border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : `rgba(${accentRgb},0.3)`}`,
          boxShadow: 'inset 0 4px 10px rgba(0,0,0,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24,
          color: (disabled || isClicked) ? 'rgba(255,255,254,0.2)' : accent,
          zIndex: 2, position: 'relative', transform: 'translateZ(20px)',
        }}>
          {icon}
        </div>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0, zIndex: 2, transform: 'translateZ(10px)' }}>
          <div style={{
            fontSize: 16, fontWeight: 800,
            color: (disabled || isClicked) ? 'rgba(255,255,254,0.3)' : '#FFFFFE',
            letterSpacing: '-0.02em', marginBottom: 4,
            textShadow: (disabled || isClicked) ? 'none' : '0 2px 4px rgba(0,0,0,0.3)',
          }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.35)', fontWeight: 400, lineHeight: 1.45 }}>
            {subtitle}
          </div>
        </div>
        {/* Tag */}
        <div style={{
          flexShrink: 0,
          background: (disabled || isClicked) ? 'rgba(255,255,255,0.04)' : `rgba(${accentRgb},0.25)`,
          border: `1px solid ${(disabled || isClicked) ? 'rgba(255,255,255,0.06)' : `rgba(${accentRgb},0.5)`}`,
          borderRadius: 8, padding: '4px 11px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
          color: (disabled || isClicked) ? 'rgba(255,255,254,0.2)' : '#FFF',
          textTransform: 'uppercase' as const,
          zIndex: 3, transform: 'translateZ(30px)',
          boxShadow: (disabled || isClicked) ? 'none' : `0 4px 12px rgba(0,0,0,0.25), 0 0 10px rgba(${accentRgb}, 0.2)`,
        }}>
          {tag}
        </div>
      </motion.button>
    </div>
  );
}

// ─── Spinner ──────────────────────────────────────────────────────────────────

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

// ─── Loading overlay ──────────────────────────────────────────────────────────

function LoadingOverlay({ loading, status }: { loading: boolean; status: string }) {
  return (
    <AnimatePresence>
      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(15, 14, 23, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 100, pointerEvents: 'auto',
          }}
        >
          <Card style={{ padding: '40px 60px', textAlign: 'center', minWidth: 280 }}>
            <Spinner large />
            <div style={{
              marginTop: 24,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700, fontSize: 18, color: '#FFFFFE', letterSpacing: '-0.01em',
            }}>
              {status || 'Loading...'}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,254,0.4)' }}>
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
      borderRadius: 16, padding: 24,
      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
      ...style,
    }}>
      {children}
    </div>
  );
}
