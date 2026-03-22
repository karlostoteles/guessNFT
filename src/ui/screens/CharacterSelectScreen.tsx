import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '../common/Card';
import { useCharacterPreviews } from '@/shared/hooks/useCharacterPreviews';
import { usePhase, useGameActions, useGameCharacters, useGameMode, useOnlinePlayerNum, useGameSessionId, useOnlineGameId } from '@/core/store/selectors';
import { GamePhase, PlayerId } from '@/core/store/types';
import { useOwnedNFTs } from '@/services/starknet/walletStore';
import { getCommitment, submitCommitmentOnChain } from '@/services/starknet/commitReveal';

// Deterministic accent colour from character id
function idToColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xfffff;
  }
  const hue = (h * 137.508) % 360;
  return `hsl(${hue.toFixed(0)}, 65%, 42%)`;
}

export function CharacterSelectScreen() {
  const phase = usePhase();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const { selectSecretCharacter, resetGame, goBackToSetupP1 } = useGameActions();
  const gameSessionId = useGameSessionId();
  const onlineGameId = useOnlineGameId();
  const [lockingIn, setLockingIn] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  // All game characters (full 999-stub board for nft/online, meme chars for free)
  const allCharacters = useGameCharacters();
  // Owned NFTs from wallet — these have real imageUrls
  const ownedNFTs = useOwnedNFTs();
  const isNFTMode = mode === 'online' || mode === 'nft' || mode === 'nft-free';

  // The player this screen is selecting for
  const player: PlayerId =
    mode === 'online'
      ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
      : (phase === GamePhase.SETUP_P1 ? 'player1' : 'player2');

  const playerLabel =
    mode === 'online'
      ? 'Your Character'
      : player === 'player1' ? 'Player 1' : 'Player 2';

  // Build the selectable character list for NFT modes.
  // CRITICAL: Use the board's character objects (allCharacters) as the single source of
  // truth for traits. Owned NFTs are only used to filter which characters can be selected
  // and to provide imageUrl for display. This ensures the selected secret character has
  // the exact same traits as its board counterpart (both derived from schizodio.json bitmap).
  const nftModeChars = useMemo(() => {
    if (!isNFTMode) return null;

    // Build a map of tokenId → imageUrl from owned NFTs
    const imageMap = new Map(ownedNFTs.map(nft => [`nft_${nft.tokenId}`, nft.imageUrl]));

    if (ownedNFTs.length > 0) {
      // Player owns NFTs — show only owned ones (enriched with real images)
      const ownedIds = new Set(ownedNFTs.map(nft => `nft_${nft.tokenId}`));
      return allCharacters
        .filter(c => ownedIds.has(c.id))
        .map(c => ({
          ...c,
          imageUrl: imageMap.get(c.id) || (c as any).imageUrl,
          tokenId: c.id.replace('nft_', ''),
        }));
    }

    // No owned NFTs — show full board for random pick (online/nft-free modes)
    if (mode === 'online' || mode === 'nft-free') {
      return allCharacters.map(c => ({
        ...c,
        tokenId: c.id.replace('nft_', ''),
      }));
    }

    return null;
  }, [isNFTMode, ownedNFTs, allCharacters, mode]);

  // For free mode: use allCharacters (meme chars) with canvas previews
  const freeModeChars = !isNFTMode ? allCharacters : null;
  const previews = useCharacterPreviews();

  // The display list for selection
  const displayChars = nftModeChars ?? freeModeChars ?? allCharacters;
  const isLarge = displayChars.length > 50;

  const [search, setSearch] = useState('');

  const filteredChars = useMemo(() => {
    if (!search.trim()) return displayChars;
    const s = search.trim().toLowerCase().replace(/[^0-9a-z#]/g, '');
    return displayChars.filter((c) => {
      const id = c.id.toLowerCase();
      const name = c.name.toLowerCase().replace(/[^0-9a-z#]/g, '');
      return id.includes(s) || name.includes(s);
    });
  }, [displayChars, search]);

  // ── Character Lock-In Flow ───────────────────────────────────────────────
  const handleSelect = async (charId: string, tokenId?: string) => {
    if (lockingIn) return;
    try {
      setLockingIn(charId);

      // Update local storage commitment first so it's ready.
      selectSecretCharacter(player, charId);

      const session = gameSessionId;
      // For on-chain commit, use the shared Supabase game ID in online mode
      // so both players' commitments are indexed by the same key.
      const onChainGameId = (mode === 'online' && onlineGameId) ? onlineGameId : session;

      // On-chain commit is Phase 2 — skip for online MVP to avoid blocking wallet popup.
      // Only fire for local NFT mode (pass-and-play with owned NFTs).
      if (mode === 'nft' && ownedNFTs.length > 0) {
        const stored = getCommitment(player, session);
        if (stored) {
          try {
            await submitCommitmentOnChain(stored.commitment, onChainGameId);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
          } catch (commitErr: any) {
            console.warn('[commitReveal] On-chain commit failed, continuing:', commitErr.message);
          }
        }
      }

    } catch (err: any) {
      console.error(err);
      alert('Failed to lock in character: ' + err.message);
      // Revert phase on failure if necessary, but MVP can just alert
    } finally {
      // The phase advances globally so this component unmounts,
      // but clear anyway if it failed.
      setLockingIn(null);
    }
  };

  // ── Character picker (owned NFTs for nft/online, meme chars for free) ─────
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
        padding: '16px',
      }}
    >
      <Card style={{
        width: 'min(760px, 100%)',
        maxHeight: 'calc(100vh - 32px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ position: 'relative', textAlign: 'center', marginBottom: 16, flexShrink: 0 }}>
          {/* Back button */}
          <motion.button
            onClick={() => {
              if (phase === GamePhase.SETUP_P2) goBackToSetupP1();
              else resetGame();
            }}
            whileHover={{ scale: 1.06, background: 'rgba(255,255,255,0.1)' }}
            whileTap={{ scale: 0.94 }}
            style={{
              position: 'absolute',
              left: 4, top: 4,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, padding: '6px 14px',
              cursor: 'pointer', outline: 'none',
              color: 'rgba(255,255,254,0.55)',
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 12, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ← Back
          </motion.button>

          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 'clamp(20px, 4vw, 26px)',
            fontWeight: 800,
            color: player === 'player1' ? '#E8A444' : '#44A8E8',
            marginBottom: 6,
          }}>
            {playerLabel}
          </div>
          <div style={{ fontSize: 13, color: 'rgba(255,255,254,0.45)' }}>
            {isNFTMode
              ? `Choose your secret SCHIZODIO${ownedNFTs.length > 0 ? ` · ${ownedNFTs.length} in your wallet` : ''}`
              : 'Choose your secret character'
            }
          </div>
        </div>

        {/* Random Pick — prominent shortcut for online/nft-free */}
        {(mode === 'online' || mode === 'nft-free') && (
          <div style={{ flexShrink: 0, marginBottom: 8 }}>
            <motion.button
              onClick={() => {
                const pool = displayChars;
                if (pool.length === 0) return;
                const pick = pool[Math.floor(Math.random() * pool.length)];
                handleSelect(pick.id, (pick as any).tokenId);
              }}
              disabled={!!lockingIn}
              whileHover={!lockingIn ? { scale: 1.02 } : {}}
              whileTap={!lockingIn ? { scale: 0.98 } : {}}
              style={{
                width: '100%',
                padding: '12px 20px',
                background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(91,33,182,0.2))',
                border: '1px solid rgba(124,58,237,0.4)',
                borderRadius: 10,
                color: '#A78BFA',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 15,
                fontWeight: 700,
                cursor: lockingIn ? 'wait' : 'pointer',
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                opacity: lockingIn ? 0.5 : 1,
              }}
            >
              &#x1F3B2; Random Pick
            </motion.button>
          </div>
        )}

        {/* Search (only for large collections) */}
        {isLarge && (
          <div style={{ marginBottom: 14, flexShrink: 0 }}>
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by # or token number…"
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 10,
                padding: '10px 14px',
                color: '#FFFFFE',
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 14,
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            {search && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'rgba(255,255,254,0.35)', textAlign: 'right' }}>
                {filteredChars.length} results
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isNFTMode && ownedNFTs.length > 0
              ? 'repeat(auto-fill, minmax(140px, 1fr))'
              : 'repeat(auto-fill, minmax(82px, 1fr))',
            gap: isNFTMode && ownedNFTs.length > 0 ? 12 : 8,
            padding: '2px 2px 8px',
          }}>
            {filteredChars.map((char) => {
              // Prefer the char's own imageUrl (owned NFTs have this populated)
              const imgSrc = (char as any).imageUrl || previews.get(char.id);
              return (
                <CharacterCard
                  key={char.id}
                  char={char}
                  previewSrc={imgSrc}
                  accentColor={idToColor(char.id)}
                  large={isNFTMode && ownedNFTs.length > 0}
                  onSelect={() => handleSelect(char.id, (char as any).tokenId)}
                  isLocking={lockingIn === char.id}
                  isDisabled={!!lockingIn && lockingIn !== char.id}
                />
              );
            })}
          </div>

          {filteredChars.length === 0 && (
            <div style={{
              textAlign: 'center', padding: '40px 0',
              color: 'rgba(255,255,254,0.3)', fontSize: 14,
            }}>
              {search ? `No tokens match "${search}"` : 'No characters available'}
            </div>
          )}
        </div>

        {/* Success toast after on-chain commit */}
        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -10 }}
              transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
                zIndex: 30,
              }}
            >
              <div style={{
                background: 'rgba(15,14,23,0.95)',
                border: '2px solid rgba(76,175,80,0.6)',
                borderRadius: 16,
                padding: '20px 32px',
                textAlign: 'center',
                boxShadow: '0 12px 40px rgba(0,0,0,0.6), 0 0 20px rgba(76,175,80,0.2)',
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>&#x2713;</div>
                <div style={{
                  fontFamily: "'Space Grotesk', sans-serif",
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#4CAF50',
                }}>
                  Character Locked &amp; Committed!
                </div>
                <div style={{
                  fontSize: 12,
                  color: 'rgba(255,255,254,0.4)',
                  marginTop: 4,
                }}>
                  On-chain commitment submitted
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}

// ── Per-card component ──────────────────────────────────────────────────────────

interface CharacterCardProps {
  char: { id: string; name: string;[key: string]: any };
  previewSrc: string | undefined;
  accentColor: string;
  large?: boolean;
  onSelect: () => void;
  isLocking?: boolean;
  isDisabled?: boolean;
}

function CharacterCard({ char, previewSrc, accentColor, large, onSelect, isLocking, isDisabled }: CharacterCardProps) {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const src = previewSrc && !imgError ? previewSrc : undefined;

  return (
    <motion.button
      onClick={onSelect}
      disabled={isDisabled || isLocking}
      onMouseEnter={() => !isDisabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      whileHover={!isDisabled && !isLocking ? { scale: 1.06 } : {}}
      whileTap={!isDisabled && !isLocking ? { scale: 0.95 } : {}}
      style={{
        opacity: isDisabled ? 0.4 : 1,
        background: hovered
          ? 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(91,33,182,0.15))'
          : 'rgba(255,255,255,0.05)',
        border: `2px solid ${hovered ? 'rgba(124,58,237,0.6)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 10,
        padding: large ? 0 : 5,
        cursor: 'pointer',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: large ? 0 : 4,
        overflow: 'hidden',
        transition: 'background 0.2s, border-color 0.2s, box-shadow 0.2s',
        boxShadow: hovered ? '0 0 20px rgba(124,58,237,0.2)' : 'none',
      }}
    >
      <div style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: large ? 0 : 6,
        overflow: 'hidden',
        background: src ? 'rgba(255,255,255,0.06)' : accentColor,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {src ? (
          <img
            src={src}
            alt={char.name}
            onError={() => setImgError(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover', display: 'block',
              filter: hovered ? 'brightness(1.1)' : 'brightness(1)',
              transform: hovered ? 'scale(1.05)' : 'scale(1)',
              transition: 'filter 0.2s, transform 0.3s',
            }}
          />
        ) : (
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: large ? 13 : 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.6)',
            padding: 4,
            textAlign: 'center',
          }}>
            {char.name}
          </span>
        )}

        {/* Loading Spinner */}
        <AnimatePresence>
          {isLocking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 2,
              }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                style={{
                  width: 24, height: 24,
                  border: '3px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#E8A444',
                  borderRadius: '50%',
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover shimmer */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(135deg, rgba(124,58,237,0.12), transparent)',
                pointerEvents: 'none',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      <div style={{ padding: large ? '8px 10px' : '0 2px 2px', width: '100%' }}>
        <span style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: large ? 12 : 10,
          fontWeight: large ? 700 : 600,
          color: hovered ? '#A78BFA' : '#FFFFFE',
          maxWidth: '100%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          display: 'block',
          transition: 'color 0.2s',
        }}>
          {char.name}
        </span>
        {large && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,254,0.3)', marginTop: 2 }}>
            #{(char as any).tokenId ?? char.id.replace('nft_', '')}
          </div>
        )}
      </div>
    </motion.button>
  );
}
