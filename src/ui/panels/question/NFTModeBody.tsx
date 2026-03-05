/**
 * NFTModeBody — the body content of QuestionPanel in NFT / Online mode.
 *
 * Layout: [Silhouette column] | [Zone tabs + question list]
 */

import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NFT_QUESTIONS, type Question, type QuestionZone } from '@/core/data/questions';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { NFTQuestionButton } from './QuestionButtons';
import { ZONE_CONFIG, ZONES } from './zoneConfig';
import { useIsMobile } from '@/shared/hooks/useMediaQuery';

interface NFTModeBodyProps {
  activeZone: QuestionZone | null;
  hoveredZone: QuestionZone | null;
  setActiveZone: (z: QuestionZone | null) => void;
  setHoveredZone: (z: QuestionZone | null) => void;
  zoneBadges: Record<QuestionZone, { yes: number; no: number }>;
  askedIds: Set<string>;
  remaining: Character[];
  onAsk: (q: Question) => void;
}

export function NFTModeBody({
  activeZone, hoveredZone,
  setActiveZone, setHoveredZone,
  zoneBadges, askedIds, remaining, onAsk,
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

  const zoneQuestions = useMemo(() => {
    if (!activeZone) return [];
    return NFT_QUESTIONS.filter((q) => q.zone === activeZone && usefulIds.has(q.id));
  }, [activeZone, usefulIds]);

  const isMobile = useIsMobile();

  return (
    <div style={{
      display: 'flex',
      flex: 1,
      overflow: 'hidden',
      flexDirection: 'column'
    }}>
      {/* ── Main content area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>


        {/* Zone selector tabs */}
        <div style={{
          display: 'flex', gap: 4, padding: '10px 12px 0',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0,
        }}>
          {ZONES.map((zone) => {
            const cfg = ZONE_CONFIG[zone];
            const isActive = activeZone === zone;
            const badgeYes = zoneBadges[zone].yes;
            const qCount = NFT_QUESTIONS.filter(
              (q) => q.zone === zone && usefulIds.has(q.id) && !askedIds.has(q.id)
            ).length;
            return (
              <motion.button
                key={zone}
                onClick={() => setActiveZone(activeZone === zone ? null : zone)}
                whileHover={{ background: isActive ? undefined : 'rgba(255,255,255,0.07)' }}
                style={{
                  flex: 1, padding: '8px 6px 11px',
                  border: 'none', borderRadius: '8px 8px 0 0',
                  background: isActive ? `${cfg.color}1A` : 'transparent',
                  borderBottom: isActive
                    ? `2px solid ${cfg.color}`
                    : '2px solid transparent',
                  color: isActive ? cfg.color : 'rgba(255,255,254,0.4)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 600, fontSize: 11,
                  cursor: 'pointer', outline: 'none', transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}
              >
                <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                <span style={{ letterSpacing: '0.04em' }}>{cfg.label}</span>
                <span style={{
                  fontSize: 9,
                  background: isActive ? `${cfg.color}25` : 'rgba(255,255,255,0.07)',
                  borderRadius: 8, padding: '1px 5px',
                  color: isActive ? cfg.color : 'rgba(255,255,254,0.2)',
                }}>
                  {badgeYes > 0 ? `✓${badgeYes} ` : ''}{qCount}
                </span>
              </motion.button>
            );
          })}
        </div>

        {/* Question list */}
        <div style={{
          overflowY: 'auto', flex: 1,
          padding: '12px 14px 16px',
          WebkitOverflowScrolling: 'touch' as never,
        }}>
          <AnimatePresence mode="wait">
            {!activeZone ? (
              /* ── No zone selected: prompt + quick zone pills ── */
              <motion.div
                key="no-zone"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  height: '100%', minHeight: 160,
                  color: 'rgba(255,255,254,0.2)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 13, textAlign: 'center', gap: 12,
                }}
              >
                <div style={{ fontSize: 36 }}>🔍</div>
                <div>Select a category above<br />to browse trait questions</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center', marginTop: 8 }}>
                  {ZONES.map((zone) => {
                    const cfg = ZONE_CONFIG[zone];
                    return (
                      <motion.button
                        key={zone}
                        onClick={() => setActiveZone(zone)}
                        whileHover={{ scale: 1.06 }}
                        whileTap={{ scale: 0.96 }}
                        style={{
                          background: `${cfg.color}18`,
                          border: `1px solid ${cfg.color}40`,
                          borderRadius: 20, padding: '6px 14px',
                          cursor: 'pointer', outline: 'none',
                          color: cfg.color,
                          fontFamily: "'Space Grotesk', sans-serif",
                          fontWeight: 700, fontSize: 11,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        {cfg.icon} {cfg.label}
                      </motion.button>
                    );
                  })}
                </div>
              </motion.div>
            ) : (
              /* ── Zone selected: question list ── */
              <motion.div
                key={activeZone}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.14 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
              >
                {/* Zone header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span style={{ fontSize: 14 }}>{ZONE_CONFIG[activeZone].icon}</span>
                  <span style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700, fontSize: 11,
                    color: ZONE_CONFIG[activeZone].color,
                    letterSpacing: '0.08em',
                  }}>
                    {ZONE_CONFIG[activeZone].label} TRAITS
                  </span>
                  {zoneBadges[activeZone].yes > 0 && (
                    <span style={{
                      fontSize: 10,
                      background: `${ZONE_CONFIG[activeZone].color}20`,
                      border: `1px solid ${ZONE_CONFIG[activeZone].color}40`,
                      borderRadius: 20, padding: '1px 7px',
                      color: ZONE_CONFIG[activeZone].color,
                    }}>
                      {zoneBadges[activeZone].yes} confirmed ✓
                    </span>
                  )}
                </div>

                {zoneQuestions.length === 0 ? (
                  <div style={{
                    textAlign: 'center', fontSize: 12,
                    color: 'rgba(255,255,254,0.22)', marginTop: 20, fontStyle: 'italic',
                  }}>
                    All {ZONE_CONFIG[activeZone].label.toLowerCase()} questions answered
                  </div>
                ) : (
                  zoneQuestions.map((q) => (
                    <NFTQuestionButton
                      key={q.id}
                      question={q}
                      asked={askedIds.has(q.id)}
                      onClick={() => onAsk(q)}
                    />
                  ))
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
