import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import { useActivePlayer, useEliminatedIds, useCurrentQuestion, useGameActions, useGameCharacters } from '@/core/store/selectors';
import { sfx } from '@/shared/audio/sfx';

export function GuessPanel() {
  const [isGuessingMode, setIsGuessingMode] = useState(false);
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const currentQuestion = useCurrentQuestion();
  const { makeGuess, cancelGuess } = useGameActions();
  const previews = useCharacterPreviews();
  const characters = useGameCharacters();
  const midTurn = currentQuestion !== null;
  const elimSet = new Set(eliminatedIds);

  // Sort: non-eliminated first, then eliminated
  const sortedCharacters = [...characters].sort((a, b) => {
    const aElim = elimSet.has(a.id) ? 1 : 0;
    const bElim = elimSet.has(b.id) ? 1 : 0;
    return aElim - bElim;
  });

  const remainingCount = characters.length - elimSet.size;

  const handleCharClick = (charId: string) => {
    if (!isGuessingMode) {
      sfx.click();
      // Optional: show info?
      return;
    }
    makeGuess(charId);
  };

  const handleToggleRisk = () => {
    sfx.click();
    setIsGuessingMode(!isGuessingMode);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <Card style={{
        width: 'min(800px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
        position: 'relative',
        padding: '32px 24px',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <AnimatePresence mode="wait">
            {!isGuessingMode ? (
              <motion.div
                key="board-header"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  color: '#FFFFFE',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  📋 The Board
                </div>
                <div style={{
                  fontSize: 14,
                  color: 'rgba(255,255,254,0.4)',
                  marginBottom: 16,
                }}>
                  Review the characters before making your move
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="risk-header"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 28,
                  fontWeight: 800,
                  background: 'linear-gradient(135deg, #FF6B6B, #E05555)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.02em',
                  marginBottom: 6,
                }}>
                  🎯 Risk It All!
                </div>
                <div style={{
                  fontSize: 14,
                  color: '#FF6B6B',
                  fontWeight: 600,
                  marginBottom: 16,
                }}>
                  DANGER: Guess wrong and you lose your turn!
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            marginBottom: 12,
          }}>
            <div style={{
              fontSize: 13,
              color: '#E8A444',
              fontWeight: 700,
              background: 'rgba(232,164,68,0.1)',
              padding: '4px 12px',
              borderRadius: 20,
              border: '1px solid rgba(232,164,68,0.2)',
            }}>
              {remainingCount} candidates remaining
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button variant="secondary" size="md" onClick={cancelGuess}>
              {midTurn ? 'End Turn' : 'Close Board'}
            </Button>

            <Button
              variant="no"
              size="md"
              onClick={handleToggleRisk}
              style={isGuessingMode ? {
                background: 'linear-gradient(135deg, #E05555, #C04444)',
                borderColor: '#FF6B6B',
                boxShadow: '0 0 24px rgba(224,85,85,0.5)',
              } : {
                background: 'linear-gradient(135deg, rgba(224,85,85,0.2), rgba(180,50,50,0.3))',
                borderColor: 'rgba(224,85,85,0.4)',
              }}
            >
              {isGuessingMode ? '✕ Cancel Guess' : '🎲 Risk It!'}
            </Button>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(80px, calc(50% - 8px)), 1fr))',
          gap: 8,
          padding: 8,
          maxHeight: 'min(360px, 45vh)',
          overflowY: 'auto',
        }}>
          {sortedCharacters.map((char) => {
            const isEliminated = elimSet.has(char.id);
            return (
              <motion.button
                key={char.id}
                onClick={() => !isEliminated && handleCharClick(char.id)}
                whileHover={isEliminated ? {} : {
                  scale: 1.05,
                  borderColor: isGuessingMode ? 'rgba(224,85,85,0.6)' : 'rgba(232,164,68,0.5)',
                  background: isGuessingMode ? 'rgba(224,85,85,0.1)' : 'rgba(255,255,255,0.08)',
                }}
                whileTap={isEliminated ? {} : { scale: 0.95 }}
                style={{
                  background: isEliminated
                    ? 'rgba(255,255,255,0.02)'
                    : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${isEliminated
                    ? 'rgba(255,255,255,0.05)'
                    : isGuessingMode
                      ? 'rgba(224,85,85,0.4)'
                      : 'rgba(252,192,64,0.25)'
                    }`,
                  borderRadius: 12,
                  padding: 8,
                  cursor: isEliminated ? 'not-allowed' : 'pointer',
                  outline: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  opacity: isEliminated ? 0.2 : 1,
                  transition: 'border-color 0.2s, background 0.2s',
                  position: 'relative',
                }}
              >
                {isGuessingMode && !isEliminated && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -1,
                      background: '#E05555',
                      color: 'white',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 12,
                      zIndex: 2,
                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                    }}
                  >
                    !
                  </motion.div>
                )}
                <img
                  src={previews.get(char.id)}
                  alt={char.name}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    objectFit: 'cover',
                    filter: isEliminated ? 'grayscale(1)' : 'none',
                  }}
                />
                <span style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 11,
                  fontWeight: 700,
                  color: isEliminated ? 'rgba(255,255,254,0.4)' : '#FFFFFE',
                  textAlign: 'center',
                  width: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {char.name}
                </span>
              </motion.button>
            );
          })}
        </div>
      </Card>
    </motion.div>
  );
}
