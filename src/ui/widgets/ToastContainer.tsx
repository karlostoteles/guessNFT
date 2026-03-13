import { motion, AnimatePresence } from 'framer-motion';
import { useToastStore, type Toast } from '@/core/store/toastStore';
import { getExplorerLink } from '@/services/starknet/commitReveal';

export function ToastContainer() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div style={{
      position: 'fixed',
      top: 24,
      right: 24,
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      pointerEvents: 'none',
      width: 'min(380px, calc(100vw - 48px))',
    }}>
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const removeToast = useToastStore((state) => state.removeToast);

  const colors = {
    info: { bg: 'rgba(30, 41, 59, 0.95)', border: 'rgba(255, 255, 255, 0.1)', icon: 'ℹ️' },
    success: { bg: 'rgba(6, 78, 59, 0.95)', border: 'rgba(52, 211, 153, 0.2)', icon: '✅' },
    error: { bg: 'rgba(127, 29, 29, 0.95)', border: 'rgba(248, 113, 113, 0.2)', icon: '❌' },
    loading: { bg: 'rgba(15, 14, 23, 0.95)', border: 'rgba(124, 58, 237, 0.3)', icon: '⏳' },
  }[toast.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 20, scale: 0.95 }}
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        padding: '14px 18px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
        backdropFilter: 'blur(10px)',
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ fontSize: 18 }}>{colors.icon}</div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{
          color: '#FFFFFE',
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: 14,
          fontWeight: 600,
          lineHeight: 1.4,
        }}>
          {toast.message}
        </div>
        
        {toast.txHash && (
          <a
            href={getExplorerLink(toast.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: '#A78BFA',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            View on Explorer ↗
          </a>
        )}
      </div>
      
      <button
        onClick={() => removeToast(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.3)',
          cursor: 'pointer',
          padding: 4,
          fontSize: 16,
          outline: 'none',
        }}
      >
        ×
      </button>
    </motion.div>
  );
}
