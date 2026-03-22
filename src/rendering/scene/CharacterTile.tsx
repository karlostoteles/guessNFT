/**
 * CharacterTile — renders a single character tile at 2 LOD tiers.
 * OPTIMIZED: Uses useMemo for textures, centralized animations, proper disposal.
 */

import { useRef, useState, useCallback, useEffect, memo, useMemo } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { GamePhase } from '@/core/store/types';
import { usePhase, useGameActions } from '@/core/store/selectors';

interface CharacterTileProps {
  characterId: string;
  characterName: string;
  texture: THREE.Texture | undefined;
  tileW: number;
  tileH: number;
  pivotRef: (el: THREE.Group | null) => void;
  isHovered?: boolean;
  /** When 2, tile faces the opposite camera (P2 perspective). */
  onlinePlayerNum?: 1 | 2 | null;
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

const CardBorder = memo(({ tileW, tileH, isFlat, depth }: {
  tileW: number; tileH: number; isFlat: boolean; depth: number;
}) => {
  const BORDER = Math.max(0.03, tileW * 0.026);
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#b88820',
    emissive: '#E8A444',
    emissiveIntensity: 0.22,
    roughness: 0.28,
    metalness: 0.85,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  }), []);
  useEffect(() => () => material.dispose(), [material]);

  return isFlat ? (
    <mesh position={[0, 0, -0.003]} renderOrder={0}>
      <planeGeometry args={[tileW + BORDER * 2, tileH + BORDER * 2]} />
      <primitive object={material} attach="material" side={THREE.DoubleSide} />
    </mesh>
  ) : (
    <mesh position={[0, 0, -0.005]}>
      <boxGeometry args={[tileW + BORDER * 2, tileH + BORDER * 2, depth - 0.008]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
});

function NameLabel({ name, tileW, tileH, depth }: {
  name: string; tileW: number; tileH: number; depth: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320; canvas.height = 72;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, 320, 72);
    ctx.fillStyle = 'rgba(10, 8, 30, 0.72)';
    ctx.beginPath(); ctx.roundRect(4, 8, 312, 56, 12); ctx.fill();
    ctx.fillStyle = '#E8A444'; ctx.fillRect(24, 58, 272, 3);
    ctx.font = 'bold 28px Inter, Arial, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillText(name, 162, 34);
    ctx.fillStyle = '#fffffe'; ctx.fillText(name, 160, 32);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [name]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <mesh position={[0, -tileH * 0.42, depth / 2 + 0.06]}>
      <planeGeometry args={[tileW * 0.88, tileH * 0.18]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

const Portrait = memo(({ texture, tileW, tileH, depth, isFlat }: {
  texture: THREE.Texture | undefined;
  tileW: number; tileH: number; depth: number; isFlat: boolean;
}) => {
  const geometry = useMemo(() => new THREE.PlaneGeometry(tileW * 0.93, tileH * 0.86), [tileW, tileH]);
  const material = useMemo(() => new THREE.MeshBasicMaterial({ map: texture ?? null, transparent: true }), [texture]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  if (!texture) return null;

  return (
    <mesh position={[0, 0, (isFlat ? 0 : depth / 2) + 0.001]}>
      <primitive object={geometry} attach="geometry" />
      <primitive object={material} attach="material" />
    </mesh>
  );
});

const CardBack = memo(({ tileW, tileH, depth }: {
  tileW: number; tileH: number; depth: number;
}) => {
  const material = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#12103a', roughness: 0.75, metalness: 0.08, clearcoat: 0.3, clearcoatRoughness: 0.4,
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh position={[0, 0, -depth / 2 - 0.001]} rotation={[0, Math.PI, 0]}>
      <planeGeometry args={[tileW * 0.93, tileH * 0.86]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
});

export const CharacterTile = memo(({
  characterId, characterName, texture, tileW, tileH, pivotRef, isHovered = false, onlinePlayerNum,
}: CharacterTileProps) => {
  const phase = usePhase();
  const { toggleElimination } = useGameActions();
  const [localHovered, setLocalHovered] = useState(false);
  const matRef = useRef<THREE.MeshPhysicalMaterial>(null);
  const isInteractive = phase === GamePhase.ELIMINATION;
  const isFlat = tileW < 1.0;
  const DEPTH = Math.min(0.06, tileW * 0.04);
  const isEffectiveHovered = isHovered || localHovered;

  useFrame((_, delta) => {
    if (isFlat || !matRef.current) return;
    const target = isEffectiveHovered && isInteractive ? 0.45 : 0.07;
    matRef.current.emissiveIntensity = lerp(matRef.current.emissiveIntensity, target, 1 - Math.pow(0.001, delta));
  });

  const cardMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: texture ? '#FFFFFF' : '#8899BB',
    roughness: 0.2, metalness: 0.15,
    emissive: '#E8A444', emissiveIntensity: 0.07,
    clearcoat: 0.5, clearcoatRoughness: 0.2,
  }), [texture]);

  useEffect(() => () => cardMaterial.dispose(), [cardMaterial]);

  const handleClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (isInteractive) toggleElimination(characterId);
  }, [isInteractive, toggleElimination, characterId]);

  const handleOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (isInteractive) { setLocalHovered(true); document.body.style.cursor = 'pointer'; }
  }, [isInteractive]);

  const handleOut = useCallback(() => {
    setLocalHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  return (
    <group ref={pivotRef} rotation={onlinePlayerNum === 2 ? [0, Math.PI, 0] : [0, 0, 0]}>
      <group position={[0, tileH / 2, 0]}>
        <CardBorder tileW={tileW} tileH={tileH} isFlat={isFlat} depth={DEPTH} />
        {isFlat ? (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <planeGeometry args={[tileW, tileH]} />
            <primitive object={cardMaterial} attach="material" side={THREE.DoubleSide} />
          </mesh>
        ) : (
          <mesh onClick={handleClick} onPointerOver={handleOver} onPointerOut={handleOut}>
            <boxGeometry args={[tileW, tileH, DEPTH]} />
            <primitive object={cardMaterial} ref={matRef} attach="material" />
          </mesh>
        )}
        <Portrait texture={texture} tileW={tileW} tileH={tileH} depth={DEPTH} isFlat={isFlat} />
        {!isFlat && <CardBack tileW={tileW} tileH={tileH} depth={DEPTH} />}
        {!isFlat && <NameLabel name={characterName} tileW={tileW} tileH={tileH} depth={DEPTH} />}
      </group>
    </group>
  );
});

CharacterTile.displayName = 'CharacterTile';
