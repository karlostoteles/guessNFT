/**
 * OnlineWaitingScreen
 *
 * Shown in ONLINE_WAITING phase — local player has committed their character,
 * waiting for the opponent to do the same.
 * For P1 (creator): prominently shows the room code to share with opponent.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useOnlinePlayerNum,
  usePlayerState,
  usePhase,
  useStarknetGameId,
} from '../store/selectors';
import { GamePhase } from '../store/types';

export function OnlineWaitingScreen() {
  const starknetGameId = useStarknetGameId();
  const playerNum   = useOnlinePlayerNum();
  const phase       = usePhase();
  const [copied, setCopied] = useState(false);
  const myPlayerKey = playerNum === 1 ? 'player1' : 'player2';
  const myState = usePlayerState(myPlayerKey as 'player1' | 'player2');
  const hasSelectedCharacter = !!myState.secretCharacterId;

  const isRevealWaiting = phase === GamePhase.REVEAL_WAITING;
  const displayCode = starknetGameId;

  const handleCopy = () => {
    if (!displayCode) return;
    navigator.clipboard.writeText(displayCode).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isCreator = playerNum === 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
        gap: 28,
        padding: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{ textAlign: 'center', width: '100%', maxWidth: 380 }}
      >
        {/* Status header */}
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 28,
          fontWeight: 800,
          color: '#E8A444',
          marginBottom: 8,
          textShadow: '0 0 40px rgba(232,164,68,0.4)',
        }}>
          {isRevealWaiting
            ? 'Revealing Characters…'
            : hasSelectedCharacter
              ? 'Character Locked In ✓'
              : 'Game Created'}
        </div>

        <div style={{
          fontSize: 14,
          color: 'rgba(255,255,254,0.45)',
          marginBottom: 28,
        }}>
          {isRevealWaiting
            ? 'Verifying commitments on-chain. The winner will be announced shortly.'
            : hasSelectedCharacter
              ? `You're Player ${playerNum} · Waiting for opponent to choose their SCHIZODIO…`
              : `You're Player ${playerNum} · Share the Game ID below and wait for your opponent to join`}
        </div>

        {/* Room code — prominent for creator, subtle for joiner, hidden during reveal */}
        {displayCode && !isRevealWaiting && (
          <div style={{
            background: isCreator
              ? 'rgba(232,164,68,0.08)'
              : 'rgba(255,255,255,0.04)',
            border: isCreator
              ? '2px solid rgba(232,164,68,0.3)'
              : '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: isCreator ? '20px 24px' : '12px 20px',
            marginBottom: 16,
          }}>
            {isCreator && (
              <div style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                color: 'rgba(232,164,68,0.6)',
                marginBottom: 8,
              }}>
                Share this Game ID with your opponent
              </div>
            )}

            {/* Clickable room code */}
            <motion.button
              onClick={handleCopy}
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.97 }}
              title="Click to copy"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
                width: '100%',
              }}
            >
              <span style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: isCreator ? 52 : 32,
                fontWeight: 900,
                letterSpacing: '0.25em',
                color: '#E8A444',
                filter: 'drop-shadow(0 0 16px rgba(232,164,68,0.35))',
                display: 'block',
              }}>
                {displayCode}
              </span>

              {/* Copy feedback */}
              <AnimatePresence mode="wait">
                <motion.span
                  key={copied ? 'copied' : 'hint'}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  style={{
                    fontSize: 12,
                    fontFamily: "'Space Grotesk', sans-serif",
                    color: copied ? '#4ADE80' : 'rgba(255,255,254,0.3)',
                    fontWeight: copied ? 600 : 400,
                  }}
                >
                  {copied ? '✓ Copied to clipboard!' : 'Tap to copy'}
                </motion.span>
              </AnimatePresence>
            </motion.button>
          </div>
        )}

        {/* Pulsing dots */}
        <motion.div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#E8A444',
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
