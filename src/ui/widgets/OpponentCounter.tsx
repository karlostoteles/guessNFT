import { motion } from 'framer-motion';
import { useActivePlayer, useEliminatedIds, useGameCharacters, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

/**
 * OpponentCounter — displays how many tiles the opponent has left.
 * Aimed at building "FOMO" and strategic tension as requested.
 */
export function OpponentCounter() {
    const phase = usePhase();
    const activePlayer = useActivePlayer();
    const characters = useGameCharacters();

    // The opponent is whoever is NOT the active player
    const opponent = activePlayer === 'player1' ? 'player2' : 'player1';
    const eliminatedByOpponent = useEliminatedIds(opponent);

    const total = characters.length;
    const remaining = total - (eliminatedByOpponent?.length || 0);

    // Only show during active gameplay phases
    const isVisible =
        phase === GamePhase.QUESTION_SELECT ||
        phase === GamePhase.ANSWER_PENDING ||
        phase === GamePhase.ANSWER_REVEALED ||
        phase === GamePhase.AUTO_ELIMINATING ||
        phase === GamePhase.ELIMINATION ||
        phase === GamePhase.GUESS_SELECT;

    if (!isVisible) return null;

    return (
        <motion.div
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            style={{
                position: 'fixed',
                top: 24,
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 50,
                pointerEvents: 'none',
            }}
        >
            <div style={{
                background: 'rgba(12, 11, 20, 0.82)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(232, 164, 68, 0.22)',
                borderRadius: '12px',
                padding: '6px 16px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
            }}>
                <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    color: 'rgba(232, 164, 68, 0.6)',
                    textTransform: 'uppercase',
                    marginBottom: 2,
                }}>
                    Opponent Standing
                </span>
                <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                }}>
                    <span style={{
                        fontSize: 22,
                        fontWeight: 800,
                        color: '#E8A444',
                        fontFamily: "'Space Grotesk', sans-serif",
                        textShadow: '0 0 10px rgba(232, 164, 68, 0.3)',
                    }}>
                        {remaining}
                    </span>
                    <span style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: 'rgba(255, 255, 255, 0.25)',
                    }}>
                        / {total} tiles
                    </span>
                </div>

                {/* Progress bar to visually show how close they are to winning */}
                <div style={{
                    width: 100,
                    height: 3,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    marginTop: 6,
                    overflow: 'hidden',
                }}>
                    <motion.div
                        initial={{ width: '100%' }}
                        animate={{ width: `${(remaining / total) * 100}%` }}
                        transition={{ type: 'spring', stiffness: 100, damping: 20 }}
                        style={{
                            height: '100%',
                            background: 'linear-gradient(90deg, #E8A444, #FFB84D)',
                        }}
                    />
                </div>
            </div>
        </motion.div>
    );
}
