import { motion } from 'framer-motion';
import { Card } from './common/Card';
import { useCharacterPreviews } from '../hooks/useCharacterPreviews';
import { usePhase, useGameActions, useGameCharacters, useGameMode, useOnlinePlayerNum } from '../store/selectors';
import { GamePhase, PlayerId } from '../store/types';
import { useOwnedNFTs } from '../starknet/walletStore';
import { nftToCharacter } from '../data/nftCharacterAdapter';

export function CharacterSelectScreen() {
  const phase = usePhase();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();
  const { selectSecretCharacter } = useGameActions();
  const ownedNFTs = useOwnedNFTs();
  const gameCharacters = useGameCharacters();

  // In online mode each player picks only from their own NFTs
  const characters = mode === 'online' && ownedNFTs.length > 0
    ? ownedNFTs.map(nftToCharacter)
    : gameCharacters;

  const previews = useCharacterPreviews();

  // In online mode, I always select for my own seat regardless of phase
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
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto',
        zIndex: 20,
      }}
    >
      <Card style={{
        width: 'min(700px, calc(100vw - 32px))',
        maxHeight: 'calc(100vh - 48px)',
        overflowY: 'auto',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            fontFamily: "'Space Grotesk', sans-serif",
            fontSize: 28,
            fontWeight: 800,
            color: player === 'player1' ? '#E8A444' : '#44A8E8',
            marginBottom: 8,
          }}>
            {playerLabel}
          </div>
          <div style={{
            fontSize: 15,
            color: 'rgba(255,255,254,0.5)',
          }}>
            Choose your secret character
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
          gap: 10,
        }}>
          {characters.map((char) => (
            <motion.button
              key={char.id}
              onClick={() => selectSecretCharacter(player, char.id)}
              whileHover={{ scale: 1.08, borderColor: 'rgba(232,164,68,0.5)' }}
              whileTap={{ scale: 0.95 }}
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '2px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: 6,
                cursor: 'pointer',
                outline: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <img
                src={previews.get(char.id)}
                alt={char.name}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  borderRadius: 6,
                  objectFit: 'cover',
                }}
              />
              <span style={{
                fontFamily: "'Space Grotesk', sans-serif",
                fontSize: 11,
                fontWeight: 600,
                color: '#FFFFFE',
              }}>
                {char.name}
              </span>
            </motion.button>
          ))}
        </div>
      </Card>
    </motion.div>
  );
}
