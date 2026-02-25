import { useRef, useState, useCallback } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TILE } from '../utils/constants';
import { GamePhase } from '../store/types';
import { usePhase, useActivePlayer, useEliminatedIds, useGameActions } from '../store/selectors';

interface CharacterTileProps {
  characterId: string;
  characterName: string;
  texture: THREE.CanvasTexture;
  position: [number, number, number];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function CharacterTile({ characterId, characterName, texture, position }: CharacterTileProps) {
  const phase = usePhase();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const { toggleElimination } = useGameActions();
  const [hovered, setHovered] = useState(false);

  const pivotRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const labelRef = useRef<THREE.Mesh>(null);

  const isEliminated = eliminatedIds.includes(characterId);
  const isInteractive = phase === GamePhase.ELIMINATION;

  // Animate flip and emissive with useFrame
  useFrame((_, delta) => {
    if (pivotRef.current) {
      const target = isEliminated ? -Math.PI / 2.2 : 0;
      pivotRef.current.rotation.x = lerp(pivotRef.current.rotation.x, target, 1 - Math.pow(0.001, delta));
    }
    if (matRef.current) {
      const target = hovered && isInteractive ? 0.35 : 0;
      matRef.current.emissiveIntensity = lerp(matRef.current.emissiveIntensity, target, 1 - Math.pow(0.001, delta));
    }
  });

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isInteractive) {
      toggleElimination(characterId);
    }
  }, [isInteractive, toggleElimination, characterId]);

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isInteractive) {
      setHovered(true);
      document.body.style.cursor = 'pointer';
    }
  }, [isInteractive]);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  return (
    <group position={position}>
      {/* Pivot point at bottom of tile */}
      <group ref={pivotRef}>
        <group position={[0, TILE.height / 2, 0]}>
          {/* Card body */}
          <mesh
            onClick={handleClick}
            onPointerOver={handlePointerOver}
            onPointerOut={handlePointerOut}
          >
            <boxGeometry args={[TILE.width, TILE.height, TILE.depth]} />
            <meshStandardMaterial
              ref={matRef}
              color="#FFFFFF"
              roughness={0.5}
              metalness={0.05}
              emissive="#E8A444"
              emissiveIntensity={0}
            />
          </mesh>

          {/* Portrait on front face */}
          <mesh position={[0, 0, TILE.depth / 2 + 0.001]}>
            <planeGeometry args={[TILE.width - 0.15, TILE.height - 0.3]} />
            <meshStandardMaterial map={texture} roughness={0.6} />
          </mesh>

          {/* Card back */}
          <mesh position={[0, 0, -TILE.depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
            <planeGeometry args={[TILE.width - 0.15, TILE.height - 0.3]} />
            <meshStandardMaterial color="#2d1810" roughness={0.8} />
          </mesh>
        </group>
      </group>

      {/* Name label using canvas texture */}
      <NameLabel name={characterName} />
    </group>
  );
}

/** Simple name label using a canvas texture instead of drei Text (avoids font loading issues) */
function NameLabel({ name }: { name: string }) {
  const texture = useRef<THREE.CanvasTexture | null>(null);

  if (!texture.current) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = 'bold 32px Inter, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    ctx.strokeText(name, 128, 32);
    ctx.fillText(name, 128, 32);
    texture.current = new THREE.CanvasTexture(canvas);
    texture.current.colorSpace = THREE.SRGBColorSpace;
  }

  return (
    <mesh position={[0, -0.12, 0.08]}>
      <planeGeometry args={[1.2, 0.3]} />
      <meshBasicMaterial map={texture.current} transparent depthWrite={false} />
    </mesh>
  );
}
