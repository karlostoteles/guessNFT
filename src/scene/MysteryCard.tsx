import { useRef } from 'react';
import * as THREE from 'three';
import { useActivePlayer, usePlayerState } from '../store/selectors';
import { BOARD } from '../utils/constants';

interface MysteryCardProps {
  textures: Map<string, THREE.CanvasTexture>;
  cardBackTexture: THREE.CanvasTexture;
}

function makeLabel(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.font = 'bold 28px Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#E8A444';
  ctx.fillText('YOUR PICK', 128, 32);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function MysteryCard({ textures, cardBackTexture }: MysteryCardProps) {
  const activePlayer = useActivePlayer();
  const playerState = usePlayerState(activePlayer);
  const secretId = playerState.secretCharacterId;
  const secretTexture = secretId ? textures.get(secretId) : null;
  const labelTex = useRef<THREE.CanvasTexture | null>(null);
  if (!labelTex.current) labelTex.current = makeLabel();

  const cardWidth = 1.8;
  const cardHeight = 2.4;

  return (
    <group position={[0, BOARD.height / 2 + 0.02, BOARD.depth / 2 - 0.5]} rotation={[-0.3, 0, 0]}>
      {/* Card body */}
      <mesh>
        <boxGeometry args={[cardWidth, cardHeight, 0.05]} />
        <meshStandardMaterial color="#1a1a2e" roughness={0.5} />
      </mesh>

      {/* Front face */}
      <mesh position={[0, 0, 0.026]}>
        <planeGeometry args={[cardWidth - 0.15, cardHeight - 0.2]} />
        <meshStandardMaterial
          map={secretTexture || cardBackTexture}
          roughness={0.5}
        />
      </mesh>

      {/* Back face */}
      <mesh position={[0, 0, -0.026]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[cardWidth - 0.15, cardHeight - 0.2]} />
        <meshStandardMaterial map={cardBackTexture} roughness={0.5} />
      </mesh>

      {/* Label */}
      <mesh position={[0, -cardHeight / 2 - 0.2, 0]}>
        <planeGeometry args={[1.4, 0.35]} />
        <meshBasicMaterial map={labelTex.current} transparent depthWrite={false} />
      </mesh>
    </group>
  );
}
