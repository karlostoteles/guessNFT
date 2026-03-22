/**
 * NFTModeBody — the body content of QuestionPanel in NFT / Online mode.
 *
 * Layout: [Data-driven trait category tabs (scrollable)] → [Question bubbles or Top recommendations]
 *
 * Categories are auto-derived from the traitKey field on each question
 * (e.g. "nft_hair" → "Hair", "nft_has_weapons" → "Weapons").
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NFT_QUESTIONS, type Question } from '@/core/data/questions';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { NFTQuestionButton } from './QuestionButtons';
import { TRAIT_CATEGORIES_CONFIG, getTraitCategory, getCategoryConfig } from './zoneConfig';

interface NFTModeBodyProps {
  activeZone: string | null;
  hoveredZone: string | null;
  setActiveZone: (z: string | null) => void;
  setHoveredZone: (z: string | null) => void;
  askedIds: Set<string>;
  remaining: Character[];
  questionImpact: Record<string, { yes: number; no: number }>;
  onAsk: (q: Question) => void;
}

export function NFTModeBody({
  activeZone,
  setActiveZone,
  askedIds, remaining, questionImpact, onAsk,
}: NFTModeBodyProps) {

  // Trait keys that have already been asked — hide other questions with the same traitKey
  const askedTraitKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const q of NFT_QUESTIONS) {
      if (askedIds.has(q.id)) keys.add(q.traitKey);
    }
    return keys;
  }, [askedIds]);

  // Info-gain filtered question IDs, excluding questions in already-asked trait categories
  const usefulIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of NFT_QUESTIONS) {
      // Already asked — keep it visible (greyed out)
      if (askedIds.has(q.id)) { ids.add(q.id); continue; }
      // Same traitKey already asked — hide (no point asking another variant)
      if (askedTraitKeys.has(q.traitKey)) continue;
      // Only show if it provides info gain
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      if (yesCount > 0 && yesCount < remaining.length) ids.add(q.id);
    }
    if (ids.size === askedIds.size) NFT_QUESTIONS.forEach((q) => ids.add(q.id));
    return ids;
  }, [remaining, askedIds, askedTraitKeys]);

  // Group questions by data-driven category
  const categoryQuestions = useMemo(() => {
    const map = new Map<string, Question[]>();
    for (const cat of TRAIT_CATEGORIES_CONFIG) {
      map.set(cat.id, []);
    }
    for (const q of NFT_QUESTIONS) {
      const catId = getTraitCategory(q.traitKey);
      if (catId && usefulIds.has(q.id)) {
        if (!map.has(catId)) map.set(catId, []);
        map.get(catId)!.push(q);
      }
    }
    return map;
  }, [usefulIds]);

  // Category stats
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { total: number; asked: number; remaining: number }>();
    for (const cat of TRAIT_CATEGORIES_CONFIG) {
      const qs = categoryQuestions.get(cat.id) || [];
      const asked = qs.filter(q => askedIds.has(q.id)).length;
      stats.set(cat.id, { total: qs.length, asked, remaining: qs.length - asked });
    }
    return stats;
  }, [categoryQuestions, askedIds]);

  const activeQuestions = useMemo(() => {
    if (!activeZone) return [];
    return categoryQuestions.get(activeZone) || [];
  }, [activeZone, categoryQuestions]);

  const matchPctMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of NFT_QUESTIONS) {
      if (askedIds.has(q.id) || !usefulIds.has(q.id)) continue;
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      map.set(q.id, remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0);
    }
    return map;
  }, [remaining, askedIds, usefulIds]);

  const sortedQuestions = useMemo(() => {
    return [...activeQuestions].sort((a, b) => {
      if (askedIds.has(a.id) && !askedIds.has(b.id)) return 1;
      if (!askedIds.has(a.id) && askedIds.has(b.id)) return -1;
      return (matchPctMap.get(a.id) ?? 50) - (matchPctMap.get(b.id) ?? 50);
    });
  }, [activeQuestions, matchPctMap, askedIds]);

  const topQuestions = useMemo(() => {
    return NFT_QUESTIONS
      .filter((q) => usefulIds.has(q.id) && !askedIds.has(q.id))
      .map((q) => {
        const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
        const pct = remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0;
        return { q, pct, score: Math.abs(50 - pct) };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 12);
  }, [remaining, askedIds, usefulIds]);

  const activeCfg = activeZone ? getCategoryConfig(activeZone) : null;

  return (
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', flexDirection: 'column' }}>
      {/* ── Sub-header: Top Picks vs Categories ── */}
      <div style={{
        display: 'flex', gap: 12, padding: '10px 14px 4px',
        background: 'rgba(255,255,255,0.01)', flexShrink: 0,
        borderBottom: '1px solid rgba(255,255,255,0.03)'
      }}>
        <motion.button
          onClick={() => setActiveZone(null)}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            background: !activeZone ? 'rgba(232,164,68,0.1)' : 'transparent',
            color: !activeZone ? '#E8A444' : 'rgba(255,255,254,0.4)',
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11,
            cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          ⚡ TOP PICKS
        </motion.button>

        <motion.button
          onClick={() => !activeZone && setActiveZone('categories-grid')}
          style={{
            padding: '4px 10px', borderRadius: 6, border: 'none',
            background: activeZone ? 'rgba(255,255,255,0.06)' : 'transparent',
            color: activeZone ? '#FFFFFE' : 'rgba(255,255,254,0.4)',
            fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 11,
            cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: 6
          }}
        >
          📂 CATEGORIES
        </motion.button>
      </div>

      {/* ── Question area ── */}
      <div style={{
        overflowY: 'auto', flex: 1, padding: '10px 12px 14px',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        <AnimatePresence mode="wait">
          {activeZone === 'categories-grid' ? (
            <motion.div
              key="categories-grid"
              initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}
            >
              {TRAIT_CATEGORIES_CONFIG.map((cat) => {
                const stats = categoryStats.get(cat.id);
                if (!stats || stats.total === 0) return null;
                const allDone = stats.remaining === 0;

                return (
                  <motion.button
                    key={cat.id}
                    onClick={() => setActiveZone(cat.id)}
                    whileHover={{ scale: 1.02, background: 'rgba(255,255,255,0.06)' }}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      padding: '16px 12px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)',
                      background: 'rgba(255,255,255,0.03)',
                      color: allDone ? 'rgba(255,255,254,0.3)' : '#FFFFFE',
                      fontFamily: "'Space Grotesk', sans-serif", cursor: 'pointer', textAlign: 'left',
                      display: 'flex', flexDirection: 'column', gap: 8, opacity: allDone ? 0.6 : 1
                    }}
                  >
                    <div style={{ fontSize: 20 }}>{cat.icon}</div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700 }}>{cat.label}</div>
                      <div style={{ fontSize: 9, opacity: 0.5 }}>{stats.total} traits • {stats.remaining} left</div>
                    </div>
                  </motion.button>
                );
              })}
            </motion.div>
          ) : activeZone ? (
            <motion.div
              key={activeZone}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.14 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <motion.button
                  onClick={() => setActiveZone('categories-grid')}
                  style={{ 
                    background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 6,
                    padding: '2px 8px', color: 'rgba(255,255,254,0.4)', fontSize: 10, cursor: 'pointer'
                  }}
                >
                  ← Back
                </motion.button>
                <span style={{ fontSize: 14 }}>{activeCfg?.icon}</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: 11, color: activeCfg?.color,
                  letterSpacing: '0.06em',
                }}>
                  {activeCfg?.label}
                </span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '2px 0' }}>
                {sortedQuestions.map((q) => (
                  <NFTQuestionButton
                    key={q.id} question={q} asked={askedIds.has(q.id)}
                    onClick={() => onAsk(q)} matchPct={matchPctMap.get(q.id)}
                    impact={questionImpact[q.id]}
                  />
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="top-picks"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
               {/* ... (keep topQuestions logic) ... */}
               <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '2px 0' }}>
                  {topQuestions.map(({ q, pct }) => (
                    <NFTQuestionButton
                      key={q.id} question={q} asked={false}
                      onClick={() => onAsk(q)} matchPct={pct}
                      impact={questionImpact[q.id]}
                    />
                  ))}
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
