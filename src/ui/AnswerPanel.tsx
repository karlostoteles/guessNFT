import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { useCurrentQuestion, useGameActions } from '../store/selectors';

export function AnswerPanel() {
  const question = useCurrentQuestion();
  const { answerQuestion } = useGameActions();

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
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,254,0.4)',
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        marginBottom: 16,
      }}>
        Opponent asks:
      </div>

      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 22,
          fontWeight: 700,
          lineHeight: 1.4,
          marginBottom: 32,
          color: '#FFFFFE',
        }}
      >
        {question.questionText}
      </motion.div>

      <div style={{
        display: 'flex',
        gap: 16,
        justifyContent: 'center',
      }}>
        <Button
          variant="yes"
          size="lg"
          onClick={() => answerQuestion(true)}
          style={{ minWidth: 120 }}
        >
          YES
        </Button>
        <Button
          variant="no"
          size="lg"
          onClick={() => answerQuestion(false)}
          style={{ minWidth: 120 }}
        >
          NO
        </Button>
      </div>

      {/* Auto-answer hint (for local play, shows the correct answer) */}
      {question.answer !== null && (
        <div style={{
          marginTop: 16,
          fontSize: 11,
          color: 'rgba(255,255,254,0.25)',
        }}>
          Correct answer: {question.answer ? 'Yes' : 'No'}
        </div>
      )}
    </Card>
  );
}
