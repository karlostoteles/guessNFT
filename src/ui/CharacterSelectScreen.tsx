import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { useCharacterPreviews } from '../hooks/useCharacterPreviews';
import { usePhase, useGameActions, useGameCharacters, useGameMode, useOnlinePlayerNum } from '../store/selectors';
import { GamePhase, PlayerId } from '../store/types';

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
  const phase           = usePhase();
  const mode            = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const { selectSecretCharacter } = useGameActions();

  const characters = useGameCharacters();
  const previews   = useCharacterPreviews();
  const isLarge    = characters.length > 50;

  const [search, setSearch] = useState('');

  const filteredChars = useMemo(() => {
    if (!search.trim()) return characters;
    const s = search.trim().toLowerCase().replace(/[^0-9a-z#]/g, '');
    return characters.filter((c) => {
      const id   = c.id.toLowerCase();
      const name = c.name.toLowerCase().replace(/[^0-9a-z#]/g, '');
      return id.includes(s) || name.includes(s);
    });
  }, [characters, search]);

  // In online mode, always select for my own seat regardless of phase
  const player: PlayerId =
    mode === 'online'
      ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
      : (phase === GamePhase.SETUP_P1 ? 'player1' : 'player2');

  const playerLabel =
    mode === 'online'
      ? 'Your Character'
      : player === 'player1' ? 'Player 1' : 'Player 2';

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
      }}
    >
      <Card style={{
        width: 'min(760px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16, flexShrink: 0 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 26,
            fontWeight: 800,
            color: player === 'player1' ? '#E8A444' : '#44A8E8',
            marginBottom: 6,
          }}>
            {playerLabel}
          </div>
          <div style={{ fontSize: 14, color: 'rgba(255,255,254,0.45)' }}>
            Choose your secret SCHIZODIO
            {isLarge && (
              <span style={{ marginLeft: 8, color: 'rgba(255,255,254,0.3)', fontSize: 12 }}>
                ({characters.length} tokens)
              </span>
            )}
          </div>
        </div>

        {/* Search (only shown for large collections) */}
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
              <div style={{
                marginTop: 6,
                fontSize: 12,
                color: 'rgba(255,255,254,0.35)',
                textAlign: 'right',
              }}>
                {filteredChars.length} results
              </div>
            )}
          </div>
        )}

        {/* Grid */}
        <div style={{ overflowY: 'auto', flexGrow: 1 }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(82px, 1fr))',
            gap: 8,
            padding: '2px 2px 8px',
          }}>
            {filteredChars.map((char) => (
              <CharacterCard
                key={char.id}
                char={char}
                previewSrc={previews.get(char.id)}
                accentColor={idToColor(char.id)}
                onSelect={() => selectSecretCharacter(player, char.id)}
              />
            ))}
          </div>

          {filteredChars.length === 0 && (
            <div style={{
              textAlign: 'center',
              padding: '40px 0',
              color: 'rgba(255,255,254,0.3)',
              fontSize: 14,
            }}>
              No tokens match "{search}"
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}

// ── Per-card component ──────────────────────────────────────────────────────────

interface CharacterCardProps {
  char:         { id: string; name: string; [key: string]: any };
  previewSrc:   string | undefined;
  accentColor:  string;
  onSelect:     () => void;
}

function CharacterCard({ char, previewSrc, accentColor, onSelect }: CharacterCardProps) {
  const [imgError, setImgError] = useState(false);
  const realImageUrl: string | undefined = char.imageUrl && !imgError ? char.imageUrl : undefined;
  const src = realImageUrl ?? previewSrc;

  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.08, borderColor: 'rgba(232,164,68,0.55)' }}
      whileTap={{ scale: 0.95 }}
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '2px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: 5,
        cursor: 'pointer',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
      }}
    >
      <div style={{
        width: '100%',
        aspectRatio: '1',
        borderRadius: 6,
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
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          /* Colour swatch fallback — shown for large collections before image loads */
          <span style={{
            fontFamily: "'Space Grotesk', monospace",
            fontSize: 9,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.6)',
          }}>
            {char.name}
          </span>
        )}
      </div>
      <span style={{
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: 10,
        fontWeight: 600,
        color: '#FFFFFE',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {char.name}
      </span>
    </motion.button>
  );
}
