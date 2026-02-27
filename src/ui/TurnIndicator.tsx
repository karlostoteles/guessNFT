import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useActivePlayer, useTurnNumber, useGameMode, useEliminatedIds, useGameCharacters } from '../store/selectors';
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
  const mode = useGameMode();
  const characters = useGameCharacters();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const label = PHASE_LABELS[phase];

  if (!label) return null;

  const isCPU = mode === 'free' && activePlayer === 'player2';
  const colors = activePlayer === 'player1' ? COLORS.player1 : COLORS.player2;
  const playerLabel = isCPU ? 'CPU' : activePlayer === 'player1' ? 'Player 1' : 'Player 2';

  const remaining = characters.length - eliminatedIds.length;
  const showRemaining = phase === GamePhase.QUESTION_SELECT && remaining < characters.length;

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
          pointerEvents: 'none',
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
          {/* Player dot */}
          <motion.div
            animate={isCPU ? { scale: [1, 1.2, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.5 }}
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: colors.primary,
              boxShadow: `0 0 8px ${colors.primary}`,
              flexShrink: 0,
            }}
          />

          <span style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            color: colors.primary,
          }}>
            {playerLabel}
          </span>

          <span style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.4)',
          }}>
            Turn {Math.ceil(turnNumber / 2)}
          </span>

          {/* Remaining counter */}
          {showRemaining && (
            <>
              <div style={{
                width: 1,
                height: 14,
                background: 'rgba(255,255,255,0.12)',
              }} />
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: remaining <= 4
                  ? '#E05555'
                  : remaining <= 8
                    ? '#E8A444'
                    : 'rgba(255,255,254,0.4)',
              }}>
                {remaining} left
              </span>
            </>
          )}
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
