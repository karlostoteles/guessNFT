/**
 * CharacterTile — renders a single character tile at 2 LOD tiers.
 *
 * LOD is determined by `tileW` (world-space width of the tile):
 *
 *   flat  (< 1.0)   plain card front + portrait plane, no depth, click events.
 *   full  (>= 1.0)  3D card with depth + name label + full effects.
 *
 * Position and flip animation are driven by the PARENT CharacterGrid's
 * single useFrame (via group refs).  The `pivotRef` callback lets
 * CharacterGrid store and control the flip group directly.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GamePhase } from '@/core/store/types';
import { usePhase, useActivePlayer, useEliminatedIds, useGameActions } from '@/core/store/selectors';

interface CharacterTileProps {
  characterId: string;
  characterName: string;
  texture: THREE.Texture | undefined;
  tileW: number;
  tileH: number;
  /** Callback so CharacterGrid can control the flip rotation */
  pivotRef: (el: THREE.Group | null) => void;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

/**
 * Gold card border — a slightly larger, slightly set-back mesh that peeks
 * out around all edges of the card body, acting as a physical frame.
 */
function CardBorder({ tileW, tileH, isFlat, depth }: {
  tileW: number; tileH: number; isFlat: boolean; depth: number;
}) {
  const BORDER = Math.max(0.03, tileW * 0.026); // world-units each side

  return isFlat ? (
    // Flat LOD: plane behind the card body
    <mesh position={[0, 0, -0.003]} renderOrder={0}>
      <planeGeometry args={[tileW + BORDER * 2, tileH + BORDER * 2]} />
      <meshStandardMaterial
        color="#b88820"
        emissive="#E8A444"
        emissiveIntensity={0.22}
        roughness={0.28}
        metalness={0.85}
        side={THREE.DoubleSide}
      />
    </mesh>
  ) : (
    // Full LOD: box slightly behind and larger than the card body
    <mesh position={[0, 0, -0.005]}>
      <boxGeometry args={[tileW + BORDER * 2, tileH + BORDER * 2, depth - 0.008]} />
      <meshStandardMaterial
        color="#b88820"
        emissive="#E8A444"
        emissiveIntensity={0.16}
        roughness={0.28}
        metalness={0.85}
      />
    </mesh>
  );
}

export function CharacterTile({
  characterId, characterName, texture, tileW, tileH, pivotRef,
}: CharacterTileProps) {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const { toggleElimination } = useGameActions();
  const [hovered, setHovered] = useState(false);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const isInteractive = phase === GamePhase.ELIMINATION;
  const isFlat = tileW < 1.0;
  const DEPTH = Math.min(0.06, tileW * 0.04);

  // Hover glow — idle baseline 0.07, jumps to 0.45 on hover during elimination
  useFrame((_, delta) => {
    if (matRef.current) {
      const target = hovered && isInteractive ? 0.45 : 0.07;
      matRef.current.emissiveIntensity = lerp(
        matRef.current.emissiveIntensity, target, 1 - Math.pow(0.001, delta),
      );
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isInteractive) toggleElimination(characterId);
  }, [isInteractive, toggleElimination, characterId]);

  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isInteractive) { setHovered(true); document.body.style.cursor = 'pointer'; }
  }, [isInteractive]);

  const handleOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  // Suppress unused variable warning — eliminatedIds is used by parent CharacterGrid
  void eliminatedIds;

  return (
    /* Pivot at tile bottom — parent CharacterGrid controls rotation.x for flip */
    <group ref={pivotRef}>
      <group position={[0, tileH / 2, 0]}>

        {/* Gold border frame — drawn behind card body, peeks out as physical rim */}
        <CardBorder tileW={tileW} tileH={tileH} isFlat={isFlat} depth={DEPTH} />

        {/* Card body */}
        {isFlat ? (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <planeGeometry args={[tileW, tileH]} />
            <meshStandardMaterial
              ref={matRef}
              color={texture ? '#FFFFFF' : '#8899BB'}
              roughness={0.52}
              emissive="#E8A444"
              emissiveIntensity={0.07}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <boxGeometry args={[tileW, tileH, DEPTH]} />
            <meshStandardMaterial
              ref={matRef}
              color={texture ? '#FFFFFF' : '#8899BB'}
              roughness={0.48}
              metalness={0.15}
              emissive="#E8A444"
              emissiveIntensity={0.07}
            />
          </mesh>
        )}

        {/* Portrait — expanded coverage for more image, less border waste */}
        {texture && (
          <mesh position={[0, 0, (isFlat ? 0 : DEPTH / 2) + 0.001]}>
            <planeGeometry args={[tileW * 0.93, tileH * 0.86]} />
            <meshStandardMaterial map={texture} roughness={0.55} transparent />
          </mesh>
        )}

        {/* Card back — premium dark navy (full LOD only) */}
        {!isFlat && (
          <mesh position={[0, 0, -DEPTH / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[tileW * 0.93, tileH * 0.86]} />
            <meshStandardMaterial color="#12103a" roughness={0.75} metalness={0.08} />
          </mesh>
        )}

        {/* Name label (full LOD only) */}
        {!isFlat && (
          <NameLabel name={characterName} tileW={tileW} tileH={tileH} depth={DEPTH} />
        )}
      </group>
    </group>
  );
}

function NameLabel({ name, tileW, tileH, depth }: {
  name: string; tileW: number; tileH: number; depth: number;
}) {
  const texture = useRef<THREE.CanvasTexture | null>(null);

  if (!texture.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 72;
    const ctx = canvas.getContext('2d')!;

    // Semi-transparent dark pill background
    ctx.clearRect(0, 0, 320, 72);
    ctx.fillStyle = 'rgba(10, 8, 30, 0.72)';
    ctx.beginPath();
    ctx.roundRect(4, 8, 312, 56, 12);
    ctx.fill();

    // Gold bottom accent line
    ctx.fillStyle = '#E8A444';
    ctx.fillRect(24, 58, 272, 3);

    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillText(name, 162, 34);

    // Main text
    ctx.fillStyle = '#fffffe';
    ctx.fillText(name, 160, 32);

    texture.current = new THREE.CanvasTexture(canvas);
    texture.current.colorSpace = THREE.SRGBColorSpace;
  }

  useEffect(() => {
    const currentTexture = texture.current;
    return () => {
      if (currentTexture) {
        currentTexture.dispose();
      }
    };
  }, []);

  return (
    <mesh position={[0, -tileH * 0.42, depth / 2 + 0.06]}>
      <planeGeometry args={[tileW * 0.88, tileH * 0.18]} />
      <meshBasicMaterial map={texture.current} transparent depthWrite={false} />
    </mesh>
  );
}
