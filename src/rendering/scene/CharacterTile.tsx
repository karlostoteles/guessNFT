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

import { useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GamePhase } from '@/core/store/types';
import { usePhase, useActivePlayer, useEliminatedIds, useGameActions } from '@/core/store/selectors';

interface CharacterTileProps {
  characterId:   string;
  characterName: string;
  texture:       THREE.Texture | undefined;
  tileW:         number;
  tileH:         number;
  /** Callback so CharacterGrid can control the flip rotation */
  pivotRef:      (el: THREE.Group | null) => void;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function CharacterTile({
  characterId, characterName, texture, tileW, tileH, pivotRef,
}: CharacterTileProps) {
  const phase         = usePhase();
  const activePlayer  = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const { toggleElimination } = useGameActions();
  const [hovered, setHovered] = useState(false);

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  const isInteractive = phase === GamePhase.ELIMINATION;
  const isFlat        = tileW < 1.0;
  const DEPTH         = Math.min(0.06, tileW * 0.04);

  // Hover glow (emissive) animation
  useFrame((_, delta) => {
    if (matRef.current) {
      const target = hovered && isInteractive ? 0.35 : 0;
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

  return (
    /* Pivot at tile bottom — parent CharacterGrid controls rotation.x for flip */
    <group ref={pivotRef}>
      <group position={[0, tileH / 2, 0]}>

        {/* Card body */}
        {isFlat ? (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <planeGeometry args={[tileW, tileH]} />
            <meshStandardMaterial
              ref={matRef}
              color={texture ? '#FFFFFF' : '#8899BB'}
              roughness={0.55}
              emissive="#E8A444"
              emissiveIntensity={0}
              side={THREE.DoubleSide}
            />
          </mesh>
        ) : (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <boxGeometry args={[tileW, tileH, DEPTH]} />
            <meshStandardMaterial
              ref={matRef}
              color={texture ? '#FFFFFF' : '#8899BB'}
              roughness={0.5}
              metalness={0.05}
              emissive="#E8A444"
              emissiveIntensity={0}
            />
          </mesh>
        )}

        {/* Portrait */}
        {texture && (
          <mesh position={[0, 0, (isFlat ? 0 : DEPTH / 2) + 0.001]}>
            <planeGeometry args={[tileW * 0.92, tileH * 0.84]} />
            <meshStandardMaterial map={texture} roughness={0.6} transparent />
          </mesh>
        )}

        {/* Card back (full LOD only) */}
        {!isFlat && (
          <mesh position={[0, 0, -DEPTH / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[tileW * 0.92, tileH * 0.84]} />
            <meshStandardMaterial color="#2d1810" roughness={0.8} />
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
    const canvas  = document.createElement('canvas');
    canvas.width  = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 30px Inter, Arial, sans-serif';
    ctx.textAlign     = 'center';
    ctx.textBaseline  = 'middle';
    ctx.strokeStyle   = '#000000';
    ctx.lineWidth     = 4;
    ctx.strokeText(name, 128, 32);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, 128, 32);
    texture.current = new THREE.CanvasTexture(canvas);
    texture.current.colorSpace = THREE.SRGBColorSpace;
  }

  return (
    <mesh position={[0, -tileH * 0.42, depth / 2 + 0.08]}>
      <planeGeometry args={[tileW * 0.85, tileH * 0.17]} />
      <meshBasicMaterial map={texture.current} transparent depthWrite={false} />
    </mesh>
  );
}
