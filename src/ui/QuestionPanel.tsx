import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './common/Card';
import { QUESTIONS, Question } from '../data/questions';
import { useGameActions, useQuestionHistory, useActivePlayer, useGameMode, useOnlinePlayerNum } from '../store/selectors';
import { sfx } from '../audio/sfx';

const CATEGORIES = [
  { key: 'hair',        label: 'Hair',        icon: '💇' },
  { key: 'face',        label: 'Face',        icon: '👁️'  },
  { key: 'accessories', label: 'Accessories', icon: '🎩' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

export function QuestionPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>('hair');
  const { askQuestion } = useGameActions();
  const history = useQuestionHistory();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();

  // In online mode, check if it's actually my turn
  const isMyTurn = mode !== 'online' || (
    (activePlayer === 'player1' && onlinePlayerNum === 1) ||
    (activePlayer === 'player2' && onlinePlayerNum === 2)
  );

  // Questions already asked by the current player this game
  const askedIds = new Set(
    history.filter((q) => q.askedBy === activePlayer).map((q) => q.questionId)
  );

  const filteredQuestions = QUESTIONS.filter((q) => q.category === activeCategory);
  const askedInCategory = filteredQuestions.filter((q) => askedIds.has(q.id)).length;
  const totalInCategory = filteredQuestions.length;

  // Online mode: show "waiting for opponent" panel when it's not my turn
  if (!isMyTurn) {
    return (
      <Card style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(600px, calc(100vw - 32px))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: '20px 24px',
        pointerEvents: 'auto',
      }}>
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          style={{ fontSize: 14, color: 'rgba(255,255,254,0.5)' }}
        >
          ⏳ Waiting for opponent's question…
        </motion.div>
      </Card>
    );
  }

  return (
    <Card style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 'min(600px, calc(100vw - 32px))',
      maxHeight: 'min(420px, 52vh)',
      display: 'flex',
      flexDirection: 'column',
      pointerEvents: 'auto',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontWeight: 700,
          fontSize: 18,
          margin: 0,
        }}>
          Ask a Question
        </h3>
        {askedIds.size > 0 && (
          <span style={{
            fontSize: 11,
            fontWeight: 600,
            color: 'rgba(255,255,254,0.3)',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20,
            padding: '2px 10px',
          }}>
            {askedIds.size} asked
          </span>
        )}
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 14,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        padding: 3,
      }}>
        {CATEGORIES.map((cat) => {
          const catAsked = QUESTIONS.filter(
            (q) => q.category === cat.key && askedIds.has(q.id)
          ).length;
          const catTotal = QUESTIONS.filter((q) => q.category === cat.key).length;
          const allAsked = catAsked === catTotal;

          return (
            <motion.button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              style={{
                flex: 1,
                padding: '8px 10px',
                border: 'none',
                borderRadius: 6,
                background: activeCategory === cat.key
                  ? 'rgba(232, 164, 68, 0.2)'
                  : 'transparent',
                color: activeCategory === cat.key
                  ? '#E8A444'
                  : allAsked
                    ? 'rgba(255,255,254,0.25)'
                    : 'rgba(255,255,254,0.5)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 13,
                cursor: 'pointer',
                outline: 'none',
                transition: 'background 0.2s, color 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
              }}
            >
              <span style={{ fontSize: 14 }}>{cat.icon}</span>
              {cat.label}
              {catAsked > 0 && (
                <span style={{
                  fontSize: 10,
                  background: 'rgba(255,255,255,0.1)',
                  borderRadius: 8,
                  padding: '1px 5px',
                  color: 'rgba(255,255,254,0.35)',
                }}>
                  {catAsked}/{catTotal}
                </span>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Questions grid */}
      <div style={{ overflowY: 'auto', flex: 1, paddingRight: 4 }}>
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
              <QuestionButton
                key={q.id}
                question={q}
                asked={askedIds.has(q.id)}
                onClick={() => {
                  if (askedIds.has(q.id)) return; // prevent re-ask
                  sfx.question();
                  askQuestion(q.id);
                }}
              />
            ))}
          </motion.div>
        </AnimatePresence>

        {/* All asked in this category */}
        {askedInCategory === totalInCategory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,254,0.25)',
              marginTop: 12,
              fontStyle: 'italic',
            }}
          >
            All {cat(activeCategory)} questions asked — try another category
          </motion.div>
        )}
      </div>
    </Card>
  );
}

function cat(key: Category): string {
  return { hair: 'hair', face: 'face', accessories: 'accessories' }[key];
}

function QuestionButton({
  question,
  asked,
  onClick,
}: {
  question: Question;
  asked: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.02, background: 'rgba(255,255,255,0.12)' }}
      whileTap={asked ? {} : { scale: 0.98 }}
      style={{
        padding: '10px 14px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        background: asked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.25)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left',
        outline: 'none',
        lineHeight: 1.4,
        transition: 'all 0.2s',
        position: 'relative',
      }}
    >
      {question.text}
      {asked && (
        <span style={{
          position: 'absolute',
          top: 6,
          right: 8,
          fontSize: 10,
          fontWeight: 700,
          color: 'rgba(232,164,68,0.5)',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          ✓
        </span>
      )}
    </motion.button>
  );
}
