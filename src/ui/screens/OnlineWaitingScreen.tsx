/**
 * OnlineWaitingScreen
 *
 * Shown in ONLINE_WAITING phase — local player has committed their character,
 * waiting for the opponent to do the same.
 *
 * Renders as a small chip at the bottom of the screen so the 3D board is
 * fully visible while waiting. P1 (creator) sees a compact room code to copy.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineRoomCode, useOnlinePlayerNum, useOnChainCommitmentHash, useGameActions } from '@/core/store/selectors';
import { getExplorerLink } from '@/services/starknet/commitReveal';
import { useGameStore } from '@/core/store/gameStore';

export function OnlineWaitingScreen() {
  const roomCode  = useOnlineRoomCode();
  const playerNum = useOnlinePlayerNum();
  const txHash    = useOnChainCommitmentHash();
  const { cancelGameOnChain, resetGame } = useGameActions();
  const [copied, setCopied] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const handleCopy = () => {
    if (!roomCode) return;
    navigator.clipboard.writeText(roomCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCreator = playerNum === 1;

  const handleCancel = async () => {
    if (cancelling) return;
    if (!confirm('Cancel this game and reclaim your NFT? (Requires signature)')) return;
    
    setCancelling(true);
    try {
      await cancelGameOnChain();
      resetGame();
    } catch (err: any) {
      console.error('Failed to cancel:', err);
      alert('Cancel failed: ' + (err.message || 'Check wallet'));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 280, damping: 28 }}
      style={{
        position: 'absolute',
        bottom: 28,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'auto',
        zIndex: 20,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {/* Main chip */}
      <div style={{
        background: 'rgba(15,14,23,0.82)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(232,164,68,0.25)',
        borderRadius: 16,
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,164,68,0.08)',
        minWidth: 0,
      }}>
        {/* Pulsing dots */}
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -5, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.18 }}
              style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8A444' }}
            />
          ))}
        </div>

        {/* Status text */}
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 13,
          fontWeight: 600,
          color: 'rgba(255,255,254,0.55)',
          whiteSpace: 'nowrap',
        }}>
          {isCreator ? 'Waiting for opponent' : `You're P${playerNum} · Waiting…`}
        </div>

        {/* Room code (creator only) */}
        {isCreator && roomCode && (
          <>
            <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />

            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.06, filter: 'brightness(1.15)' }}
              whileTap={{ scale: 0.95 }}
              title="Click to copy room code"
              style={{
                background: 'rgba(232,164,68,0.12)',
                border: '1px solid rgba(232,164,68,0.3)',
                borderRadius: 10,
                padding: '5px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                outline: 'none',
                flexShrink: 0,
              }}
            >
              <span style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: '0.2em',
                color: '#E8A444',
                filter: 'drop-shadow(0 0 8px rgba(232,164,68,0.4))',
              }}>
                {roomCode}
              </span>

              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'copied' : 'copy'}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  style={{
                    fontSize: 11,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 600,
                    color: copied ? '#4ADE80' : 'rgba(255,255,254,0.3)',
                  }}
                >
                  {copied ? '✓' : '⎘'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </>
        )}
      </div>

      {/* On-chain commitment status */}
      {txHash && (
        <motion.a
          href={getExplorerLink(txHash)}
          target="_blank"
          rel="noopener noreferrer"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          whileHover={{ scale: 1.05, background: 'rgba(232,164,68,0.2)' }}
          style={{
            background: 'rgba(232,164,68,0.1)',
            border: '1px solid rgba(232,164,68,0.3)',
            borderRadius: 12,
            padding: '6px 14px',
            fontSize: 11,
            color: '#E8A444',
            textDecoration: 'none',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>⛓️ Commitment Confirmed</span>
          <span style={{ opacity: 0.5, fontWeight: 400 }}>{txHash.slice(0, 6)}...{txHash.slice(-4)}</span>
        </motion.a>
      )}

      {/* Small label below */}
      {isCreator && (
        <div style={{
          fontSize: 11,
          fontFamily: "'Space Grotesk', sans-serif",
          color: 'rgba(255,255,254,0.2)',
          letterSpacing: '0.04em',
        }}>
          Share this code with your opponent · tap to copy
        </div>
      )}

      {/* Leave/Cancel button */}
      <motion.button
        onClick={handleCancel}
        disabled={cancelling}
        whileHover={{ scale: 1.05, color: '#FCA5A5' }}
        whileTap={{ scale: 0.95 }}
        style={{
          marginTop: 12,
          background: 'rgba(239,68,68,0.1)',
          border: '1px solid rgba(239,68,68,0.2)',
          borderRadius: 12,
          padding: '8px 20px',
          color: 'rgba(252,165,165,0.6)',
          fontSize: 12,
          fontWeight: 700,
          fontFamily: "'Space Grotesk', sans-serif",
          cursor: 'pointer',
          outline: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {cancelling ? 'Cancelling on-chain...' : '❌ Leave & Cancel Game'}
      </motion.button>
    </motion.div>
  );
}
