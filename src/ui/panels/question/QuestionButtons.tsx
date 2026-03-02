import { motion } from 'framer-motion';
import type { Question } from '@/core/data/questions';

// ─── NFT / Online mode question button ────────────────────────────────────────

export function NFTQuestionButton({
  question, asked, onClick,
}: { question: Question; asked: boolean; onClick: () => void }) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked   ? {} : { scale: 0.98 }}
      style={{
        padding: '10px 12px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.10)',
        borderRadius: 10,
        background: asked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 12.5,
        fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left',
        outline: 'none',
        lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
      }}
    >
      {question.icon && (
        <span style={{ fontSize: 15, flexShrink: 0, opacity: asked ? 0.3 : 1 }}>
          {question.icon}
        </span>
      )}
      <span style={{ flex: 1 }}>{question.text}</span>
      {asked && (
        <span style={{
          fontSize: 12, fontWeight: 700,
          color: 'rgba(232,164,68,0.6)', flexShrink: 0,
        }}>
          ✓
        </span>
      )}
    </motion.button>
  );
}

// ─── Free mode question button ────────────────────────────────────────────────

export function FreeQuestionButton({
  question, asked, index, onClick,
}: { question: Question; asked: boolean; index: number; onClick: () => void }) {
  const dots = (['#4ADE80', '#FACC15', '#F87171'] as const)[index % 3];
  return (
    <motion.button
      onClick={onClick}
      whileHover={asked ? {} : { scale: 1.015, background: 'rgba(255,255,255,0.1)' }}
      whileTap={asked   ? {} : { scale: 0.98 }}
      style={{
        padding: '11px 14px',
        border: asked
          ? '1px solid rgba(255,255,255,0.04)'
          : '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        background: asked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        color: asked ? 'rgba(255,255,254,0.22)' : '#FFFFFE',
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, fontWeight: 500,
        cursor: asked ? 'default' : 'pointer',
        textAlign: 'left', outline: 'none', lineHeight: 1.4,
        transition: 'all 0.18s',
        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
      }}
    >
      <span style={{ flex: 1 }}>{question.text}</span>
      {asked ? (
        <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(232,164,68,0.6)', flexShrink: 0 }}>
          ✓
        </span>
      ) : (
        <span style={{
          width: 8, height: 8, borderRadius: '50%', background: dots,
          flexShrink: 0, opacity: 0.7, boxShadow: `0 0 6px ${dots}88`,
        }}/>
      )}
    </motion.button>
  );
}
