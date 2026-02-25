import { motion } from 'framer-motion';
import { Button } from './common/Button';
import { usePhase, useActivePlayer, useGameActions } from '../store/selectors';
import { GamePhase } from '../store/types';
import { COLORS } from '../utils/constants';

export function PhaseTransition() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const { advancePhase } = useGameActions();

  let title = '';
  let subtitle = '';

  switch (phase) {
    case GamePhase.HANDOFF_P1_TO_P2:
      title = 'Pass to Player 2';
      subtitle = "Player 2, pick your secret character";
      break;
    case GamePhase.HANDOFF_START:
      title = 'Game Begins!';
      subtitle = 'Player 1 goes first';
      break;
    case GamePhase.HANDOFF_TO_OPPONENT:
      const opponent = activePlayer === 'player1' ? 'Player 2' : 'Player 1';
      title = `Pass to ${opponent}`;
      subtitle = 'They need to answer your question';
      break;
    case GamePhase.TURN_TRANSITION:
      const next = activePlayer === 'player1' ? 'Player 1' : 'Player 2';
      title = `${next}'s Turn`;
      subtitle = 'Tap to continue';
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
      transition={{ duration: 0.4 }}
      onClick={advancePhase}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{
          textAlign: 'center',
        }}
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
        <Button variant="primary" size="lg">
          Tap to Continue
        </Button>
      </motion.div>
    </motion.div>
  );
}
