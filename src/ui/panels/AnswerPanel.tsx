import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCurrentQuestion, useGameActions, useGameMode } from '@/core/store/selectors';

export function AnswerPanel() {
  const question = useCurrentQuestion();
  const mode = useGameMode();
  const { answerQuestion } = useGameActions();

  if (!question) return null;

  // Online mode: show "waiting for opponent's answer" indicator
  if (mode === 'online') {
    const content = (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        style={{
          position: 'fixed',
          bottom: 28,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 30,
          pointerEvents: 'none',
          width: 'min(420px, calc(100vw - 32px))',
        }}
      >
        <div style={{
          background: 'rgba(12, 11, 20, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(232,164,68,0.25)',
          borderRadius: 16,
          padding: '14px 24px',
          textAlign: 'center',
        }}>
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,254,0.5)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 600,
            marginBottom: 6,
          }}>
            {question.questionText}
          </div>
          <div style={{
            fontSize: 12,
            color: 'rgba(255,255,254,0.3)',
            fontWeight: 600,
          }}>
            Waiting for opponent{'\u2019'}s answer...
          </div>
        </div>
      </motion.div>
    );

    return createPortal(content, document.body);
  }

  // Local/free mode: show answer buttons
  const content = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9990,
        pointerEvents: 'auto',
        padding: 16,
      }}
    >
      <Card style={{
        width: 'min(400px, 100%)',
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
            fontSize: 'clamp(18px, 5vw, 22px)',
            fontWeight: 700,
            lineHeight: 1.4,
            marginBottom: 24,
            color: '#FFFFFE',
          }}
        >
          {question.questionText}
        </motion.div>

        <div style={{
          display: 'flex',
          gap: 12,
          justifyContent: 'center',
        }}>
          <Button
            variant="yes"
            size="lg"
            onClick={() => answerQuestion(true)}
            style={{ minWidth: 100, flex: 1, maxWidth: 150 }}
          >
            YES
          </Button>
          <Button
            variant="no"
            size="lg"
            onClick={() => answerQuestion(false)}
            style={{ minWidth: 100, flex: 1, maxWidth: 150 }}
          >
            NO
          </Button>
        </div>

        {question.answer !== null && (
          <div style={{
            marginTop: 14,
            fontSize: 11,
            color: 'rgba(255,255,254,0.25)',
          }}>
            Correct answer: {question.answer ? 'Yes' : 'No'}
          </div>
        )}
      </Card>
    </motion.div>
  );

  return createPortal(content, document.body);
}
