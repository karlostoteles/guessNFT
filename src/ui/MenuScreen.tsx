import { motion } from 'framer-motion';
import { Button } from './common/Button';
import { useGameActions } from '../store/selectors';

export function MenuScreen() {
  const { startSetup } = useGameActions();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
        background: 'radial-gradient(ellipse at center, rgba(15,14,23,0.6) 0%, rgba(15,14,23,0.95) 70%)',
      }}
    >
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 150 }}
        style={{ textAlign: 'center' }}
      >
        {/* Title */}
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 64,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #E8A444 0%, #F0C060 50%, #E8A444 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          marginBottom: 8,
          textShadow: 'none',
          filter: 'drop-shadow(0 0 40px rgba(232,164,68,0.3))',
        }}>
          WhoisWho
        </div>

        <div style={{
          fontSize: 16,
          color: 'rgba(255,255,254,0.4)',
          marginBottom: 48,
          fontWeight: 500,
        }}>
          The classic guessing game — on chain
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          <Button variant="accent" size="lg" onClick={startSetup} style={{
            fontSize: 18,
            padding: '18px 48px',
          }}>
            Start Game
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            marginTop: 40,
            fontSize: 12,
            color: 'rgba(255,255,254,0.2)',
          }}
        >
          Local 2-Player — Take turns on the same screen
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
