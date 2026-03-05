/**
 * ConfirmedTraits — small collapsible tab that shows traits confirmed as YES.
 * Helps the player track what they know about the opponent's secret character.
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QUESTIONS } from '@/core/data/questions';
import {
    useQuestionHistory, useActivePlayer, usePhase, useGameMode,
} from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

const GAMEPLAY_PHASES = new Set([
    GamePhase.QUESTION_SELECT,
    GamePhase.ANSWER_REVEALED,
    GamePhase.ANSWER_PENDING,
    GamePhase.ELIMINATION,
    GamePhase.AUTO_ELIMINATING,
    GamePhase.GUESS_SELECT,
]);

export function ConfirmedTraits() {
    const [expanded, setExpanded] = useState(false);
    const phase = usePhase();
    const mode = useGameMode();
    const history = useQuestionHistory();
    const activePlayer = useActivePlayer();

    const isNFTMode = mode === 'nft' || mode === 'online' || mode === 'nft-free';

    const confirmedTraits = useMemo(() => {
        return history
            .filter((r) => r.askedBy === activePlayer && r.answer === true)
            .map((r) => {
                const q = QUESTIONS.find((q) => q.id === r.questionId);
                return {
                    id: r.questionId,
                    text: q?.text || r.questionText,
                    icon: q?.icon || '✓',
                    zone: q?.zone,
                };
            });
    }, [history, activePlayer]);

    // Only show during gameplay
    if (!GAMEPLAY_PHASES.has(phase)) return null;

    if (confirmedTraits.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 25,
            pointerEvents: 'auto',
        }}>
            {/* Toggle button */}
            <motion.button
                onClick={() => setExpanded(!expanded)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                    background: 'rgba(74,222,128,0.12)',
                    border: '1px solid rgba(74,222,128,0.3)',
                    borderRadius: expanded ? '12px 12px 0 0' : 12,
                    padding: '6px 14px',
                    cursor: 'pointer',
                    outline: 'none',
                    color: '#4ADE80',
                    fontSize: 11,
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    letterSpacing: '0.05em',
                }}
            >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                {confirmedTraits.length} CONFIRMED
                <span style={{ fontSize: 9, opacity: 0.6 }}>{expanded ? '▼' : '▲'}</span>
            </motion.button>

            {/* Expanded panel */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                            background: 'rgba(12, 11, 20, 0.95)',
                            border: '1px solid rgba(74,222,128,0.2)',
                            borderTop: 'none',
                            borderRadius: '0 0 12px 12px',
                            overflow: 'hidden',
                            maxHeight: 200,
                            backdropFilter: 'blur(12px)',
                        }}
                    >
                        <div style={{
                            padding: '8px 12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            overflowY: 'auto',
                            maxHeight: 180,
                        }}>
                            {confirmedTraits.map((trait) => (
                                <div
                                    key={trait.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 6,
                                        padding: '4px 8px',
                                        background: 'rgba(74,222,128,0.06)',
                                        borderRadius: 8,
                                        fontSize: 11,
                                        color: 'rgba(255,255,254,0.7)',
                                        fontFamily: "'Space Grotesk', sans-serif",
                                    }}
                                >
                                    <span style={{ fontSize: 12 }}>{trait.icon}</span>
                                    <span style={{ flex: 1 }}>
                                        {stripPrefix(trait.text)}
                                    </span>
                                    <span style={{ color: '#4ADE80', fontSize: 10, fontWeight: 700 }}>YES</span>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

/** Strip "Does your character have..." prefix for display */
function stripPrefix(text: string): string {
    const prefixes = [
        'Does your character have a ',
        'Does your character have an ',
        'Does your character have ',
        'Does your character wear a ',
        'Does your character wear an ',
        'Does your character wear ',
        'Is your character ',
        'Does your character ',
    ];
    let result = text;
    for (const p of prefixes) {
        if (result.startsWith(p)) {
            result = result.slice(p.length);
            break;
        }
    }
    result = result.replace(/\?$/, '').trim();
    return result.charAt(0).toUpperCase() + result.slice(1);
}
