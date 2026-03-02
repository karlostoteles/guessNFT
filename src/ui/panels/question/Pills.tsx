import { motion } from 'framer-motion';

// ─── Waiting pill ─────────────────────────────────────────────────────────────

export function WaitingPill() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      style={{
        pointerEvents: 'none',
        background: 'rgba(15,14,23,0.85)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 40,
        padding: '10px 22px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
        color: 'rgba(255,255,254,0.45)',
        fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 600,
        fontSize: 14,
        whiteSpace: 'nowrap',
      }}
    >
      <motion.span
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ repeat: Infinity, duration: 1.6 }}
      >
        ⏳
      </motion.span>
      Waiting for opponent's question…
    </motion.div>
  );
}

// ─── Risk-it pill (minimised) ─────────────────────────────────────────────────

export function RiskItPill({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, filter: 'brightness(1.12)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: 'linear-gradient(135deg, rgba(224,85,85,0.22), rgba(180,50,50,0.32))',
        border: '1px solid rgba(224,85,85,0.5)',
        borderRadius: 40, padding: '10px 22px',
        display: 'flex', alignItems: 'center', gap: 8,
        cursor: 'pointer', backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)', outline: 'none',
        color: '#FF6B6B', fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}
    >
      <motion.span
        animate={{ rotate: [0, -10, 10, -5, 0] }}
        transition={{ repeat: Infinity, duration: 2, repeatDelay: 3 }}
        style={{ fontSize: 16 }}
      >
        🎯
      </motion.span>
      RISK IT!
    </motion.button>
  );
}

// ─── Ask pill (minimised) ─────────────────────────────────────────────────────

export function AskPill({
  askedCount,
  onClick,
}: { askedCount: number; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.04, filter: 'brightness(1.1)' }}
      whileTap={{ scale: 0.97 }}
      style={{
        background: 'linear-gradient(135deg, rgba(232,164,68,0.18), rgba(124,58,237,0.18))',
        border: '1px solid rgba(232,164,68,0.35)',
        borderRadius: 40, padding: '10px 22px',
        display: 'flex', alignItems: 'center', gap: 10,
        cursor: 'pointer', backdropFilter: 'blur(14px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.45)', outline: 'none',
        color: '#E8A444', fontFamily: "'Space Grotesk', sans-serif",
        fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', pointerEvents: 'auto',
      }}
    >
      <span style={{ fontSize: 16 }}>❓</span>
      Ask a Question
      {askedCount > 0 && (
        <span style={{
          background: 'rgba(232,164,68,0.2)', border: '1px solid rgba(232,164,68,0.25)',
          borderRadius: 12, padding: '1px 8px', fontSize: 11, color: 'rgba(232,164,68,0.7)',
        }}>
          {askedCount} asked
        </span>
      )}
      <span style={{ fontSize: 12, opacity: 0.5 }}>▲</span>
    </motion.button>
  );
}
