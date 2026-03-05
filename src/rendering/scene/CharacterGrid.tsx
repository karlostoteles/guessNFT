/**
 * CharacterGrid — adaptive, animated grid of character tiles.
 *
 * Two rendering paths based on LOD (derived from tileW):
 *
 *  minimal (tileW < 0.38)
 *    → InstancedMesh: all tiles share one draw call.  Each instance is a
 *      coloured plane.  Scale-to-zero on elimination.  Smooth position lerp.
 *
 *  flat / full (tileW >= 0.38)
 *    → Individual CharacterTile React elements.  Parent group refs tracked in
 *      a Map; a single useFrame lerps every group position + handles the
 *      flip→shrink elimination animation.
 */

import { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, getTileLOD, computeAdaptiveGrid } from '@/core/rules/constants';
import { useGameCharacters, useActivePlayer, useEliminatedIds } from '@/core/store/selectors';
import { CharacterTile } from './CharacterTile';
import { sfx } from '@/shared/audio/sfx';

interface CharacterGridProps {
  textures: Map<string, THREE.Texture>;
  tileW: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function idToHue(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xfffff;
  }
  return (h * 137.508) % 360;
}

function computeTargetPositions(
  activeChars: { id: string }[],
  cols: number,
  tileW: number,
  tileH: number,
  gap: number,
): Map<string, [number, number]> {
  const rows = Math.ceil(activeChars.length / cols);
  const gridW = cols * tileW + (cols - 1) * gap;
  const gridD = rows * tileH + (rows - 1) * gap;
  const startX = -gridW / 2 + tileW / 2;
  const startZ = -gridD / 2 + tileH / 2;

  const map = new Map<string, [number, number]>();
  activeChars.forEach((char, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    map.set(char.id, [
      startX + col * (tileW + gap),
      startZ + row * (tileH + gap),
    ]);
  });
  return map;
}

// ─── Main component ────────────────────────────────────────────────────────────

export function CharacterGrid({ textures, tileW }: CharacterGridProps) {
  const lod = getTileLOD(tileW);
  if (lod === 'minimal') {
    return <MinimalGrid tileW={tileW} />;
  }
  return <IndividualGrid textures={textures} tileW={tileW} />;
}

// ─── Minimal LOD: InstancedMesh (one draw call for hundreds of tiles) ──────────

interface MinimalAnimState {
  x: number; z: number;
  tx: number; tz: number;
  scale: number;
  targetScale: number;
}

