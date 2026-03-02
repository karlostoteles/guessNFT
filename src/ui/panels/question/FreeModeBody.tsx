/**
 * FreeModeBody — the body content of QuestionPanel in free (vs-CPU) mode.
 *
 * Classic layout: category tabs (Hair / Face / Accessories) + question grid.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FREE_QUESTIONS, type Question } from '@/core/data/questions';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { FreeQuestionButton } from './QuestionButtons';

const FREE_CATEGORIES = [
  { key: 'hair'        as const, label: 'Hair',        icon: '💇'  },
  { key: 'face'        as const, label: 'Face',        icon: '👁️'   },
  { key: 'accessories' as const, label: 'Accessories', icon: '🎩'  },
] as const;

type FreeCategory = typeof FREE_CATEGORIES[number]['key'];

interface FreeModeBodyProps {
  askedIds:  Set<string>;
  remaining: Character[];
  onAsk:     (q: Question) => void;
}

export function FreeModeBody({ askedIds, remaining, onAsk }: FreeModeBodyProps) {
  const [freeCategory, setFreeCategory] = useState<FreeCategory>('hair');

  // Info-gain filtered question IDs
  const usefulIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of FREE_QUESTIONS) {
      if (askedIds.has(q.id)) { ids.add(q.id); continue; }
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      if (yesCount > 0 && yesCount < remaining.length) ids.add(q.id);
    }
    if (ids.size === askedIds.size) FREE_QUESTIONS.forEach((q) => ids.add(q.id));
    return ids;
  }, [remaining, askedIds]);

  return (
    <>
      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: 4, padding: '10px 12px 0',
        background: 'rgba(255,255,255,0.03)', flexShrink: 0,
      }}>
        {FREE_CATEGORIES.map((cat) => {
          const catUseful  = FREE_QUESTIONS.filter(
            (q) => q.category === cat.key && usefulIds.has(q.id) && !askedIds.has(q.id)
          ).length;
          const catAsked   = FREE_QUESTIONS.filter(
            (q) => q.category === cat.key && askedIds.has(q.id)
          ).length;
          const catTotal   = catUseful + catAsked;
          const allAsked   = catUseful === 0;
          const isActiveCat= freeCategory === cat.key;
          return (
            <motion.button
              key={cat.key}
              onClick={() => setFreeCategory(cat.key)}
              whileHover={{ background: isActiveCat ? undefined : 'rgba(255,255,255,0.08)' }}
              style={{
                flex: 1, padding: '9px 10px 12px',
                border: 'none', borderRadius: '8px 8px 0 0',
                background: isActiveCat ? 'rgba(232,164,68,0.15)' : 'transparent',
                borderBottom: isActiveCat
                  ? '2px solid #E8A444'
                  : '2px solid transparent',
                color: isActiveCat
                  ? '#E8A444'
                  : allAsked
                    ? 'rgba(255,255,254,0.2)'
                    : 'rgba(255,255,254,0.5)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600, fontSize: 13,
                cursor: 'pointer', outline: 'none', transition: 'all 0.18s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 15 }}>{cat.icon}</span>
              <span>{cat.label}</span>
              <span style={{
                fontSize: 10,
                background: catAsked > 0
                  ? 'rgba(232,164,68,0.15)'
                  : 'rgba(255,255,255,0.08)',
                borderRadius: 8, padding: '1px 6px',
                color: catAsked > 0
                  ? 'rgba(232,164,68,0.6)'
                  : 'rgba(255,255,254,0.25)',
              }}>
                {catAsked}/{catTotal}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Questions grid */}
      <div style={{
        overflowY: 'auto', flex: 1, padding: '12px 12px 16px',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={freeCategory}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.14 }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))',
              gap: 8,
            }}
          >
            {FREE_QUESTIONS
              .filter((q) => q.category === freeCategory && usefulIds.has(q.id))
              .map((q, idx) => (
                <FreeQuestionButton
                  key={q.id}
                  question={q}
                  asked={askedIds.has(q.id)}
                  index={idx}
                  onClick={() => onAsk(q)}
                />
              ))}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  );
}
