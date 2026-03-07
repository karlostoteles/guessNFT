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
import { useGameActions } from '../store/selectors';
import { GamePhase } from '../store/types';
import { generateAllCollectionCharacters } from '../starknet/collectionService';
import { createGameOnChain, joinGameOnChain } from '../hooks/useZKAnswer';

interface Props {
  onBack: () => void;
}

type LobbyView = 'mode_select' | 'choice' | 'create' | 'join';

export function OnlineLobbyScreen({ onBack }: Props) {
  const [view, setView] = useState<LobbyView>('mode_select');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Access bypass — persisted in localStorage so it survives page refresh
  const [bypassActive, setBypassActive] = useState(
    () => localStorage.getItem('whoiswho_bypass') === '1'
  );
  const [showBypassInput, setShowBypassInput] = useState(false);
  const [bypassInput, setBypassInput]         = useState('');
  const [bypassShake, setBypassShake]         = useState(false);

  const handleBypassSubmit = () => {
    if (btoa(bypassInput.trim()) === btoa('starknethas8users')) {
      localStorage.setItem('whoiswho_bypass', '1');
      setBypassActive(true);
    } else {
      setBypassShake(true);
      setTimeout(() => setBypassShake(false), 600);
      setBypassInput('');
    }
  };

  const walletAddress = useWalletAddress();
  const walletStatus = useWalletStatus();
  const ownedNFTs = useOwnedNFTs();
  const { connectWallet } = useWalletConnection();
  const { setGameMode, setOnlineGame, startSetup, setPhase } = useGameActions();
  const isConnecting = walletStatus === 'connecting' || walletStatus === 'loading_nfts';

  if (!walletAddress) {
    const walletError = useWalletStore.getState().error;
    const isDev = import.meta.env.DEV;

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
            {isDev ? 'DEV — Select Katana Account' : 'Log in to play online'}
          </div>
          <div style={{ color: 'rgba(255,255,254,0.4)', fontSize: 13, marginBottom: 32 }}>
            {isDev
              ? 'Open two tabs — pick P1 in one, P2 in the other'
              : 'Powered by Cartridge Controller — free, no gas needed'}
          </div>

          {isDev ? (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <motion.button
                onClick={() => connectWallet(1)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                  border: '1px solid rgba(124,58,237,0.5)',
                  borderRadius: 12,
                  padding: '14px 28px',
                  color: '#FFFFFE',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 0 20px rgba(124,58,237,0.25)',
                }}
              >
                Player 1
              </motion.button>
              <motion.button
                onClick={() => connectWallet(2)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
                style={{
                  background: 'linear-gradient(135deg, #E8A444, #C47B1A)',
                  border: '1px solid rgba(232,164,68,0.5)',
                  borderRadius: 12,
                  padding: '14px 28px',
                  color: '#0F0E17',
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  outline: 'none',
                  boxShadow: '0 0 20px rgba(232,164,68,0.25)',
                }}
              >
                Player 2
              </motion.button>
            </div>
          ) : (
            <motion.button
              onClick={() => connectWallet()}
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
              {isConnecting ? <><Spinner /> Logging in…</> : 'Log in'}
            </motion.button>
          )}

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

  // NFT gate — logged in but holds no SCHIZODIO (and no bypass)
  if (walletStatus === 'ready' && ownedNFTs.length === 0 && !bypassActive) {
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

          {/* Access code bypass */}
          <div style={{ marginTop: 32 }}>
            {!showBypassInput ? (
              <button
                onClick={() => setShowBypassInput(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'rgba(255,255,254,0.2)',
                  fontSize: 11,
                  fontFamily: "'Space Grotesk', sans-serif",
                  cursor: 'pointer',
                  outline: 'none',
                  textDecoration: 'underline',
                  textDecorationColor: 'rgba(255,255,254,0.1)',
                  letterSpacing: '0.02em',
                }}
              >
                Have an access code?
              </button>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
              >
                <motion.div
                  animate={bypassShake ? { x: [-6, 6, -5, 5, -3, 3, 0], transition: { duration: 0.4 } } : {}}
                  style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 260 }}
                >
                  <input
                    autoFocus
                    value={bypassInput}
                    onChange={(e) => setBypassInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleBypassSubmit()}
                    placeholder="Enter access code"
                    type="password"
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: `1px solid ${bypassShake ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                      borderRadius: 9,
                      padding: '9px 12px',
                      color: '#FFFFFE',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontSize: 13,
                      outline: 'none',
                      transition: 'border-color 0.2s',
                    }}
                  />
                  <motion.button
                    onClick={handleBypassSubmit}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                      background: 'rgba(124,58,237,0.2)',
                      border: '1px solid rgba(124,58,237,0.4)',
                      borderRadius: 9,
                      padding: '9px 14px',
                      color: '#A78BFA',
                      fontFamily: "'Space Grotesk', sans-serif",
                      fontWeight: 600,
                      fontSize: 13,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    Apply
                  </motion.button>
                </motion.div>
                {bypassShake && (
                  <span style={{ fontSize: 11, color: 'rgba(239,68,68,0.7)', fontFamily: "'Space Grotesk', sans-serif" }}>
                    Invalid code
                  </span>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </LobbyWrapper>
    );
  }

  const handleCreate = async () => {
    setError('');
    setLoading(true);
    try {
      const characters = generateAllCollectionCharacters();
      const gameId = await createGameOnChain(1);
      setGameMode('online', characters);
      setOnlineGame(gameId, 1);
      setPhase(GamePhase.ONLINE_WAITING);
    } catch (err: any) {
      setError(err.message ?? 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const gameId = roomCodeInput.trim();
    if (!gameId) {
      setError('Enter a game ID');
      return;
    }
    setError('');
    setLoading(true);
    try {
      // Normalize: accept hex or decimal input
      const normalizedId = gameId.startsWith('0x') ? gameId : `0x${parseInt(gameId, 10).toString(16)}`;
      await joinGameOnChain(normalizedId, 2);
      const characters = generateAllCollectionCharacters();
      setGameMode('online', characters);
      setOnlineGame(normalizedId, 2);
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
                  <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3 }}>Normal Mode</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.45)', lineHeight: 1.4 }}>
                    Classic 1v1 — guess your opponent's SCHIZODIO first
                  </div>
                </div>
              </div>
            </motion.button>

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
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 8 }}>
                      SCHIZO Mode
                      <span style={{ fontSize: 10, fontWeight: 700, background: 'linear-gradient(135deg, #E8A444, #C47B1A)', color: '#0F0E17', padding: '2px 7px', borderRadius: 20, letterSpacing: '0.04em' }}>SOON</span>
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,254,0.3)', lineHeight: 1.4 }}>
                      {bypassActive ? 'Requires a real SCHIZODIO NFT to bet' : 'Bet your SCHIZODIO NFT — winner takes all'}
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
            <Button variant="accent" size="lg" onClick={() => setView('create')} style={{ width: '100%' }}>
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
            <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.5)', textAlign: 'center', lineHeight: 1.6 }}>
              A game will be created on-chain. Your game ID will be shown on the next screen to share with your opponent.
            </div>
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <Button variant="accent" size="lg" onClick={handleCreate} disabled={loading} style={{ width: '100%' }}>
              {loading ? 'Creating…' : 'Create Room & Select Character →'}
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
              Enter the game ID from your opponent.
            </div>
            <input
              value={roomCodeInput}
              onChange={(e) => setRoomCodeInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Game ID"
              autoFocus
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '2px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '14px 20px',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', monospace",
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: '0.05em',
                textAlign: 'center',
                width: '100%',
                outline: 'none',
              }}
            />
            {error && <ErrorMsg>{error}</ErrorMsg>}
            <Button
              variant="accent"
              size="lg"
              onClick={handleJoin}
              disabled={loading || roomCodeInput.trim().length === 0}
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
        padding: 16,
      }}
    >
      <Card style={{ width: 'min(420px, 100%)', maxHeight: 'calc(100vh - 32px)', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28, gap: 12 }}>
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
              flexShrink: 0,
            }}
          >
            ← Back
          </button>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 700, color: '#FFFFFE' }}>
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
