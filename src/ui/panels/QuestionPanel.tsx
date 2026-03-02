import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { QUESTIONS, Question } from '@/core/data/questions';
import { useGameActions, useQuestionHistory, useActivePlayer, useGameMode, useOnlinePlayerNum } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

const CATEGORIES = [
  { key: 'hair',        label: 'Hair',        icon: '💇' },
  { key: 'face',        label: 'Face',        icon: '👁️'  },
  { key: 'accessories', label: 'Accessories', icon: '🎩' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

// ─── Minimised floating tab ───────────────────────────────────────────────────

function MinimisedTab({
  askedCount,
  onClick,
}: { askedCount: number; onClick: () => void }) {
  return (
    <motion.button
      key="minimised-tab"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      onClick={onClick}
      whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        pointerEvents: 'auto',
        background: 'linear-gradient(135deg, rgba(232,164,68,0.18), rgba(124,58,237,0.18))',
        border: '1px solid rgba(232,164,68,0.35)',
        borderRadius: 40,
        padding: '10px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        cursor: 'pointer',
        backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)',
        outline: 'none',
        color: '#E8A444',
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700,
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 16 }}>❓</span>
      Ask a Question
      {askedCount > 0 && (
        <span style={{
          background: 'rgba(232,164,68,0.2)',
          border: '1px solid rgba(232,164,68,0.25)',
          borderRadius: 12,
          padding: '1px 8px',
          fontSize: 11,
          color: 'rgba(232,164,68,0.7)',
        }}>
          {askedCount} asked
        </span>
      )}
      <span style={{ fontSize: 12, opacity: 0.5 }}>▲</span>
    </motion.button>
  );
}

// ─── Waiting panel (opponent's turn) ─────────────────────────────────────────