function MinimalGrid({ tileW: _tileW }: { tileW: number }) {
  const characters = useGameCharacters();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const animRef = useRef<Map<string, MinimalAnimState>>(new Map());
  const colorBuf = useRef(new THREE.Color());
  const matBuf = useRef(new THREE.Matrix4());
  const posBuf = useRef(new THREE.Vector3());
  const sclBuf = useRef(new THREE.Vector3());
  const quatBuf = useRef(new THREE.Quaternion());

  const activeChars = useMemo(() => {
    const elimSet = new Set(eliminatedIds);
    return characters.filter((c) => !elimSet.has(c.id));
  }, [characters, eliminatedIds]);
  const layout = useMemo(() => computeAdaptiveGrid(activeChars.length), [activeChars.length]);
  const targets = useMemo(
    () => computeTargetPositions(activeChars, layout.cols, layout.tileW, layout.tileH, layout.gap),
    [activeChars, layout],
  );

  // Reset instance count to 0 immediately on mount so no stale instances show
  useLayoutEffect(() => {
    if (meshRef.current) meshRef.current.count = 0;
  }, []);

  // Sync animation states — runs after render, populates animRef
  useEffect(() => {
    const existing = animRef.current;
    const elimSet = new Set(eliminatedIds);
    for (const char of characters) {
      const isEliminated = elimSet.has(char.id);
      const target = targets.get(char.id);
      if (!existing.has(char.id)) {
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          x: tx, z: tz, tx, tz,
          scale: isEliminated ? 0 : 1,
          targetScale: isEliminated ? 0 : 1,
        });
      } else {
        const st = existing.get(char.id)!;
        if (target) { st.tx = target[0]; st.tz = target[1]; }
        if (isEliminated && st.targetScale === 1) {
          sfx.tileFlip();
        }
        st.targetScale = isEliminated ? 0 : 1;
      }
    }
  }, [characters, eliminatedIds, targets]);

  // Single useFrame: lerp all instance matrices
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || animRef.current.size === 0) return;

    const t = 1 - Math.pow(0.003, delta);
    const tScl = 1 - Math.pow(0.0001, delta);

    let idx = 0;
    for (const char of characters) {
      const st = animRef.current.get(char.id);
      if (!st) continue;
      if (st.scale < 0.001 && st.targetScale === 0) continue;

      st.x = lerp(st.x, st.tx, t);
      st.z = lerp(st.z, st.tz, t);
      st.scale = lerp(st.scale, st.targetScale, tScl * 3);

      posBuf.current.set(st.x, 0, st.z);
      sclBuf.current.set(layout.tileW * st.scale, layout.tileH * st.scale, 0.002);
      matBuf.current.compose(posBuf.current, quatBuf.current, sclBuf.current);
      mesh.setMatrixAt(idx, matBuf.current);

      colorBuf.current.setHSL(idToHue(char.id) / 360, 0.9, 0.72);
      mesh.setColorAt(idx, colorBuf.current);
      idx++;
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  return (
    <group position={[0, BOARD.height / 2 + 0.01, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, characters.length]}
        frustumCulled={false}
      >
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial vertexColors side={THREE.DoubleSide} />
      </instancedMesh>
    </group>
  );
}

// ─── Standard LOD: individual CharacterTile components ─────────────────────────

type AnimPhase = 'alive' | 'flipping' | 'shrinking' | 'dead';

interface TileAnim {
  id: string;
  x: number; z: number;
  tx: number; tz: number;
  scale: number;
  targetScale: number;
  flipAngle: number;
  phase: AnimPhase;
}

