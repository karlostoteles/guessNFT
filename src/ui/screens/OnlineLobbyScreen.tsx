/**
 * OnlineLobbyScreen
 *
 * Create or join an online game room.
 * Shown when user clicks "Play Online" from the main menu.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { useWalletAddress, useWalletStatus, useOwnedNFTs, useWalletStore } from '@/services/starknet/walletStore';
import { useWalletConnection } from '@/services/starknet/hooks';
import { createGame, joinGame } from '@/services/supabase/gameService';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useGameActions } from '@/core/store/selectors';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';

interface Props {
  onBack: () => void;
}

type LobbyView = 'home' | 'join';

export function OnlineLobbyScreen({ onBack }: Props) {
  const [view, setView] = useState<LobbyView>('home');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const walletAddress = useWalletAddress();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const { connectWallet } = useWalletConnection();
  const { setGameMode, setOnlineGame, startSetup } = useGameActions();
  const isConnecting = walletStatus === 'connecting' || walletStatus === 'loading_nfts';

  if (!isSupabaseConfigured) {
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,254,0.5)', fontSize: 14, padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>⚙️</div>
          <div style={{ marginBottom: 8, color: '#FFFFFE' }}>Online mode not configured</div>
          <div>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file.</div>
        </div>
      </LobbyWrapper>
    );
  }

  if (!walletAddress) {
    const walletError = useWalletStore.getState().error;
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🎮</div>
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
            {isConnecting ? <><Spinner /> Logging in…</> : '🔐 Log in'}
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

  // NFT loading — wallet connected but still checking ownership
  if (walletStatus === 'loading_nfts') {
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spinner large />
          <div style={{
            marginTop: 20,
            color: 'rgba(255,255,254,0.5)',
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 14,
          }}>
            Checking your SCHIZODIO collection…
          </div>
        </div>
      </LobbyWrapper>
    );
  }

  // NFT gate — logged in but holds no SCHIZODIO
  if (walletStatus === 'ready' && ownedNFTs.length === 0) {
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🪬</div>
          <div style={{
            color: '#FFFFFE',
            fontFamily: "'Space Grotesk', sans-serif",
            fontWeight: 800,
            fontSize: 22,
            marginBottom: 12,
          }}>
            You need to be SCHIZO to play this
          </div>
          <div style={{
            color: 'rgba(255,255,254,0.4)',
            fontSize: 13,
            lineHeight: 1.6,
            maxWidth: 300,
            margin: '0 auto 20px',
          }}>
            Online mode is exclusive to SCHIZODIO NFT holders.
            Get your SCHIZODIO to join the game.
          </div>
          <div style={{
            fontSize: 11, fontStyle: 'italic', color: 'rgba(232,164,68,0.6)',
            marginBottom: 28, maxWidth: 280, margin: '0 auto 28px'
          }}>
            "rarer traits might be more expensive, but less provable to be found!"
          </div>
          <motion.a
            href="https://schizodio.art/"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            style={{
              display: 'inline-block',
              background: 'linear-gradient(135deg, #E8A444, #C47B1A)',
              borderRadius: 12,
              padding: '12px 28px',
              color: '#0F0E17',
              fontFamily: "'Space Grotesk', sans-serif",
              fontWeight: 700,
              fontSize: 14,
              textDecoration: 'none',
              boxShadow: '0 0 24px rgba(232,164,68,0.3)',
            }}
          >
            Get SCHIZODIO →
          </motion.a>
        </div>
      </LobbyWrapper>
    );
  }

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const characters = await generateAllCollectionCharacters();
      const { game, playerNum } = await createGame(walletAddress, characters);
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum, walletAddress);
      // Both P1 and P2 go through character select immediately.
      // Room code is prominently shown in OnlineWaitingScreen after selection.
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!roomCodeInput.trim()) {
      setError('Enter a room code');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { game, playerNum } = await joinGame(roomCodeInput, walletAddress);
      // Always use the deterministic 999-token collection (same as creator)
      const characters = await generateAllCollectionCharacters();
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum, walletAddress);
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (view === 'home') return onBack();
    setView('home');
  };

  return (
    <LobbyWrapper onBack={handleBack} title="Play Online">
      <AnimatePresence mode="wait">

        {view === 'home' && (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 420, margin: '0 auto', width: '100%' }}
          >
            <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.4)', textAlign: 'center', lineHeight: 1.6, marginBottom: 8 }}>
              SCHIZODIO Collection · 999 characters · Classic 1v1
            </div>

            {error && <ErrorMsg>{error}</ErrorMsg>}

            <Button variant="accent" size="lg" onClick={handleCreate} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating…' : 'Create Room'}
            </Button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 12,
              color: 'rgba(255,255,254,0.25)', fontSize: 12, fontWeight: 600,
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
              OR
              <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <button
              onClick={() => setView('join')}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 12,
                padding: '14px 24px',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                cursor: 'pointer',
                width: '100%',
              }}
            >
              Join Room
            </button>
          </motion.div>
        )}

        {view === 'join' && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: 420, margin: '0 auto', width: '100%' }}
          >
            <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.5)', textAlign: 'center' }}>
              Enter the 6-character room code from your opponent.
            </div>
            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              maxLength={6}
              placeholder="XXXXXX"
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '14px 20px',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.2em',
                textAlign: 'center',
                width: '100%',
                outline: 'none',
                textTransform: 'uppercase',
              }}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <Button
              variant="accent"
              size="lg"
              onClick={handleJoin}
              disabled={loading || roomCodeInput.length < 4}
              style={{ width: '100%' }}
            >
              {loading ? 'Joining…' : 'Join Game'}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </LobbyWrapper>
  );
}

function LobbyWrapper({ children, onBack, title = 'Play Online' }: { children: React.ReactNode; onBack: () => void; title?: string }) {
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
            ← Back
          </button>
          <h2 style={{ 
            fontFamily: "'Space Grotesk', sans-serif", 
            fontSize: 32, 
            fontWeight: 800, 
            color: '#FFFFFE', 
            margin: 0,
            letterSpacing: '-0.02em'
          }}>
            {title}
          </h2>
        </div>
        
        {children}
      </div>
    </motion.div>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const size = large ? 36 : 16;
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
      style={{
        width: size, height: size,
        border: `${large ? 3 : 2}px solid rgba(255,255,255,0.15)`,
        borderTopColor: large ? '#E8A444' : 'rgba(255,255,255,0.8)',
        borderRadius: '50%',
        margin: large ? '0 auto' : undefined,
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

