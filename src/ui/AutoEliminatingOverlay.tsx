import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { useCurrentQuestion, useActivePlayer, useEliminatedIds, useGameActions } from '../store/selectors';
import { sfx } from '../audio/sfx';

const AUTO_ADVANCE_MS = 2500; // Time to watch tiles flip

export function AutoEliminatingOverlay() {
  const question = useCurrentQuestion();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const { advancePhase } = useGameActions();
  const [progress, setProgress] = useState(0);

  // Play tile-flip sound on mount
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

  return (
    <Card style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(460px, calc(100vw - 32px))',
      pointerEvents: 'auto',
      overflow: 'hidden',
    }}>
      {/* Q&A result */}
      {question && (
        <div style={{
          marginBottom: 16,
          padding: '12px 16px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{ flex: 1, fontSize: 14, color: 'rgba(255,255,254,0.7)' }}>
            {question.questionText}
          </div>
          <div style={{
            padding: '4px 12px',
            borderRadius: 6,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: "'Space Grotesk', sans-serif",
            background: question.answer ? 'rgba(76,175,80,0.2)' : 'rgba(224,85,85,0.2)',
            color: question.answer ? '#4CAF50' : '#E05555',
          }}>
            {question.answer ? 'YES' : 'NO'}
          </div>
        </div>
      )}

      {/* Status */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
          style={{
            width: 20,
            height: 20,
            border: '2px solid rgba(232, 164, 68, 0.3)',
            borderTopColor: '#E8A444',
            borderRadius: '50%',
          }}
        />
        <div>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            fontSize: 15,
            color: '#FFFFFE',
          }}>
            Eliminating characters...
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.4)',
            marginTop: 2,
          }}>
            {eliminatedIds.length} eliminated total
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        background: 'rgba(255,255,255,0.08)',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <motion.div
          style={{
            height: '100%',
            background: 'linear-gradient(90deg, #E8A444, #F0C674)',
            borderRadius: 2,
            width: `${progress * 100}%`,
          }}
        />
      </div>
    </Card>
  );
}
