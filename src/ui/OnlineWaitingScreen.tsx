/**
 * OnlineWaitingScreen
 *
 * Shown in ONLINE_WAITING phase — local player has committed their character,
 * waiting for the opponent to do the same.
 */
import { motion } from 'framer-motion';
import { useOnlineRoomCode, useOnlinePlayerNum } from '../store/selectors';

export function OnlineWaitingScreen() {
  const roomCode = useOnlineRoomCode();
  const playerNum = useOnlinePlayerNum();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
        gap: 24,
      }}
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 36,
          fontWeight: 800,
          color: '#E8A444',
          marginBottom: 12,
          textShadow: '0 0 40px rgba(232,164,68,0.4)',
        }}>
          Character Locked In ✓
        </div>

        <div style={{
          fontSize: 15,
          color: 'rgba(255,255,254,0.5)',
          marginBottom: 32,
        }}>
          You're Player {playerNum} · Waiting for opponent to choose…
        </div>

        {/* Room code reminder */}
        {roomCode && (
          <div style={{
            fontSize: 13,
            color: 'rgba(255,255,254,0.3)',
            marginBottom: 32,
          }}>
            Room: <span style={{ color: '#E8A444', fontWeight: 700, letterSpacing: '0.12em' }}>{roomCode}</span>
          </div>
        )}

        {/* Pulsing dots */}
        <motion.div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ y: [0, -8, 0], opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 0.9, delay: i * 0.2 }}
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: '#E8A444',
              }}
            />
          ))}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
