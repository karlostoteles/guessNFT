/**
 * No-NFT screen — shown when a connected wallet has 0 SCHIZODIO NFTs.
 * Displays the controller address and a link to mint/buy.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useWalletAddress } from '../starknet/walletStore';
import { sfx } from '../audio/sfx';

interface NoNFTScreenProps {
  onBack: () => void;
}

export function NoNFTScreen({ onBack }: NoNFTScreenProps) {
  const address = useWalletAddress();
  const [copied, setCopied] = useState(false);

  const shortAddress = address
    ? `${address.slice(0, 8)}...${address.slice(-6)}`
    : '';

  const handleCopy = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      sfx.click();
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard not available
    }
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
        zIndex: 30,
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.7) 0%, rgba(15,14,23,0.97) 70%)',
        padding: '40px 24px',
      }}
    >
      {/* Back button */}
      <motion.button
        onClick={() => { sfx.click(); onBack(); }}
        whileHover={{ x: -3 }}
        style={{
          position: 'absolute',
          left: 24,
          top: 24,
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,254,0.4)',
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 600,
          fontSize: 14,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 12px',
        }}
      >
        ← Back
      </motion.button>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 150 }}
        style={{ textAlign: 'center', maxWidth: 440 }}
      >
        {/* Icon */}
        <motion.div
          animate={{ rotate: [0, -5, 5, -5, 0] }}
          transition={{ repeat: Infinity, duration: 3, repeatDelay: 2 }}
          style={{ fontSize: 64, marginBottom: 24 }}
        >
          🫙
        </motion.div>

        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 28,
          fontWeight: 800,
          color: '#FFFFFE',
          marginBottom: 8,
        }}>
          No SCHIZODIO found
        </div>

        <div style={{
          fontSize: 15,
          color: 'rgba(255,255,254,0.45)',
          marginBottom: 36,
          lineHeight: 1.6,
        }}>
          You need at least one SCHIZODIO NFT to play for real.
          Send one to your wallet address below.
        </div>

        {/* Wallet address card */}
        {address && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 16,
              padding: '20px 24px',
              marginBottom: 24,
            }}
          >
            <div style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,254,0.3)',
              marginBottom: 8,
            }}>
              Your Starknet Address
            </div>

            <div style={{
              fontFamily: 'monospace',
              fontSize: 13,
              color: 'rgba(255,255,254,0.7)',
              wordBreak: 'break-all',
              marginBottom: 16,
              lineHeight: 1.5,
            }}>
              {address}
            </div>

            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              style={{
                width: '100%',
                padding: '10px 20px',
                border: copied
                  ? '1px solid rgba(76,175,80,0.5)'
                  : '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                background: copied
                  ? 'rgba(76,175,80,0.15)'
                  : 'rgba(255,255,255,0.08)',
                color: copied ? '#4CAF50' : '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {copied ? '✓ Copied!' : '📋 Copy Address'}
            </motion.button>
          </motion.div>
        )}

        {/* Marketplace link */}
        <motion.a
          href="https://unframed.co/collection/starknet/0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa"
          target="_blank"
          rel="noopener noreferrer"
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => sfx.click()}
          style={{
            display: 'block',
            padding: '14px 32px',
            background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(91,33,182,0.2))',
            border: '1px solid rgba(124,58,237,0.4)',
            borderRadius: 12,
            color: '#A78BFA',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            textDecoration: 'none',
            textAlign: 'center',
            marginBottom: 16,
          }}
        >
          🛒 Buy SCHIZODIO on Unframed →
        </motion.a>

        <div style={{
          fontSize: 12,
          color: 'rgba(255,255,254,0.2)',
          lineHeight: 1.5,
        }}>
          SCHIZODIO is a collection of 999 unique NFTs on Starknet.
          <br />After receiving one, reconnect your wallet.
        </div>
      </motion.div>
    </motion.div>
  );
}