function IndividualGrid({ textures, tileW }: CharacterGridProps) {
  const characters = useGameCharacters();
  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const pivotRefs = useRef<Map<string, THREE.Group>>(new Map());
  const animRef = useRef<Map<string, TileAnim>>(new Map());

  const activeChars = useMemo(() => {
    const elimSet = new Set(eliminatedIds);
    return characters.filter((c) => !elimSet.has(c.id));
  }, [characters, eliminatedIds]);
  const layout = useMemo(() => computeAdaptiveGrid(activeChars.length), [activeChars.length]);
  const targets = useMemo(
    () => computeTargetPositions(activeChars, layout.cols, layout.tileW, layout.tileH, layout.gap),
    [activeChars, layout],
  );

  // Update animRef when eliminations or targets change
  useEffect(() => {
    const existing = animRef.current;
    const elimSet = new Set(eliminatedIds);
    for (const char of characters) {
      const isEliminated = elimSet.has(char.id);
      const target = targets.get(char.id);

      if (!existing.has(char.id)) {
        // New character — will be seeded at correct position by group ref callback
        // This branch handles any characters added after initial mount
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          id: char.id, x: tx, z: tz, tx, tz,
          scale: 1, targetScale: 1,
          flipAngle: 0,
          phase: isEliminated ? 'flipping' : 'alive',
        });
      } else {
        const st = existing.get(char.id)!;
        // Update target position for living tiles (grid repack)
        if (target && (st.phase === 'alive')) {
          st.tx = target[0];
          st.tz = target[1];
        }
        // Trigger flip+shrink for newly eliminated tiles
        if (isEliminated && st.phase === 'alive') {
          st.phase = 'flipping';
          sfx.tileFlip();
        }
        // When the active player switches and this character is not eliminated in
        // the new player's view, revive it so it appears on their board.
        // (Each player has independent eliminated sets — a tile dead in P1's view
        // must be visible in P2's view if P2 hasn't eliminated it, and vice versa.)
        if (!isEliminated && st.phase !== 'alive') {
          const [tx, tz] = target ? [target[0], target[1]] : [st.tx, st.tz];
          st.phase = 'alive';
          st.scale = 1;
          st.flipAngle = 0;
          st.x = tx; st.z = tz; st.tx = tx; st.tz = tz;
          const group = groupRefs.current.get(char.id);
          if (group) {
            group.visible = true;
            group.scale.setScalar(1);
            group.position.set(tx, 0, tz);
          }
          const pivot = pivotRefs.current.get(char.id);
          if (pivot) pivot.rotation.x = 0;
        }
      }
    }
  }, [characters, eliminatedIds, targets]);

  // Single useFrame: position lerp + flip + shrink for all tiles
  useFrame((_, delta) => {
    const tPos = 1 - Math.pow(0.003, delta);
    const tFlip = 1 - Math.pow(0.0001, delta);
    const tScl = 1 - Math.pow(0.0001, delta);

    for (const st of animRef.current.values()) {
      if (st.phase === 'dead') continue;

      const group = groupRefs.current.get(st.id);
      if (!group) continue;

      // Position lerp (only alive tiles move to new targets)
      if (st.phase === 'alive') {
        st.x = lerp(st.x, st.tx, tPos);
        st.z = lerp(st.z, st.tz, tPos);
        group.position.set(st.x, 0, st.z);
      }

      // Flip animation (tile rotates to facedown)
      if (st.phase === 'flipping') {
        st.flipAngle = lerp(st.flipAngle, -Math.PI / 2.2, tFlip * 4);
        const pivot = pivotRefs.current.get(st.id);
        if (pivot) pivot.rotation.x = st.flipAngle;
        if (Math.abs(st.flipAngle + Math.PI / 2.2) < 0.04) {
          st.phase = 'shrinking';
          st.targetScale = 0;
        }
      }

      // Shrink to dust
      if (st.phase === 'shrinking') {
        st.scale = lerp(st.scale, 0, tScl * 5);
        group.scale.setScalar(Math.max(0, st.scale));
        if (st.scale < 0.01) {
          group.visible = false;
          st.phase = 'dead';
        }
      }
    }
  });

  return (
    <group position={[0, BOARD.height / 2 + 0.01, 0]}>
      {characters.map((char) => {
        const texture = textures.get(char.id);

        return (
          <group
            key={char.id}
            ref={(el) => {
              if (el) {
                groupRefs.current.set(char.id, el);

                // Seed animRef & position on FIRST MOUNT (before useEffect runs)
                // This prevents tiles from appearing at [0,0,0] for the first frame.
                if (!animRef.current.has(char.id)) {
                  const target = targets.get(char.id);
                  const [tx, tz] = target ?? [0, 0];
                  const elimSet = new Set(eliminatedIds);
                  const isElim = elimSet.has(char.id);
                  animRef.current.set(char.id, {
                    id: char.id, x: tx, z: tz, tx, tz,
                    scale: isElim ? 0 : 1, targetScale: isElim ? 0 : 1,
                    flipAngle: 0, phase: isElim ? 'dead' : 'alive',
                  });
                  el.position.set(tx, 0, tz);
                  if (isElim) el.visible = false;
                } else {
                  // Re-mount: restore position from existing animRef entry
                  const st = animRef.current.get(char.id)!;
                  el.position.set(st.x, 0, st.z);
                  if (st.phase === 'dead') el.visible = false;
                }
              } else {
                groupRefs.current.delete(char.id);
              }
            }}
          >
            <CharacterTile
              characterId={char.id}
              characterName={char.name}
              texture={texture}
              tileW={layout.tileW}
              tileH={layout.tileH}
              pivotRef={(el) => {
                if (el) pivotRefs.current.set(char.id, el);
                else pivotRefs.current.delete(char.id);
              }}
            />
          </group>
        );
      })}
    </group>
  );
}
