/**
 * OnlineLobbyScreen
 *
 * Create or join an online game room.
 * Streamlined: wallet connect → Create Room / Join Room on one screen.
 * No NFT gate — anyone with a Cartridge wallet can play (random pick available).
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useWalletAddress, useWalletStatus, useWalletStore } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { createGame, joinGame } from '@/services/supabase/gameService';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useGameActions } from '@/core/store/selectors';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';

interface Props {
  onBack: () => void;
}

export function OnlineLobbyScreen({ onBack }: Props) {
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);

  const walletAddress = useWalletAddress();
  const walletStatus = useWalletStatus();
  const { connectWallet } = useWalletConnection();
  const { setGameMode, setOnlineGame, startSetup } = useGameActions();
  const isConnecting = walletStatus === 'connecting' || walletStatus === 'loading_nfts';

  if (!isSupabaseConfigured) {
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,254,0.5)', fontSize: 14, padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>&#x2699;&#xFE0F;</div>
          <div style={{ marginBottom: 8, color: '#FFFFFE' }}>Online mode not configured</div>
          <div>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file.</div>
        </div>
      </LobbyWrapper>
    );
  }

  // Wallet not connected — show login prompt
  if (!walletAddress) {
    const walletError = useWalletStore.getState().error;
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>&#x1F3AE;</div>
          <div style={{
            color: '#FFFFFE',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 700,
            fontSize: 20,
            marginBottom: 8,
          }}>
            Log in to play online
          </div>
          <div style={{ color: 'rgba(255,255,254,0.4)', fontSize: 13, marginBottom: 32 }}>
            Powered by Cartridge Controller — free, no gas needed
          </div>
          <motion.button
            onClick={connectWallet}
            disabled={isConnecting}
            whileHover={isConnecting ? {} : { scale: 1.04, filter: 'brightness(1.1)' }}
            whileTap={isConnecting ? {} : { scale: 0.97 }}
            style={{
              background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
              border: '1px solid rgba(124,58,237,0.5)',
              borderRadius: 12,
              padding: '14px 36px',
              color: '#FFFFFE',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 16,
              cursor: isConnecting ? 'wait' : 'pointer',
              opacity: isConnecting ? 0.7 : 1,
              outline: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              boxShadow: '0 0 30px rgba(124,58,237,0.35)',
            }}
          >
            {isConnecting ? <><Spinner /> Logging in&hellip;</> : '\uD83D\uDD10 Log in'}
          </motion.button>
          {walletError && (
            <div style={{
              marginTop: 16,
              padding: '8px 14px',
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8,
              fontSize: 12,
              color: '#FCA5A5',
              maxWidth: 320,
              margin: '16px auto 0',
              wordBreak: 'break-word',
            }}>
              {walletError}
            </div>
          )}
        </div>
      </LobbyWrapper>
    );
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleCreate = async () => {
    setError('');
    setLoading('create');
    try {
      const characters = await generateAllCollectionCharacters();
      const { game, playerNum } = await createGame(walletAddress, characters);
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum, walletAddress);
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create game');
    } finally {
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    const code = roomCodeInput.trim();
    if (!code || code.length < 4) {
      setError('Enter a valid room code');
      return;
    }
    setError('');
    setLoading('join');
    try {
      const { game, playerNum } = await joinGame(code, walletAddress);
      const characters = await generateAllCollectionCharacters();
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum, walletAddress);
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join game');
    } finally {
      setLoading(null);
    }
  };

  // ── Render: single screen with Create + Join inline ────────────────────────

  return (
    <LobbyWrapper onBack={onBack}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto', width: '100%' }}>
        <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.4)', textAlign: 'center', lineHeight: 1.6, marginBottom: 4 }}>
          SCHIZODIO Collection &middot; 999 characters &middot; Classic 1v1
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <ErrorMsg>{error}</ErrorMsg>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Create Room */}
        <Button
          variant="accent"
          size="lg"
          onClick={handleCreate}
          disabled={!!loading}
          style={{ width: '100%' }}
        >
          {loading === 'create' ? 'Creating\u2026' : 'Create Room'}
        </Button>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          color: 'rgba(255,255,254,0.25)', fontSize: 12, fontWeight: 600,
        }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          OR
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
        </div>

        {/* Join Room — inline, no extra click */}
        <div style={{ display: 'flex', gap: 8, width: '100%' }}>
          <input
            value={roomCodeInput}
            onChange={(e) => {
              setRoomCodeInput(e.target.value.toUpperCase());
              if (error) setError('');
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            maxLength={6}
            placeholder="ROOM CODE"
            style={{
              flex: 1,
              background: 'rgba(255,255,255,0.08)',
              border: '2px solid rgba(255,255,255,0.15)',
              borderRadius: 10,
              padding: '12px 16px',
              color: '#FFFFFE',
              fontFamily: "'Space Grotesk', monospace",
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '0.15em',
              textAlign: 'center',
              outline: 'none',
              textTransform: 'uppercase',
            }}
          />
          <Button
            variant="primary"
            size="lg"
            onClick={handleJoin}
            disabled={!!loading || roomCodeInput.length < 4}
            style={{ flexShrink: 0, minWidth: 100 }}
          >
            {loading === 'join' ? 'Joining\u2026' : 'Join'}
          </Button>
        </div>
      </div>
    </LobbyWrapper>
  );
}

// ── Shared layout wrapper ────────────────────────────────────────────────────

function LobbyWrapper({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
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
        padding: '80px 32px',
        background: 'rgba(15, 14, 23, 0.4)',
        backdropFilter: 'blur(10px)',
        overflowY: 'auto',
      }}
    >
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 40, gap: 24 }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              color: '#FFFFFE',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: 15,
              fontWeight: 700,
              fontFamily: "'Space Grotesk', sans-serif",
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
          >
            &larr; Back
          </button>
          <h2 style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 32,
            fontWeight: 800,
            color: '#FFFFFE',
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            Play Online
          </h2>
        </div>

        {children}
      </div>
    </motion.div>
  );
}

function Spinner() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: 16, height: 16,
        border: '2px solid rgba(255,255,255,0.15)',
        borderTopColor: 'rgba(255,255,255,0.8)',
        borderRadius: '50%',
      }}
    />
  );
}

function ErrorMsg({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'rgba(239,68,68,0.15)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8,
      padding: '8px 14px',
      fontSize: 13,
      color: '#FCA5A5',
      width: '100%',
      textAlign: 'center',
    }}>
      {children}
    </div>
  );
}
