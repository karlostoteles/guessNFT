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
import { useWalletConnection } from '@/services/starknet';
import { sfx } from '@/shared/audio/sfx';
import { createGame, joinGame } from '@/services/supabase/gameService';
import { isSupabaseConfigured } from '@/services/supabase/client';
import { useGameActions } from '@/core/store/selectors';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { useGameStore } from '@/core/store/gameStore';
import { createGameOnChain, joinGameOnChain } from '@/zk/useZKAnswer';
import { WalletConnectOverlay } from '../widgets/WalletConnectOverlay';

interface Props {
  onBack: () => void;
}

type LobbyView = 'collection_select' | 'mode_select' | 'choice' | 'create' | 'join';

export function OnlineLobbyScreen({ onBack }: Props) {
  const [view, setView] = useState<LobbyView>('collection_select');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showWalletOverlay, setShowWalletOverlay] = useState(false);

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
            onClick={() => { sfx.click(); setShowWalletOverlay(true); }}
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

  const handleCreate = async (subMode: 'normal' | 'betting') => {
    setError('');
    setLoading(true);
    try {
      const characters = await generateAllCollectionCharacters();

      // 1. Create game on-chain using Gian's ZK engine (correct event extraction)
      let gameIdFelt: string;
      try {
        gameIdFelt = await createGameOnChain();
      } catch (chainErr: any) {
        if (chainErr.message === 'YOUR_ACCOUNT_UPGRADE_REQUIRED') {
          if (confirm('Your account is too old for gasless play. Continue by paying gas yourself?')) {
            window.location.search += (window.location.search ? '&' : '?') + 'user_pays=true';
            return;
          }
        }
        throw new Error(`Blockchain creation failed: ${chainErr.message || 'Check your wallet'}`);
      }

      // 2. Sync with Supabase
      const { game, playerNum } = await createGame(walletAddress, characters, gameIdFelt);
      
      // setOnlineGame stores both the Supabase UUID (onlineGameId) and the felt ID
      // (starknetGameId). gameSessionId is set to the felt so localStorage commitments
      // are keyed by the on-chain game ID.
      setOnlineGame(game.id, game.room_code, playerNum, walletAddress, subMode, gameIdFelt);
      useGameStore.setState({ gameSessionId: gameIdFelt });

      setGameMode('online', characters);
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
      const characters = await generateAllCollectionCharacters();

      // Use the onchain_id stored in Supabase (if available), fallback to UUID formatting if legacy
      const gameIdFelt = game.onchain_id || ('0x' + game.id.replace(/-/g, ''));

      // Join on-chain — this transitions the contract from WAITING_FOR_PLAYER2 → COMMIT_PHASE.
      // Torii will detect COMMIT_PHASE and trigger commitment for both players.
      await joinGameOnChain(gameIdFelt);

      const subMode = (game as any).is_betting ? 'betting' : 'normal';

      setOnlineGame(game.id, game.room_code, playerNum, walletAddress, subMode, gameIdFelt);
      useGameStore.setState({ gameSessionId: gameIdFelt });

      setGameMode('online', characters);
      startSetup();
    } catch (err: any) {
      setError(err.message ?? 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (view === 'collection_select') return onBack();
    if (view === 'mode_select') return setView('collection_select');
    if (view === 'choice') return setView('mode_select');
    setView('choice');
  };

  return (
    <LobbyWrapper onBack={handleBack} title={view === 'collection_select' ? 'Choose collection' : 'Select Mode'}>
      <WalletConnectOverlay 
        isOpen={showWalletOverlay}
        onClose={() => setShowWalletOverlay(false)}
        onSelect={(type) => { setShowWalletOverlay(false); connectWallet(type); }}
        isConnecting={isConnecting}
      />
      <AnimatePresence mode="wait">

        {view === 'collection_select' && (
          <motion.div
            key="collection_select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            style={{ 
              display: 'flex', 
              flexWrap: 'wrap',
              justifyContent: 'center',
              gap: 24,
              width: '100%',
              maxWidth: 1000
            }}
          >
            <CollectionCard 
              name="SCHIZODIO"
              image="/vs_background.jpg"
              count={999}
              rarity="Extreme"
              scarcity="1:100"
              accentRgb="232,164,68"
              onClick={() => setView('mode_select')}
            />

            <CollectionCard 
              name="DUCKS"
              image="/images/practice-bg.jpg"
              count={500}
              rarity="High"
              scarcity="1:50"
              disabled
              accentRgb="251,191,36"
            />
            
            <CollectionCard 
              name="BLOBERT"
              image="/ai_background.jpg"
              count={10000}
              rarity="Magical"
              scarcity="1:1000"
              disabled
              accentRgb="167,139,250"
            />
          </motion.div>
        )}

        {view === 'mode_select' && (
          <motion.div
            key="mode_select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: 32,
              width: '100%',
              maxWidth: 600,
              margin: '0 auto'
            }}
          >
            <div style={{ display: 'flex', gap: 20 }}>
              <ModeButton
                title="Normal"
                subtitle="Pure Strategy PvP"
                tag="FAST"
                icon="⚔️"
                accentRgb="232,164,68"
                onClick={() => handleCreate('normal')}
                disabled={loading}
              />

              <ModeButton
                title="SCHIZO"
                subtitle="Bet your SCHIZODIO"
                tag="HARDCORE"
                icon="🔥"
                accentRgb="239,68,68"
                onClick={() => handleCreate('betting')}
                disabled={loading}
              />
            </div>

            <div style={{ 
              height: 1, 
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              width: '100%' 
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center' }}>
              <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.4)', fontWeight: 600, letterSpacing: '0.1em' }}>
                OR JOIN EXISTING ROOM
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <input
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                  maxLength={6}
                  placeholder="CODE"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12,
                    padding: '12px 20px',
                    color: '#FFFFFE',
                    fontFamily: "'Space Grotesk', monospace",
                    fontSize: 20,
                    fontWeight: 700,
                    textAlign: 'center',
                    flex: 1,
                    outline: 'none',
                  }}
                />
                <Button
                  variant="accent"
                  size="lg"
                  onClick={handleJoin}
                  disabled={loading || roomCodeInput.length < 4}
                  style={{ minWidth: 140 }}
                >
                  {loading ? 'Joining…' : 'Join Game'}
                </Button>
              </div>
              {error && <ErrorMsg>{error}</ErrorMsg>}
            </div>
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

