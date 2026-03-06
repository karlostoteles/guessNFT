import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useCurrentQuestion, useActivePlayer, useEliminatedIds, useGameActions, useGameCharacters } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

const AUTO_ADVANCE_MS = 2000; // Fast → tiles fly + auto-advance

export function AutoEliminatingOverlay() {
  const question = useCurrentQuestion();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const characters = useGameCharacters();
  const { advancePhase } = useGameActions();
  const [progress, setProgress] = useState(0);

  const remaining = characters.length - eliminatedIds.length;

  // Play cascade sound on mount
  useEffect(() => { sfx.tileFlip(); }, []);

  // Auto-advance after delay
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.min(elapsed / AUTO_ADVANCE_MS, 1));
    }, 30);

    const timer = setTimeout(() => {
      advancePhase();
    }, AUTO_ADVANCE_MS);

    return () => {
      clearInterval(interval);
      clearTimeout(timer);
    };
  }, [advancePhase]);

  // Color for remaining tiles (green→red as they decrease)
  const ratio = characters.length > 0 ? remaining / characters.length : 1;
  const hue = Math.round(120 + ratio * 100);
  const tileColor = `hsl(${hue}, 70%, 55%)`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.2 }}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        pointerEvents: 'none',
        zIndex: 30,
      }}
    >
      <div style={{
        background: 'rgba(12, 11, 20, 0.9)',
        backdropFilter: 'blur(16px)',
        border: '1px solid rgba(232,164,68,0.2)',
        borderRadius: 14,
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        minWidth: 200,
      }}>
        {/* Q&A result mini */}
        {question && (
          <>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,254,0.5)',
              maxWidth: 180,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {question.questionText}
            </div>
            <div style={{
              padding: '2px 8px',
              borderRadius: 4,
              fontWeight: 700,
              fontSize: 11,
              fontFamily: "'Space Grotesk', sans-serif",
              background: question.answer ? 'rgba(76,175,80,0.2)' : 'rgba(224,85,85,0.2)',
              color: question.answer ? '#4CAF50' : '#E05555',
            }}>
              {question.answer ? 'YES' : 'NO'}
            </div>
            <div style={{
              width: 1,
              height: 20,
              background: 'rgba(255,255,255,0.1)',
            }} />
          </>
        )}

        {/* Tiles remaining counter */}
        <motion.span
          key={remaining}
          initial={{ scale: 1.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: 18,
            color: tileColor,
          }}
        >
          {remaining}
        </motion.span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          color: 'rgba(255,255,254,0.35)',
          letterSpacing: '0.08em',
        }}>
          left
        </span>

        {/* inline progress */}
        <div style={{
          width: 40,
          height: 3,
          background: 'rgba(255,255,255,0.08)',
          borderRadius: 2,
          overflow: 'hidden',
        }}>
          <motion.div
            style={{
              height: '100%',
              background: '#E8A444',
              borderRadius: 2,
              width: `${progress * 100}%`,
            }}
          />
        </div>
      </div>
    </motion.div>
  );
}