function WaitingTab() {
  return (
    <motion.div
      key="waiting-tab"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      style={{
        position: 'fixed',
        bottom: 20,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 30,
        pointerEvents: 'none',
        background: 'rgba(15,14,23,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 40,
        padding: '10px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        color: 'rgba(255,255,254,0.45)',
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}
    >
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
      >
        ⏳
      </motion.span>
      Waiting for opponent's question…
    </motion.div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function QuestionPanel() {
  const [activeCategory, setActiveCategory] = useState<Category>('hair');
  const [minimised, setMinimised] = useState(false);

  const { askQuestion } = useGameActions();
  const history         = useQuestionHistory();
  const activePlayer    = useActivePlayer();
  const mode            = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();

  // In online mode check if it's actually my turn
  const isMyTurn = mode !== 'online' || (
    (activePlayer === 'player1' && onlinePlayerNum === 1) ||
    (activePlayer === 'player2' && onlinePlayerNum === 2)
  );

  // Questions already asked by the current player this game
  const askedIds = new Set(
    history.filter((q) => q.askedBy === activePlayer).map((q) => q.questionId)
  );

  const filteredQuestions = QUESTIONS.filter((q) => q.category === activeCategory);
  const askedInCategory   = filteredQuestions.filter((q) => askedIds.has(q.id)).length;
  const totalInCategory   = filteredQuestions.length;

  // ── Not my turn: compact pill ─────────────────────────────────────────────
  if (!isMyTurn) {
    return (
      <AnimatePresence>
        <WaitingTab key="waiting" />
      </AnimatePresence>
    );
  }

  // ── Minimised: floating tab ───────────────────────────────────────────────
  if (minimised) {
    return (
      <AnimatePresence>
        <MinimisedTab
          key="minimised"
          askedCount={askedIds.size}
          onClick={() => setMinimised(false)}
        />
      </AnimatePresence>
    );
  }

  // ── Expanded panel ────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="expanded-panel"
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{
          position: 'fixed',
          // On mobile: anchor bottom, full-width; on desktop: centred, capped width
          bottom: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'min(760px, 100vw)',
          maxHeight: 'min(640px, 85vh)',
          zIndex: 30,
          pointerEvents: 'auto',
          display: 'flex',
          flexDirection: 'column',
          // Mobile: no rounded bottom corners; desktop: rounded all round
          borderRadius: 'clamp(0px, calc((100vw - 760px) * 999), 20px) clamp(0px, calc((100vw - 760px) * 999), 20px) 0 0',
          background: 'rgba(15,14,23,0.96)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.6)',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ── */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 18px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 18 }}>❓</span>
            <h3 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 17,
              margin: 0,
              color: '#FFFFFE',
            }}>
              Ask a Question
            </h3>
            {askedIds.size > 0 && (
              <span style={{
                fontSize: 11,
                fontWeight: 600,
                color: 'rgba(255,255,254,0.3)',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 20,
                padding: '2px 10px',
              }}>
                {askedIds.size} asked
              </span>
            )}
          </div>

          {/* Minimise button */}
          <motion.button
            onClick={() => setMinimised(true)}
            whileHover={{ scale: 1.08, background: 'rgba(255,255,255,0.12)' }}
            whileTap={{ scale: 0.94 }}
            title="Minimise"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '5px 12px',
              cursor: 'pointer',
              outline: 'none',
              color: 'rgba(255,255,254,0.45)',
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            <span style={{ fontSize: 11 }}>▼</span> Hide
          </motion.button>
        </div>

        {/* ── Category tabs ── */}
        <div style={{
          display: 'flex',
          gap: 4,
          padding: '10px 12px 0',
          background: 'rgba(255,255,255,0.03)',
          flexShrink: 0,
        }}>
          {CATEGORIES.map((cat) => {
            const catAsked = QUESTIONS.filter((q) => q.category === cat.key && askedIds.has(q.id)).length;
            const catTotal = QUESTIONS.filter((q) => q.category === cat.key).length;
            const allAsked = catAsked === catTotal;
            const isActive = activeCategory === cat.key;

            return (
              <motion.button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                whileHover={{ background: isActive ? undefined : 'rgba(255,255,255,0.08)' }}
                style={{
                  flex: 1,
                  padding: '9px 10px 12px',
                  border: 'none',
                  borderRadius: '8px 8px 0 0',
                  background: isActive
                    ? 'rgba(232,164,68,0.15)'
                    : 'transparent',
                  borderBottom: isActive ? '2px solid #E8A444' : '2px solid transparent',
                  color: isActive
                    ? '#E8A444'
                    : allAsked
                      ? 'rgba(255,255,254,0.2)'
                      : 'rgba(255,255,254,0.5)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  outline: 'none',
                  transition: 'all 0.18s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 15 }}>{cat.icon}</span>
                <span>{cat.label}</span>
                <span style={{
                  fontSize: 10,
                  background: catAsked > 0 ? 'rgba(232,164,68,0.15)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '1px 6px',
                  color: catAsked > 0 ? 'rgba(232,164,68,0.6)' : 'rgba(255,255,254,0.25)',
                }}>
                  {catAsked}/{catTotal}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* ── Questions grid ── */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          padding: '12px 12px 16px',
          // iOS momentum scroll
          WebkitOverflowScrolling: 'touch' as any,
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.14 }}
              style={{
                display: 'grid',
                // Two columns on desktop, one column on very narrow screens
                gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
                gap: 8,
              }}
            >
              {filteredQuestions.map((q, idx) => (
                <QuestionButton
                  key={q.id}
                  question={q}
                  asked={askedIds.has(q.id)}
                  index={idx}
                  totalAsked={askedIds.size}
                  totalOnBoard={24} // TODO: wire real remaining-tile count for probability
                  onClick={() => {
                    if (askedIds.has(q.id)) return;
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
                marginTop: 14,
                fontStyle: 'italic',
              }}
            >
              All {activeCategory} questions asked — try another category
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Individual question button ───────────────────────────────────────────────

/**
 * A question button with a stat indicator on the right.
 * `riskLevel` is a placeholder (0–2) that will later be driven by
 * real board-analysis data (how many tiles would be eliminated, expected value, etc.)
 */
function getRiskLevel(idx: number, totalAsked: number): 0 | 1 | 2 {
  // Placeholder heuristic until real board analysis is wired:
  // cycle through low / medium / high based on question order
  return (idx % 3) as 0 | 1 | 2;
}

const RISK_COLORS: Record<0 | 1 | 2, { dot: string; label: string }> = {
  0: { dot: '#4ADE80', label: 'Safe'   }, // green
  1: { dot: '#FACC15', label: 'Medium' }, // yellow
  2: { dot: '#F87171', label: 'Risk'   }, // red
};

function QuestionButton({
  question,
  asked,
  index,
  totalAsked,
  totalOnBoard,
  onClick,
}: {
  question:     Question;
  asked:        boolean;
  index:        number;
  totalAsked:   number;
  totalOnBoard: number;
  onClick:      () => void;
}) {
  const riskLevel = getRiskLevel(index, totalAsked);
  const risk      = RISK_COLORS[riskLevel];

  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked ? {} : { scale: 0.98 }}
      style={{
        padding: '11px 14px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        background: asked
          ? 'rgba(255,255,255,0.02)'
          : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13,
        fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left',
        outline: 'none',
        lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
      }}
    >
      {/* Question text */}
      <span style={{ flex: 1 }}>{question.text}</span>

      {/* Stat indicator — right side */}
      {asked ? (
        /* Asked: golden check */
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: 'rgba(232,164,68,0.6)',
          flexShrink: 0,
        }}>
          ✓
        </span>
      ) : (
        /* Not asked: risk/probability dot (placeholder for future stats) */
        <span
          title={risk.label}
          style={{
            width: 8, height: 8,
            borderRadius: '50%',
            background: risk.dot,
            flexShrink: 0,
            opacity: 0.7,
            boxShadow: `0 0 6px ${risk.dot}88`,
          }}
        />
      )}
    </motion.button>
  );
}
