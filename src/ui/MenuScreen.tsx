import { motion } from 'framer-motion';
import { Button } from './common/Button';
import { useGameActions } from '../store/selectors';
import { useWalletStatus, useOwnedNFTs, useIsWalletReady } from '../starknet/walletStore';
import { useWalletConnection } from '../starknet/hooks';
import { CHARACTERS } from '../data/characters';
import { selectGameCharacters } from '../data/nftCharacterAdapter';

export function MenuScreen() {
  const { startSetup, setGameMode } = useGameActions();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const isWalletReady = useIsWalletReady();
  const { connectWallet } = useWalletConnection();

  const hasNFTs = isWalletReady && ownedNFTs.length > 0;
  const isConnecting = walletStatus === 'connecting' || walletStatus === 'loading_nfts';

  const handleFreePlay = () => {
    setGameMode('free', CHARACTERS);
    startSetup();
  };

  const handleNFTPlay = () => {
    if (!hasNFTs) return;
    const gameChars = selectGameCharacters(ownedNFTs, CHARACTERS);
    setGameMode('nft', gameChars);
    startSetup();
  };

  const handleConnectAndPlay = async () => {
    await connectWallet();
  };

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
        pointerEvents: 'auto',
        zIndex: 20,
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
          marginBottom: 8,
          textShadow: 'none',
          filter: 'drop-shadow(0 0 40px rgba(232,164,68,0.3))',
        }}>
          WhoisWho
        </div>

        <div style={{
          fontSize: 16,
          color: 'rgba(255,255,254,0.4)',
          marginBottom: 48,
          fontWeight: 500,
        }}>
          The classic guessing game — on chain
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
          {/* Free Play — always available */}
          <Button variant="accent" size="lg" onClick={handleFreePlay} style={{
            fontSize: 18,
            padding: '18px 48px',
            minWidth: 260,
          }}>
            Play Free
          </Button>

          {/* NFT Play — requires wallet + NFTs */}
          {hasNFTs ? (
            <Button
              variant="primary"
              size="lg"
              onClick={handleNFTPlay}
              style={{
                fontSize: 16,
                padding: '14px 36px',
                minWidth: 260,
                background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                border: '1px solid rgba(124, 58, 237, 0.4)',
              }}
            >
              Play with NFTs ({ownedNFTs.length} SCHIZO{ownedNFTs.length > 1 ? 's' : ''})
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="lg"
              onClick={handleConnectAndPlay}
              disabled={isConnecting}
              style={{
                fontSize: 14,
                padding: '14px 36px',
                minWidth: 260,
                opacity: isConnecting ? 0.6 : 0.8,
              }}
            >
              {isConnecting
                ? 'Connecting...'
                : isWalletReady
                  ? 'No SCHIZODIO NFTs found'
                  : 'Connect Wallet to Play with NFTs'
              }
            </Button>
          )}
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
          Local 2-Player — Take turns on the same screen
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
