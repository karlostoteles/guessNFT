import { motion, AnimatePresence } from 'framer-motion';
import { usePhase, useGameActions } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';
import { sfx } from '@/shared/audio/sfx';

const VISIBLE_PHASES = new Set([
  GamePhase.QUESTION_SELECT,
  GamePhase.ANSWER_REVEALED,
  GamePhase.AUTO_ELIMINATING,
  GamePhase.ELIMINATION,
]);

export function RiskItButton() {
  const phase = usePhase();
  const { startGuess } = useGameActions();
  const visible = VISIBLE_PHASES.has(phase);

  const handleClick = () => {
    sfx.riskIt();
    startGuess();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          key="risk-it"
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          onClick={handleClick}
          style={{
            position: 'fixed',
            top: 16,
            right: 16,
            zIndex: 10,
            padding: '10px 20px',
            border: '2px solid rgba(224, 85, 85, 0.6)',
            borderRadius: 12,
            background: 'linear-gradient(135deg, rgba(224, 85, 85, 0.25), rgba(180, 50, 50, 0.35))',
            backdropFilter: 'blur(12px)',
            color: '#FF6B6B',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 15,
            cursor: 'pointer',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            pointerEvents: 'auto',
            boxShadow: '0 0 20px rgba(224, 85, 85, 0.15), inset 0 0 20px rgba(224, 85, 85, 0.05)',
          }}
          whileHover={{
            scale: 1.05,
            boxShadow: '0 0 30px rgba(224, 85, 85, 0.3), inset 0 0 20px rgba(224, 85, 85, 0.1)',
            borderColor: 'rgba(224, 85, 85, 0.9)',
          }}
          whileTap={{ scale: 0.95 }}
        >
          <motion.span
            animate={{ rotate: [0, -10, 10, -5, 0] }}
            transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
            style={{ fontSize: 18 }}
          >
            🎯
          </motion.span>
          RISK IT!
        </motion.button>
      )}
    </AnimatePresence>
  );
}
