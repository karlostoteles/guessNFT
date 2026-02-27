import { motion, AnimatePresence } from 'framer-motion';
import { useWalletStatus, useWalletUsername, useWalletAddress, useOwnedNFTs } from '../starknet/walletStore';
import { useWalletConnection } from '../starknet/hooks';

/**
 * Persistent wallet status widget — shows in the top-left corner.
 * Shows connect button when disconnected, or wallet info when connected.
 */
export function WalletButton() {
  const status = useWalletStatus();
  const username = useWalletUsername();
  const address = useWalletAddress();
  const nfts = useOwnedNFTs();
  const { connectWallet, disconnectWallet } = useWalletConnection();

  const isConnecting = status === 'connecting' || status === 'loading_nfts';
  const isConnected = status === 'connected' || status === 'ready' || status === 'loading_nfts';

  const displayName = username || (address ? `${address.slice(0, 6)}...${address.slice(-4)}` : '');

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      left: 16,
      zIndex: 50,
      pointerEvents: 'auto',
    }}>
      <AnimatePresence mode="wait">
        {!isConnected ? (
          <motion.button
            key="connect"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={connectWallet}
            disabled={isConnecting}
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              border: '1px solid rgba(124, 58, 237, 0.4)',
              borderRadius: 12,
              padding: '10px 20px',
              color: '#FFFFFE',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: isConnecting ? 'wait' : 'pointer',
              outline: 'none',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              opacity: isConnecting ? 0.7 : 1,
            }}
          >
            {isConnecting ? (
              <>
                <Spinner /> Connecting...
              </>
            ) : (
              <>
                <WalletIcon /> Connect Wallet
              </>
            )}
          </motion.button>
        ) : (
          <motion.div
            key="connected"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            style={{
              background: 'rgba(15, 14, 23, 0.85)',
              border: '1px solid rgba(124, 58, 237, 0.3)',
              borderRadius: 12,
              padding: '8px 14px',
              backdropFilter: 'blur(10px)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            {/* Green dot */}
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#4CAF50',
              boxShadow: '0 0 8px rgba(76, 175, 80, 0.5)',
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 12,
                color: '#FFFFFE',
              }}>
                {displayName}
              </span>
              {status === 'ready' && nfts.length > 0 && (
                <span style={{
                  fontSize: 10,
                  color: 'rgba(255,255,254,0.4)',
                }}>
                  {nfts.length} SCHIZO{nfts.length > 1 ? 's' : ''}
                </span>
              )}
              {status === 'loading_nfts' && (
                <span style={{
                  fontSize: 10,
                  color: 'rgba(124, 58, 237, 0.7)',
                }}>
                  Loading NFTs...
                </span>
              )}
            </div>

            <motion.button
              onClick={disconnectWallet}
              whileHover={{ scale: 1.1, color: '#E05555' }}
              whileTap={{ scale: 0.9 }}
              style={{
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,254,0.3)',
                cursor: 'pointer',
                padding: 4,
                outline: 'none',
                fontSize: 14,
                lineHeight: 1,
              }}
              title="Disconnect"
            >
              ✕
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function WalletIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
      <circle cx="16" cy="14" r="1.5" fill="currentColor" />
    </svg>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
      style={{
        width: 14,
        height: 14,
        border: '2px solid rgba(255,255,255,0.2)',
        borderTop: '2px solid #FFFFFE',
        borderRadius: '50%',
      }}
    />
  );
}
