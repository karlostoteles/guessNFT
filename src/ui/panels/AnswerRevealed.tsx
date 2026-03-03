import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCurrentQuestion, useCpuQuestion, useGameMode, useGameActions } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

export function AnswerRevealed() {
  const question = useCurrentQuestion();
  const cpuQuestion = useCpuQuestion();
  const mode = useGameMode();
  const { advancePhase } = useGameActions();

  // Play yes/no SFX once when the answer is revealed
  useEffect(() => {
    if (!question) return;
    if (question.answer) sfx.answerYes();
    else sfx.answerNo();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!question) return null;

  return (
    <Card style={{
      position: 'fixed',
      bottom: '50%',
      left: '50%',
      transform: 'translate(-50%, 50%)',
      width: 'min(480px, calc(100vw - 32px))',
      textAlign: 'center',
      pointerEvents: 'auto',
    }}>
      {/* Player's question + answer */}
      <div style={{
        fontSize: 13,
        color: 'rgba(255,255,254,0.4)',
        marginBottom: 8,
      }}>
        {question.questionText}
      </div>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        style={{
          fontSize: 56,
          fontWeight: 800,
          fontFamily: "'Space Grotesk', sans-serif",
          color: question.answer ? '#4CAF50' : '#E05555',
          textShadow: question.answer
            ? '0 0 40px rgba(76,175,80,0.4)'
            : '0 0 40px rgba(224,85,85,0.4)',
          marginBottom: cpuQuestion && mode === 'free' ? 20 : 24,
        }}
      >
        {question.answer ? 'YES' : 'NO'}
      </motion.div>

      {/* CPU's simultaneous question (free mode only) */}
      {mode === 'free' && cpuQuestion && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.3 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 20,
            padding: '10px 14px',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10,
            textAlign: 'left',
          }}
        >
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: 'rgba(167,139,250,0.7)',
            whiteSpace: 'nowrap',
          }}>
            CPU
          </div>
          <div style={{
            flex: 1,
            fontSize: 13,
            color: 'rgba(255,255,254,0.55)',
          }}>
            {cpuQuestion.questionText}
          </div>
          <div style={{
            fontSize: 13,
            fontWeight: 700,
            fontFamily: "'Space Grotesk', sans-serif",
            padding: '3px 10px',
            borderRadius: 6,
            background: cpuQuestion.answer
              ? 'rgba(76,175,80,0.18)'
              : 'rgba(224,85,85,0.18)',
            color: cpuQuestion.answer ? '#4CAF50' : '#E05555',
            whiteSpace: 'nowrap',
          }}>
            {cpuQuestion.answer ? 'YES' : 'NO'}
          </div>
        </motion.div>
      )}

      <Button variant="accent" size="md" onClick={advancePhase}>
        Continue
      </Button>
    </Card>
  );
}
