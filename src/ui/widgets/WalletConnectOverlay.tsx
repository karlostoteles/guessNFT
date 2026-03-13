import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { sfx } from '@/shared/audio/sfx';

interface WalletConnectOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'cartridge' | 'discovery') => void;
  isConnecting?: boolean;
}

export function WalletConnectOverlay({ isOpen, onClose, onSelect, isConnecting }: WalletConnectOverlayProps) {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(5, 5, 15, 0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        }}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%',
            maxWidth: 420,
            background: 'linear-gradient(165deg, #121225 0%, #0a0a14 100%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 24,
            padding: '32px 24px',
            position: 'relative',
            boxShadow: '0 24px 64px rgba(0, 0, 0, 0.6), 0 0 32px rgba(232, 164, 68, 0.1)',
            overflow: 'hidden'
          }}
        >
          {/* Decorative Background Elements */}
          <div style={{
            position: 'absolute', top: '-20%', right: '-20%',
            width: '60%', height: '60%',
            background: 'radial-gradient(circle, rgba(232,164,68,0.1) 0%, transparent 70%)',
            pointerEvents: 'none'
          }} />
          
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div style={{ textAlign: 'center', marginBottom: 32 }}>
              <h2 style={{ 
                fontFamily: "'Space Grotesk', sans-serif", 
                fontSize: 24, 
                fontWeight: 700, 
                color: '#FFF',
                marginBottom: 8
              }}>
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>
                Choose how you want to play on Starknet
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <WalletOption 
                name="Cartridge"
                description="Social login & Gasless play"
                icon="/cartridge-icon.png" // We'll hope these exist or use placeholders
                onClick={() => { sfx.click(); onSelect('cartridge'); }}
                disabled={isConnecting}
                highlight
              />

              <div style={{ 
                height: 1, 
                background: 'rgba(255,255,255,0.05)', 
                margin: '8px 0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <span style={{ 
                  background: '#0d0d1a', 
                  padding: '0 12px', 
                  fontSize: 10, 
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em'
                }}>Extensions</span>
              </div>

              <WalletOption 
                name="Browser Wallets"
                description="Argent X or Braavos"
                icon="/starknet-icon.png"
                onClick={() => { sfx.click(); onSelect('discovery'); }}
                disabled={isConnecting}
              />
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                background: 'none',
                border: 'none',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 14,
                fontWeight: 500,
                marginTop: 24,
                cursor: 'pointer',
                fontFamily: "'Inter', sans-serif"
              }}
            >
              Cancel
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function WalletOption({ name, description, icon, onClick, disabled, highlight }: any) {
  return (
    <motion.button
      whileHover={disabled ? {} : { scale: 1.02, backgroundColor: 'rgba(255,255,255,0.05)' }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '16px 20px',
        background: highlight ? 'rgba(232, 164, 68, 0.08)' : 'rgba(255, 255, 255, 0.03)',
        border: highlight ? '1px solid rgba(232, 164, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 16,
        cursor: disabled ? 'default' : 'pointer',
        textAlign: 'left',
        outline: 'none',
        opacity: disabled ? 0.6 : 1,
        transition: 'background-color 0.2s ease'
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: 'rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 24
      }}>
        {name === 'Cartridge' ? '🎮' : '🦊'}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#FFF', fontWeight: 700, fontSize: 16, marginBottom: 2 }}>{name}</div>
        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{description}</div>
      </div>
      {highlight && (
        <div style={{
          background: '#E8A444',
          color: '#000',
          fontSize: 10,
          fontWeight: 800,
          padding: '2px 8px',
          borderRadius: 10,
          textTransform: 'uppercase'
        }}>Best</div>
      )}
    </motion.button>
  );
}
