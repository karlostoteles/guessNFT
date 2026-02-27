import * as THREE from 'three';
import { useGameCharacters } from '../store/selectors';
import { TILE, BOARD } from '../utils/constants';
import { CharacterTile } from './CharacterTile';

interface CharacterGridProps {
  textures: Map<string, THREE.CanvasTexture>;
}

export function CharacterGrid({ textures }: CharacterGridProps) {
  const characters = useGameCharacters();
  const totalWidth = TILE.cols * TILE.width + (TILE.cols - 1) * TILE.gap;
  const totalDepth = TILE.rows * TILE.height + (TILE.rows - 1) * TILE.gap;
  const startX = -totalWidth / 2 + TILE.width / 2;
  const startZ = -totalDepth / 2 + TILE.height / 2 - 0.5; // Shift back slightly

  return (
    <group position={[0, BOARD.height / 2 + 0.01, 0]}>
      {characters.map((char, i) => {
        const col = i % TILE.cols;
        const row = Math.floor(i / TILE.cols);
        const x = startX + col * (TILE.width + TILE.gap);
        const z = startZ + row * (TILE.height * 0.5 + TILE.gap);
        const texture = textures.get(char.id);
        if (!texture) return null;

        return (
          <CharacterTile
            key={char.id}
            characterId={char.id}
            characterName={char.name}
            texture={texture}
            position={[x, 0, z]}
          />
        );
      })}
    </group>
  );
}
