import { motion } from 'framer-motion';
import { useGameActions, usePhase } from '@/core/store/selectors';
import { GamePhase } from '@/core/store/types';

/**
 * Global Home button — top-left corner (next to Wallet).
 * Resets game state and returns to Menu.
 */
export function HomeButton() {
    const phase = usePhase();
    const { resetGame } = useGameActions();

    // Don't show on Menu screen
    if (phase === GamePhase.MENU) return null;

    return (
        <motion.button
            onClick={resetGame}
            whileHover={{ scale: 1.1, background: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.9 }}
            style={{
                position: 'fixed',
                top: 16,
                left: 140, // Offset from WalletButton
                zIndex: 100,
                pointerEvents: 'auto',
                background: 'rgba(15, 14, 23, 0.88)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: 12,
                padding: '8px 14px',
                backdropFilter: 'blur(12px)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 12,
                fontWeight: 600,
                outline: 'none',
            }}
        >
            <span style={{ fontSize: 14 }}>🏠</span>
            <span>Home</span>
        </motion.button>
    );
}
