import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Environment } from './Environment';
import { Board } from './Board';
import { CharacterGrid } from './CharacterGrid';
import { MysteryCard } from './MysteryCard';
import { CameraController } from './CameraController';
import { SlotGridOverlay } from './SlotGridOverlay';
import { useCharacterTextures, useCardBackTexture } from '@/shared/hooks/useCharacterTextures';
import { useAdaptiveGrid } from '@/shared/hooks/useAdaptiveGrid';
import { useBoardRotation, useGameCharacters, useOnlinePlayerNum } from '@/core/store/selectors';
import { BOARD } from '@/core/rules/constants';
import { useCPUPlayer } from '@/shared/hooks/useCPUPlayer';

export function GameScene() {
  useCPUPlayer(); // Drive CPU opponent in free mode

  const { layout } = useAdaptiveGrid();
  const characters = useGameCharacters() || [];
  const textures = useCharacterTextures(layout.tileW);
  const cardBackTexture = useCardBackTexture();
  const boardRotation = useBoardRotation();
  const onlinePlayerNum = useOnlinePlayerNum();
  const boardRef = useRef<THREE.Group>(null);

  // P2 sees the board from the opposite side (Y-rotated 180°).
  // That means the X-axis tilt is also perceived in reverse — invert it for P2.
  const tiltAngle = onlinePlayerNum === 2 ? -BOARD.tiltAngle : BOARD.tiltAngle;

  useFrame((_, delta) => {
    if (boardRef.current) {
      const target = boardRotation;
      const current = boardRef.current.rotation.y;
      boardRef.current.rotation.y = current + (target - current) * (1 - Math.pow(0.02, delta));
    }
  });

  return (
    <>
      <CameraController />
      <Environment />

      <group rotation={[tiltAngle, 0, 0]}>
        <group ref={boardRef}>
          <Board width={layout.gridW} depth={layout.gridD} />
          <SlotGridOverlay />
          <CharacterGrid textures={textures} tileW={layout.tileW} />
        </group>
      </group>
    </>
  );
}
