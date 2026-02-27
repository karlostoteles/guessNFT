/**
 * OnlineLobbyScreen
 *
 * Create or join an online game room.
 * Shown when user clicks "Play Online" from the main menu.
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from './common/Card';
import { Button } from './common/Button';
import { useWalletAddress } from '../starknet/walletStore';
import { createGame, joinGame, subscribeToGame } from '../supabase/gameService';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { useGameActions } from '../store/selectors';
import { MEME_CHARACTERS } from '../data/memeCharacters';
import { selectGameCharacters } from '../data/nftCharacterAdapter';
import { useOwnedNFTs } from '../starknet/walletStore';

interface Props {
  onBack: () => void;
}

type LobbyView = 'choice' | 'create' | 'join' | 'waiting-p2';

export function OnlineLobbyScreen({ onBack }: Props) {
  const [view, setView] = useState<LobbyView>('choice');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const walletAddress = useWalletAddress();
  const ownedNFTs = useOwnedNFTs();
  const { setGameMode, setOnlineGame, startSetup } = useGameActions();

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
    return (
      <LobbyWrapper onBack={onBack}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,254,0.5)', fontSize: 14, padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔐</div>
          <div style={{ color: '#FFFFFE', marginBottom: 8 }}>Wallet required for online play</div>
          <div>Connect your Starknet wallet from the menu first.</div>
        </div>
      </LobbyWrapper>
    );
  }

  const getCharacters = () => {
    if (ownedNFTs.length > 0) {
      return selectGameCharacters(ownedNFTs, MEME_CHARACTERS);
    }
    return MEME_CHARACTERS;
  };

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const characters = getCharacters();
      const { game, playerNum } = await createGame(walletAddress, characters);
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum);
      setCreatedRoomCode(game.room_code);
      setView('waiting-p2');

      // Subscribe to game updates to detect when P2 joins
      const sub = subscribeToGame(game.id, (updatedGame) => {
        if (updatedGame.status === 'ready' || updatedGame.status === 'in_progress') {
          // P2 joined — kick off the setup phase
          supabase.removeChannel(sub);
          startSetup();
        }
      });
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
      const characters = (game.characters ?? MEME_CHARACTERS) as any[];
      setGameMode('online', characters);
      setOnlineGame(game.id, game.room_code, playerNum);
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  return (
    <LobbyWrapper onBack={view === 'choice' ? onBack : () => setView('choice')}>
      <AnimatePresence mode="wait">
        {view === 'choice' && (
          <motion.div
            key="choice"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <Button
              variant="accent"
              size="lg"
              onClick={() => setView('create')}
              style={{ width: '100%' }}
            >
              Create Room
            </Button>
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

        {view === 'create' && (
          <motion.div
            key="create"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
          >
            <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.5)', textAlign: 'center' }}>
              A room code will be generated. Share it with your opponent.
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <Button
              variant="accent"
              size="lg"
              onClick={handleCreate}
              disabled={loading}
              style={{ width: '100%' }}
            >
              {loading ? 'Creating…' : 'Create Game Room'}
            </Button>
          </motion.div>
        )}

        {view === 'join' && (
          <motion.div
            key="join"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}
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

        {view === 'waiting-p2' && (
          <motion.div
            key="waiting-p2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'center' }}
          >
            <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.5)', textAlign: 'center' }}>
              Share this code with your opponent:
            </div>

            {/* Room code display */}
            <motion.div
              animate={{ scale: [1, 1.02, 1] }}
              transition={{ repeat: Infinity, duration: 2.5 }}
              style={{
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 48,
                fontWeight: 900,
                letterSpacing: '0.3em',
                color: '#E8A444',
                filter: 'drop-shadow(0 0 20px rgba(232,164,68,0.4))',
                background: 'rgba(232,164,68,0.08)',
                border: '2px solid rgba(232,164,68,0.3)',
                borderRadius: 16,
                padding: '20px 36px',
                cursor: 'pointer',
              }}
              onClick={() => {
                navigator.clipboard.writeText(createdRoomCode).catch(() => {});
              }}
              title="Click to copy"
            >
              {createdRoomCode}
            </motion.div>

            <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.3)' }}>
              Click the code to copy · Waiting for opponent…
            </div>

            {/* Pulsing dots */}
            <motion.div style={{ display: 'flex', gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{ repeat: Infinity, duration: 0.8, delay: i * 0.2 }}
                  style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: '#E8A444',
                  }}
                />
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </LobbyWrapper>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <Card style={{ width: 'min(420px, calc(100vw - 32px))' }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: 28,
          gap: 12,
        }}>
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 8,
              color: 'rgba(255,255,254,0.5)',
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 13,
              fontFamily: "'Space Grotesk', sans-serif",
            }}
          >
            ← Back
          </button>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 20,
            fontWeight: 700,
            color: '#FFFFFE',
          }}>
            Play Online
          </div>
        </div>

        {children}
      </Card>
    </motion.div>
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
