import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { QUESTIONS, Question } from '../data/questions';
import { useGameActions } from '../store/selectors';

const CATEGORIES = [
  { key: 'hair', label: 'Hair', icon: '/' },
  { key: 'face', label: 'Face', icon: '/' },
  { key: 'accessories', label: 'Accessories', icon: '/' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

export function QuestionPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>('hair');
  const { askQuestion, startGuess } = useGameActions();

  const filteredQuestions = QUESTIONS.filter((q) => q.category === activeCategory);

  return (
    <Card style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(600px, calc(100vw - 32px))',
      maxHeight: 'min(400px, 50vh)',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      }}>
        <h3 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 18,
          margin: 0,
        }}>
          Ask a Question
        </h3>
        <Button variant="accent" size="sm" onClick={startGuess}>
          Make a Guess
        </Button>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 16,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 3,
      }}>
        {CATEGORIES.map((cat) => (
          <motion.button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: 'none',
              borderRadius: 6,
              background: activeCategory === cat.key
                ? 'rgba(232, 164, 68, 0.2)'
                : 'transparent',
              color: activeCategory === cat.key
                ? '#E8A444'
                : 'rgba(255,255,254,0.5)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer',
              outline: 'none',
              transition: 'background 0.2s, color 0.2s',
            }}
            whileHover={{ background: 'rgba(255,255,255,0.08)' }}
          >
            {cat.label}
          </motion.button>
        ))}
      </div>

      {/* Questions grid */}
      <div style={{
        overflowY: 'auto',
        flex: 1,
        paddingRight: 4,
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 8,
            }}
          >
            {filteredQuestions.map((q) => (
              <QuestionButton key={q.id} question={q} onClick={() => askQuestion(q.id)} />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </Card>
  );
}

function QuestionButton({ question, onClick }: { question: Question; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.12)' }}
      whileTap={{ scale: 0.98 }}
      style={{
        padding: '10px 14px',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.05)',
        color: '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: 'pointer',
        textAlign: 'left',
        outline: 'none',
        lineHeight: 1.4,
        transition: 'border-color 0.2s',
      }}
    >
      {question.text}
    </motion.button>
  );
}
