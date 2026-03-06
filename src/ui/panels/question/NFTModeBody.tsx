/**
 * NFTModeBody — the body content of QuestionPanel in NFT / Online mode.
 *
 * Layout: [Trait category tabs (scrollable)] → [Question bubbles or Top recommendations]
 *
 * Categories are derived from actual trait keys (Hair, Eyes, Brows, Mouth,
 * Body, Clothing, Gear, Scene) and show confirmed/remaining counts.
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NFT_QUESTIONS, type Question } from '@/core/data/questions';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { NFTQuestionButton } from './QuestionButtons';
import { TRAIT_CONFIG, TRAIT_CATEGORIES, getTraitCategory, type TraitCategory } from './zoneConfig';

interface NFTModeBodyProps {
  activeZone: TraitCategory | null;
  hoveredZone: TraitCategory | null;
  setActiveZone: (z: TraitCategory | null) => void;
  setHoveredZone: (z: TraitCategory | null) => void;
  askedIds: Set<string>;
  remaining: Character[];
  onAsk: (q: Question) => void;
}

export function NFTModeBody({
  activeZone, hoveredZone,
  setActiveZone, setHoveredZone,
  askedIds, remaining, onAsk,
}: NFTModeBodyProps) {

  // Info-gain filtered question IDs
  const usefulIds = useMemo(() => {
    const ids = new Set<string>();
    for (const q of NFT_QUESTIONS) {
      if (askedIds.has(q.id)) { ids.add(q.id); continue; }
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      if (yesCount > 0 && yesCount < remaining.length) ids.add(q.id);
    }
    if (ids.size === askedIds.size) NFT_QUESTIONS.forEach((q) => ids.add(q.id));
    return ids;
  }, [remaining, askedIds]);

  // Group questions by trait category
  const categoryQuestions = useMemo(() => {
    const map = new Map<TraitCategory, Question[]>();
    for (const cat of TRAIT_CATEGORIES) {
      map.set(cat, []);
    }
    for (const q of NFT_QUESTIONS) {
      const cat = getTraitCategory(q.traitKey);
      if (cat && usefulIds.has(q.id)) {
        map.get(cat)!.push(q);
      }
    }
    return map;
  }, [usefulIds]);

  // Category stats: { total, asked, remaining }
  const categoryStats = useMemo(() => {
    const stats = new Map<TraitCategory, { total: number; asked: number; remaining: number }>();
    for (const cat of TRAIT_CATEGORIES) {
      const qs = categoryQuestions.get(cat) || [];
      const asked = qs.filter(q => askedIds.has(q.id)).length;
      stats.set(cat, { total: qs.length, asked, remaining: qs.length - asked });
    }
    return stats;
  }, [categoryQuestions, askedIds]);

  // Current category questions
  const activeQuestions = useMemo(() => {
    if (!activeZone) return [];
    return categoryQuestions.get(activeZone) || [];
  }, [activeZone, categoryQuestions]);

  // Compute match% per question
  const matchPctMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const q of NFT_QUESTIONS) {
      if (askedIds.has(q.id) || !usefulIds.has(q.id)) continue;
      const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
      map.set(q.id, remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0);
    }
    return map;
  }, [remaining, askedIds, usefulIds]);

  // Sort by rarity (lowest matchPct first), asked goes last
  const sortedQuestions = useMemo(() => {
    return [...activeQuestions].sort((a, b) => {
      if (askedIds.has(a.id) && !askedIds.has(b.id)) return 1;
      if (!askedIds.has(a.id) && askedIds.has(b.id)) return -1;
      const pctA = matchPctMap.get(a.id) ?? 50;
      const pctB = matchPctMap.get(b.id) ?? 50;
      return pctA - pctB;
    });
  }, [activeQuestions, matchPctMap, askedIds]);

  // TOP QUESTIONS across all categories
  const topQuestions = useMemo(() => {
    const available = NFT_QUESTIONS.filter(
      (q) => usefulIds.has(q.id) && !askedIds.has(q.id)
    );
    return available
      .map((q) => {
        const yesCount = remaining.filter((c) => evaluateQuestion(q, c)).length;
        const pct = remaining.length > 0 ? Math.round((yesCount / remaining.length) * 100) : 0;
        const score = Math.abs(50 - pct);
        return { q, pct, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 12);
  }, [remaining, askedIds, usefulIds]);

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
      flexDirection: 'column'
    }}>
      {/* ── Trait category tabs — horizontally scrollable ── */}
      <div style={{
        display: 'flex',
        gap: 2,
        padding: '8px 10px 0',
        background: 'rgba(255,255,255,0.02)',
        flexShrink: 0,
        overflowX: 'auto',
        WebkitOverflowScrolling: 'touch' as never,
        scrollbarWidth: 'none',
      }}>
        {TRAIT_CATEGORIES.map((cat) => {
          const cfg = TRAIT_CONFIG[cat];
          const stats = categoryStats.get(cat)!;
          const isActive = activeZone === cat;
          const allDone = stats.remaining === 0 && stats.total > 0;

          // Skip empty categories
          if (stats.total === 0) return null;

          return (
            <motion.button
              key={cat}
              onClick={() => setActiveZone(activeZone === cat ? null : cat)}
              whileHover={{ background: isActive ? undefined : 'rgba(255,255,255,0.07)' }}
              style={{
                padding: '6px 8px 8px',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                background: isActive ? `${cfg.color}1A` : 'transparent',
                borderBottom: isActive
                  ? `2px solid ${cfg.color}`
                  : '2px solid transparent',
                color: allDone
                  ? 'rgba(255,255,254,0.2)'
                  : isActive ? cfg.color : 'rgba(255,255,254,0.4)',
                fontFamily: "'Space Grotesk', sans-serif",
                fontWeight: 600,
                fontSize: 10,
                cursor: 'pointer',
                outline: 'none',
                transition: 'all 0.18s',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                whiteSpace: 'nowrap',
                opacity: allDone ? 0.5 : 1,
                flexShrink: 0,
              }}
            >
              <span style={{ fontSize: 12 }}>{cfg.icon}</span>
              <span style={{ letterSpacing: '0.03em' }}>{cfg.label}</span>
              {/* Badge: confirmed / remaining */}
              <span style={{
                fontSize: 8,
                background: allDone
                  ? 'rgba(76,175,80,0.2)'
                  : isActive ? `${cfg.color}25` : 'rgba(255,255,255,0.07)',
                borderRadius: 6,
                padding: '1px 4px',
                color: allDone
                  ? '#4CAF50'
                  : isActive ? cfg.color : 'rgba(255,255,254,0.25)',
              }}>
                {stats.asked > 0 && <span>✓{stats.asked} </span>}
                {stats.remaining}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* ── Question area ── */}
      <div style={{
        overflowY: 'auto', flex: 1,
        padding: '10px 12px 14px',
        WebkitOverflowScrolling: 'touch' as never,
      }}>
        <AnimatePresence mode="wait">
          {!activeZone ? (
            /* ── No category selected: show TOP RECOMMENDED questions ── */
            <motion.div
              key="top-picks"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex', flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ fontSize: 13 }}>⚡</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: 11,
                  color: '#E8A444',
                  letterSpacing: '0.06em',
                }}>
                  TOP PICKS
                </span>
                <span style={{
                  fontSize: 9, color: 'rgba(255,255,254,0.25)',
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  Best questions to narrow it down
                </span>
              </div>

              {topQuestions.length === 0 ? (
                <div style={{
                  textAlign: 'center', fontSize: 12,
                  color: 'rgba(255,255,254,0.22)', marginTop: 20, fontStyle: 'italic',
                }}>
                  No more questions available
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 7,
                  padding: '2px 0',
                }}>
                  {topQuestions.map(({ q, pct }) => (
                    <NFTQuestionButton
                      key={q.id}
                      question={q}
                      asked={false}
                      onClick={() => onAsk(q)}
                      matchPct={pct}
                    />
                  ))}
                </div>
              )}

              <div style={{
                borderTop: '1px solid rgba(255,255,255,0.06)',
                paddingTop: 8,
                fontSize: 9, color: 'rgba(255,255,254,0.15)',
                fontFamily: "'Space Grotesk', sans-serif",
              }}>
                Or pick a trait category above
              </div>
            </motion.div>
          ) : (
            /* ── Category selected: show that category's questions ── */
            <motion.div
              key={activeZone}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.14 }}
              style={{ display: 'flex', flexDirection: 'column', gap: 8 }}
            >
              {/* Category header with stats */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: 14 }}>{TRAIT_CONFIG[activeZone].icon}</span>
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700, fontSize: 11,
                  color: TRAIT_CONFIG[activeZone].color,
                  letterSpacing: '0.06em',
                }}>
                  {TRAIT_CONFIG[activeZone].label}
                </span>
                {categoryStats.get(activeZone)!.asked > 0 && (
                  <span style={{
                    fontSize: 9,
                    background: `${TRAIT_CONFIG[activeZone].color}20`,
                    border: `1px solid ${TRAIT_CONFIG[activeZone].color}40`,
                    borderRadius: 20, padding: '1px 7px',
                    color: TRAIT_CONFIG[activeZone].color,
                  }}>
                    {categoryStats.get(activeZone)!.asked} confirmed ✓
                  </span>
                )}
              </div>

              {sortedQuestions.length === 0 ? (
                <div style={{
                  textAlign: 'center', fontSize: 12,
                  color: 'rgba(255,255,254,0.22)', marginTop: 16, fontStyle: 'italic',
                }}>
                  All {TRAIT_CONFIG[activeZone].label.toLowerCase()} questions answered ✓
                </div>
              ) : (
                <div style={{
                  display: 'flex', flexWrap: 'wrap', gap: 7,
                  padding: '2px 0',
                }}>
                  {sortedQuestions.map((q) => (
                    <NFTQuestionButton
                      key={q.id}
                      question={q}
                      asked={askedIds.has(q.id)}
                      onClick={() => onAsk(q)}
                      matchPct={matchPctMap.get(q.id)}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
