import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { useWinner, useGuessedCharacterId, useActivePlayer, useGameActions, usePlayerState, useGameCharacters } from '../store/selectors';
import { COLORS } from '../utils/constants';

export function ResultScreen() {
  const winner = useWinner();
  const guessedId = useGuessedCharacterId();
  const { resetGame } = useGameActions();
  const p1State = usePlayerState('player1');
  const p2State = usePlayerState('player2');
  const characters = useGameCharacters();

  if (!winner) return null;

  const winnerLabel = winner === 'player1' ? 'Player 1' : 'Player 2';
  const winnerColor = winner === 'player1' ? COLORS.player1.primary : COLORS.player2.primary;

  const p1Secret = characters.find((c) => c.id === p1State.secretCharacterId);
  const p2Secret = characters.find((c) => c.id === p2State.secretCharacterId);
  const guessedChar = characters.find((c) => c.id === guessedId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 30,
      }}
    >
      <Card style={{ textAlign: 'center', maxWidth: 400 }}>
        {/* Confetti dots */}
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            initial={{
              opacity: 0,
              y: 0,
              x: (Math.random() - 0.5) * 200,
            }}
            animate={{
              opacity: [0, 1, 0],
              y: [0, -100 - Math.random() * 200],
              x: (Math.random() - 0.5) * 400,
            }}
            transition={{
              duration: 2 + Math.random(),
              delay: Math.random() * 0.5,
              repeat: Infinity,
              repeatDelay: Math.random() * 2,
            }}
            style={{
              position: 'absolute',
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: ['#E8A444', '#44A8E8', '#4CAF50', '#E05555', '#9C27B0'][i % 5],
              left: '50%',
              bottom: '50%',
            }}
          />
        ))}

        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        >
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 48,
            fontWeight: 800,
            color: winnerColor,
            textShadow: `0 0 60px ${winnerColor}60`,
            marginBottom: 8,
          }}>
            {winnerLabel} Wins!
          </div>

          {guessedChar && (
            <div style={{
              fontSize: 15,
              color: 'rgba(255,255,254,0.5)',
              marginBottom: 24,
            }}>
              Guessed: {guessedChar.name}
            </div>
          )}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 24,
            marginBottom: 32,
          }}>
            {p1Secret && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.player1.primary, marginBottom: 4, fontWeight: 600 }}>
                  P1's Secret
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {p1Secret.name}
                </div>
              </div>
            )}
            {p2Secret && (
              <div>
                <div style={{ fontSize: 12, color: COLORS.player2.primary, marginBottom: 4, fontWeight: 600 }}>
                  P2's Secret
                </div>
                <div style={{
                  fontSize: 18,
                  fontWeight: 700,
                  fontFamily: "'Space Grotesk', sans-serif",
                }}>
                  {p2Secret.name}
                </div>
              </div>
            )}
          </div>

          <Button variant="accent" size="lg" onClick={resetGame}>
            Play Again
          </Button>
        </motion.div>
      </Card>
    </motion.div>
  );
}
