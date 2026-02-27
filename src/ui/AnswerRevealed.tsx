import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { useCurrentQuestion, useGameActions } from '../store/selectors';
import { sfx } from '../audio/sfx';

export function AnswerRevealed() {
  const question = useCurrentQuestion();
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
      width: 'min(440px, calc(100vw - 32px))',
      textAlign: 'center',
      pointerEvents: 'auto',
    }}>
      <div style={{
        fontSize: 14,
        color: 'rgba(255,255,254,0.5)',
        marginBottom: 12,
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
          marginBottom: 24,
        }}
      >
        {question.answer ? 'YES' : 'NO'}
      </motion.div>

      <Button variant="accent" size="md" onClick={advancePhase}>
        Continue
      </Button>
    </Card>
  );
}
