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
import { useWalletAddress, useWalletStatus, useOwnedNFTs, useWalletStore } from '../starknet/walletStore';
import { useWalletConnection } from '../starknet/hooks';
import { createGame, joinGame, subscribeToGame } from '../supabase/gameService';
import { isSupabaseConfigured, supabase } from '../supabase/client';
import { useGameActions } from '../store/selectors';
import { MEME_CHARACTERS } from '../data/memeCharacters';
import { selectGameCharacters } from '../data/nftCharacterAdapter';

interface Props {
  onBack: () => void;
}

type LobbyView = 'mode_select' | 'choice' | 'create' | 'join' | 'waiting-p2';

export function OnlineLobbyScreen({ onBack }: Props) {
  const [view, setView] = useState<LobbyView>('mode_select');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createdRoomCode, setCreatedRoomCode] = useState('');
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
            margin: '0 auto 28px',
          }}>
            Online mode is exclusive to SCHIZODIO NFT holders.
            Get your SCHIZODIO to join the game.
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

  // Characters = only the player's own NFTs (mapped to game chars)
  const getCharacters = () => selectGameCharacters(ownedNFTs, MEME_CHARACTERS);

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

  const handleBack = () => {
    if (view === 'mode_select') return onBack();
    if (view === 'choice') return setView('mode_select');
    setView('choice');
  };

  return (
    <LobbyWrapper onBack={handleBack}>
      <AnimatePresence mode="wait">

        {/* ── Mode selection ──────────────────────────────── */}
        {view === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
          >
            <div style={{
              textAlign: 'center',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 13,
              color: 'rgba(255,255,254,0.35)',
              marginBottom: 4,
            }}>
              Choose your game mode
            </div>

            {/* Normal Mode */}
            <motion.button
              onClick={() => setView('choice')}
              whileHover={{ scale: 1.02, borderColor: 'rgba(124,58,237,0.6)' }}
              whileTap={{ scale: 0.98 }}
              style={{
                background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(91,33,182,0.1))',
                border: '1px solid rgba(124,58,237,0.35)',
                borderRadius: 14,
                padding: '18px 20px',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                cursor: 'pointer',
                outline: 'none',
                textAlign: 'left',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 28 }}>🎮</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>
                    Normal Mode
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.45)', lineHeight: 1.4 }}>
                    Classic 1v1 — guess your opponent's SCHIZODIO first
                  </div>
                </div>
              </div>
            </motion.button>

            {/* SCHIZO Mode — coming soon */}
            <div style={{ position: 'relative' }}>
              <motion.button
                disabled
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14,
                  padding: '18px 20px',
                  color: 'rgba(255,255,254,0.35)',
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: 'not-allowed',
                  outline: 'none',
                  textAlign: 'left',
                  width: '100%',
                  opacity: 0.7,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 28 }}>⚔️</span>
                  <div>
                    <div style={{
                      fontWeight: 700,
                      fontSize: 15,
                      marginBottom: 3,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}>
                      SCHIZO Mode
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #E8A444, #C47B1A)',
                        color: '#0F0E17',
                        padding: '2px 7px',
                        borderRadius: 20,
                        letterSpacing: '0.04em',
                      }}>
                        SOON
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.3)', lineHeight: 1.4 }}>
                      Bet your SCHIZODIO NFT — winner takes all
                    </div>
                  </div>
                </div>
              </motion.button>
            </div>
          </motion.div>
        )}

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
