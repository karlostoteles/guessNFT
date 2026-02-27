import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from './common/Button';
import { usePhase, useActivePlayer, useGameActions, useGameMode } from '../store/selectors';
import { GamePhase } from '../store/types';
import { COLORS } from '../utils/constants';

export function PhaseTransition() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const { advancePhase } = useGameActions();

  // In free mode, auto-advance through CPU transitions without requiring a tap
  const isCPUTransition = mode === 'free' && activePlayer === 'player2' && phase === GamePhase.TURN_TRANSITION;

  useEffect(() => {
    if (!isCPUTransition) return;
    const timer = setTimeout(advancePhase, 800);
    return () => clearTimeout(timer);
  }, [isCPUTransition, advancePhase]);

  let title = '';
  let subtitle = '';
  const isCPU = mode === 'free' && activePlayer === 'player2';
  const nextLabel = isCPU ? 'CPU' : activePlayer === 'player1' ? 'Player 1' : 'Player 2';

  switch (phase) {
    case GamePhase.HANDOFF_P1_TO_P2:
      title = 'Pass to Player 2';
      subtitle = 'Player 2, pick your secret character';
      break;
    case GamePhase.HANDOFF_START:
      title = 'Game Begins!';
      subtitle = 'Player 1 goes first';
      break;
    case GamePhase.HANDOFF_TO_OPPONENT: {
      const opponent = activePlayer === 'player1' ? 'Player 2' : 'Player 1';
      title = `Pass to ${opponent}`;
      subtitle = 'They need to answer your question';
      break;
    }
    case GamePhase.TURN_TRANSITION:
      title = `${nextLabel}'s Turn`;
      subtitle = isCPU ? 'CPU is thinking…' : 'Tap to continue';
      break;
    default:
      return null;
  }

  const colors = activePlayer === 'player1' ? COLORS.player1 : COLORS.player2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      onClick={isCPUTransition ? undefined : advancePhase}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: isCPUTransition ? 'default' : 'pointer',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 42,
          fontWeight: 800,
          color: colors.primary,
          marginBottom: 12,
          textShadow: `0 0 40px ${colors.primary}60`,
        }}>
          {title}
        </div>
        <div style={{
          fontSize: 16,
          color: 'rgba(255,255,254,0.5)',
          marginBottom: 40,
        }}>
          {subtitle}
        </div>

        {/* Only show button for human turns */}
        {!isCPUTransition && (
          <Button variant="primary" size="lg">
            Tap to Continue
          </Button>
        )}

        {/* Pulsing indicator for CPU */}
        {isCPUTransition && (
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
            style={{
              display: 'flex',
              gap: 6,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.15 }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: colors.primary,
                  opacity: 0.7,
                }}
              />
            ))}
          </motion.div>
        )}
      </motion.div>
    </motion.div>
  );
}