// ─── Sub-components ─────────────────────────────────────────────────────────

function CollectionCard({ name, image, count, rarity, scarcity, onClick, disabled, accentRgb }: {
  name: string;
  image: string;
  count: number;
  rarity: string;
  scarcity: string;
  onClick?: () => void;
  disabled?: boolean;
  accentRgb: string;
}) {
  return (
    <motion.button
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { y: -8, scale: 1.02 }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        position: 'relative',
        height: 420,
        borderRadius: 32,
        overflow: 'hidden',
        border: `1px solid ${disabled ? 'rgba(255,255,255,0.05)' : `rgba(${accentRgb}, 0.2)`}`,
        background: '#0F0E17',
        cursor: disabled ? 'not-allowed' : 'pointer',
        textAlign: 'left',
        padding: 0,
        display: 'flex',
        flexDirection: 'column',
        opacity: disabled ? 0.5 : 1,
        boxShadow: disabled ? 'none' : `0 20px 40px rgba(0,0,0,0.4), 0 0 40px rgba(${accentRgb}, 0.1)`,
      }}
    >
      {/* Background Image */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: `url(${image})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: disabled ? 'grayscale(1) brightness(0.2)' : 'brightness(0.6)',
        zIndex: 0,
        transition: 'all 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
      }} />

      {/* Label Badge */}
      <div style={{ 
        position: 'absolute', top: 20, left: 20, zIndex: 3,
        padding: '6px 14px', borderRadius: 12,
        background: `rgba(${accentRgb}, 0.15)`,
        border: `1px solid rgba(${accentRgb}, 0.3)`,
        backdropFilter: 'blur(8px)',
        color: `rgba(${accentRgb}, 1)`,
        fontSize: 11, fontWeight: 800, letterSpacing: '0.05em',
        textTransform: 'uppercase'
      }}>
        {name} COLLECTION
      </div>
      
      {/* Gradient Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        background: `linear-gradient(180deg, transparent 0%, rgba(15,14,23,0.3) 50%, rgba(15,14,23,0.9) 100%)`,
        zIndex: 1,
      }} />

      {/* Content */}
      <div style={{ marginTop: 'auto', position: 'relative', zIndex: 2, padding: 32, width: '100%' }}>
        <h3 style={{ 
          fontSize: 32, fontWeight: 900, color: '#FFFFFE', 
          fontFamily: "'Space Grotesk', sans-serif", margin: '0 0 20px 0',
          letterSpacing: '-0.02em'
        }}>
          {name}
        </h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
          <Stat label="Collection Size" value={count} />
          <Stat label="Trait Scarcity" value={scarcity} />
          <Stat label="Rarity Tier" value={rarity} />
          {disabled ? (
            <div style={{ 
              background: 'rgba(255,255,255,0.05)', 
              borderRadius: 8, padding: '4px 10px',
              fontSize: 10, fontWeight: 800, color: 'rgba(255,255,254,0.3)',
              alignSelf: 'center', textAlign: 'center'
            }}>COMING SOON</div>
          ) : (
            <div style={{ 
              background: `rgba(${accentRgb}, 0.1)`, 
              borderRadius: 8, padding: '4px 10px',
              fontSize: 10, fontWeight: 800, color: `rgba(${accentRgb}, 1)`,
              alignSelf: 'center', textAlign: 'center',
              border: `1px solid rgba(${accentRgb}, 0.2)`
            }}>PLAYABLE</div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

function ModeButton({ title, subtitle, tag, icon, accentRgb, onClick, disabled }: {
  title: string;
  subtitle: string;
  tag: string;
  icon: string;
  accentRgb: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? {} : { scale: 1.02, background: `rgba(${accentRgb}, 0.1)` }}
      whileTap={disabled ? {} : { scale: 0.98 }}
      style={{
        background: `rgba(${accentRgb}, 0.05)`,
        border: `1.5px solid rgba(${accentRgb}, 0.2)`,
        borderRadius: 24,
        padding: '24px 32px',
        color: '#FFFFFE',
        fontFamily: "'Space Grotesk', sans-serif",
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        textAlign: 'left',
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 24,
        position: 'relative',
        opacity: disabled ? 0.6 : 1,
        transition: 'all 0.3s ease',
        boxShadow: disabled ? 'none' : `0 0 30px rgba(${accentRgb}, 0.05)`
      }}
    >
      <div style={{ 
        width: 64, height: 64, borderRadius: 16, 
        background: `rgba(${accentRgb}, 0.1)`, 
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 32, border: `1px solid rgba(${accentRgb}, 0.2)`
      }}>
        {icon}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>{title}</div>
          <div style={{ 
            fontSize: 10, fontWeight: 800, 
            background: tag === 'SOON' ? '#0F0E17' : `rgba(${accentRgb}, 0.2)`, 
            color: tag === 'SOON' ? 'rgba(255,255,254,0.4)' : '#FFFFFE',
            padding: '4px 10px', borderRadius: 8,
            border: tag === 'SOON' ? '1px solid rgba(255,255,255,0.1)' : 'none',
            letterSpacing: '0.05em'
          }}>
            {tag}
          </div>
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,254,0.5)', lineHeight: 1.4 }}>
          {subtitle}
        </div>
      </div>

      {!disabled && (
        <div style={{ fontSize: 20, opacity: 0.3 }}>→</div>
      )}
    </motion.button>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,254,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 800, color: '#FFFFFE', fontFamily: "'Space Grotesk', sans-serif" }}>{value}</div>
    </div>
  );
}
