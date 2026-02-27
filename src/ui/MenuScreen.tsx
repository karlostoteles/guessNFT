import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from './common/Button';
import { SchizodioPickerScreen } from './SchizodioPickerScreen';
import { NoNFTScreen } from './NoNFTScreen';
import { useGameActions } from '../store/selectors';
import { useWalletStatus, useOwnedNFTs, useIsWalletReady, useWalletStore } from '../starknet/walletStore';
import { useWalletConnection } from '../starknet/hooks';
import { MEME_CHARACTERS } from '../data/memeCharacters';
import { selectGameCharacters, nftToCharacter } from '../data/nftCharacterAdapter';
import type { SchizodioNFT } from '../starknet/types';

type View = 'menu' | 'picker' | 'no-nft';

export function MenuScreen() {
  const [view, setView] = useState<View>('menu');
  const { startSetup, setGameMode, selectSecretCharacter } = useGameActions();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const isWalletReady = useIsWalletReady();
  const { connectWallet } = useWalletConnection();

  const hasNFTs = isWalletReady && ownedNFTs.length > 0;
  const isConnecting = walletStatus === 'connecting' || walletStatus === 'loading_nfts';

  // Free play uses meme crypto characters vs CPU
  const handleFreePlay = () => {
    setGameMode('free', MEME_CHARACTERS);
    startSetup();
  };

  // "Play for Real" button handler
  const handlePlayForReal = async () => {
    if (isConnecting) return;

    if (!isWalletReady) {
      // Not connected — trigger Cartridge Controller login
      await connectWallet();
      // Re-read store state after async connect
      const state = useWalletStore.getState();
      if (state.status === 'ready') {
        if (state.ownedNFTs.length > 0) {
          setView('picker');
        } else {
          setView('no-nft');
        }
      }
      return;
    }

    if (hasNFTs) {
      setView('picker');
    } else {
      setView('no-nft');
    }
  };

  // Player selected their Schizodio to play as (secret character)
  const handleSchizodioSelected = (nft: SchizodioNFT) => {
    const gameChars = selectGameCharacters(ownedNFTs, MEME_CHARACTERS);
    const selectedChar = nftToCharacter(nft);

    // Ensure selected character appears on the board
    let finalChars = gameChars;
    if (!gameChars.find((c) => c.id === selectedChar.id)) {
      finalChars = [...gameChars.slice(0, -1), selectedChar];
    }

    setGameMode('nft', finalChars);
    startSetup();
    // Pre-select their chosen NFT as P1's secret character
    selectSecretCharacter('player1', selectedChar.id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <AnimatePresence mode="wait">
        {view === 'menu' && (
          <MenuMain
            key="menu"
            hasNFTs={hasNFTs}
            isConnecting={isConnecting}
            isWalletReady={isWalletReady}
            ownedNFTs={ownedNFTs}
            onFreePlay={handleFreePlay}
            onPlayForReal={handlePlayForReal}
          />
        )}

        {view === 'picker' && (
          <SchizodioPickerScreen
            key="picker"
            nfts={ownedNFTs}
            onSelect={handleSchizodioSelected}
            onBack={() => setView('menu')}
          />
        )}

        {view === 'no-nft' && (
          <NoNFTScreen
            key="no-nft"
            onBack={() => setView('menu')}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main menu view ───────────────────────────────────────────────────────────

interface MenuMainProps {
  hasNFTs: boolean;
  isConnecting: boolean;
  isWalletReady: boolean;
  ownedNFTs: SchizodioNFT[];
  onFreePlay: () => void;
  onPlayForReal: () => void;
}

function MenuMain({
  hasNFTs,
  isConnecting,
  isWalletReady,
  ownedNFTs,
  onFreePlay,
  onPlayForReal,
}: MenuMainProps) {
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
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 4,
          textShadow: 'none',
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

        {/* Dual-mode buttons */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
            alignItems: 'center',
          }}
        >
          {/* Free Play vs CPU */}
          <Button variant="accent" size="lg" onClick={onFreePlay} style={{
            fontSize: 18,
            padding: '18px 48px',
            minWidth: 280,
          }}>
            Play Free{' '}
            <span style={{ opacity: 0.6, fontSize: 13 }}>vs CPU</span>
          </Button>

          {/* Play for Real — requires wallet + NFTs */}
          <motion.button
            onClick={onPlayForReal}
            disabled={isConnecting}
            whileHover={isConnecting ? {} : { scale: 1.03, filter: 'brightness(1.1)' }}
            whileTap={isConnecting ? {} : { scale: 0.97 }}
            style={{
              fontSize: hasNFTs ? 16 : 14,
              padding: '14px 36px',
              minWidth: 280,
              background: hasNFTs
                ? 'linear-gradient(135deg, #7C3AED, #5B21B6)'
                : 'rgba(255,255,255,0.05)',
              border: hasNFTs
                ? '1px solid rgba(124, 58, 237, 0.4)'
                : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: hasNFTs ? '#FFFFFE' : 'rgba(255,255,254,0.5)',
              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              fontWeight: 600,
              cursor: isConnecting ? 'not-allowed' : 'pointer',
              opacity: isConnecting ? 0.6 : 1,
              backdropFilter: 'blur(10px)',
              letterSpacing: '0.02em',
              outline: 'none',
            }}
          >
            {isConnecting
              ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                  <ConnectingSpinner />
                  Connecting...
                </span>
              )
              : hasNFTs
                ? (
                  <>
                    Play for Real{' '}
                    <span style={{ opacity: 0.6, fontSize: 13 }}>
                      {ownedNFTs.length} SCHIZO{ownedNFTs.length > 1 ? 's' : ''}
                    </span>
                  </>
                )
                : isWalletReady
                  ? '🫙 No SCHIZODIO found — get one!'
                  : 'Login to Play for Real'
            }
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            marginTop: 40,
            fontSize: 12,
            color: 'rgba(255,255,254,0.2)',
          }}
        >
          Online 1v1 — Play against a friend anywhere in the world
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function ConnectingSpinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.7)',
        borderRadius: '50%',
        display: 'inline-block',
      }}
    />
  );
}
