import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useActivePlayer, useTurnNumber } from '../store/selectors';
import { GamePhase } from '../store/types';
import { COLORS } from '../utils/constants';

const PHASE_LABELS: Partial<Record<GamePhase, string>> = {
  [GamePhase.QUESTION_SELECT]: 'Ask a Question',
  [GamePhase.HANDOFF_TO_OPPONENT]: 'Pass the Device',
  [GamePhase.ANSWER_PENDING]: 'Answer the Question',
  [GamePhase.ANSWER_REVEALED]: 'Answer Revealed',
  [GamePhase.ELIMINATION]: 'Eliminate Characters',
  [GamePhase.TURN_TRANSITION]: 'Switching Turns',
  [GamePhase.GUESS_SELECT]: 'Make Your Guess',
};

export function TurnIndicator() {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const turnNumber = useTurnNumber();
  const label = PHASE_LABELS[phase];

  if (!label) return null;

  const colors = activePlayer === 'player1' ? COLORS.player1 : COLORS.player2;
  const playerLabel = activePlayer === 'player1' ? 'Player 1' : 'Player 2';

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={`${phase}-${activePlayer}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        style={{
          position: 'fixed',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
          zIndex: 10,
        }}
      >
        <div style={{
          background: colors.bg,
          backdropFilter: 'blur(12px)',
          border: `1px solid ${colors.primary}40`,
          borderRadius: 12,
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: colors.primary,
            boxShadow: `0 0 8px ${colors.primary}`,
          }} />
          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            color: colors.primary,
          }}>
            {playerLabel}
          </span>
          <span style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.5)',
          }}>
            Turn {Math.ceil(turnNumber / 2)}
          </span>
        </div>
        <span style={{
          fontSize: 13,
          color: 'rgba(255,255,254,0.6)',
          fontWeight: 500,
        }}>
          {label}
        </span>
      </motion.div>
    </AnimatePresence>
  );
}
