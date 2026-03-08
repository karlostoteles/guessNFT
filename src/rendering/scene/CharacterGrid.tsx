/**
 * CharacterGrid — adaptive, animated grid of character tiles.
 *
 * Two rendering paths based on LOD (derived from tileW):
 *
 *  minimal (tileW < 0.38)
 *    → InstancedMesh with texture atlas: all tiles share one draw call.
 *      Per-instance UV offsets sample each tile's portrait from a shared atlas.
 *      Staggered flip → shrink elimination animation.  Progressive NFT loading.
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
import { useGameCharacters, useActivePlayer, useEliminatedIds, useGameMode, useOnlinePlayerNum } from '@/core/store/selectors';
import { CharacterTile } from './CharacterTile';
import { TextureAtlas } from '@/rendering/canvas/TextureAtlas';
import { renderPortraitCanvas } from '@/rendering/canvas/PortraitRenderer';
import { sfx } from '@/shared/audio/sfx';
import { globalTextureCache } from '@/shared/hooks/useCharacterTextures';

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

// ─── Atlas shader source ──────────────────────────────────────────────────────

const ATLAS_VERT = /* glsl */`
attribute vec4 aAtlasUV; // uOffset, vOffset, uScale, vScale
varying vec2 vAtlasCoord;

void main() {
  vAtlasCoord = aAtlasUV.xy + uv * aAtlasUV.zw;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const ATLAS_FRAG = /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vAtlasCoord;

void main() {
  gl_FragColor = texture2D(uAtlas, vAtlasCoord);
  #include <colorspace_fragment>
}
`;

// ─── Helpers for NFT image loading ────────────────────────────────────────────

function extractImageHash(url: string): string | null {
  const match = url.match(/\/([a-f0-9]+)\.png$/i);
  return match ? match[1] : null;
}

// X-axis unit vector (pre-allocated for quaternion rotation)
const X_AXIS = new THREE.Vector3(1, 0, 0);

// Global cache for procedurally generated placeholder faces
export const proceduralCanvasCache = new Map<string, HTMLCanvasElement>();

// ─── Minimal LOD: InstancedMesh + Texture Atlas (one draw call) ───────────────

type MinimalPhase = 'alive' | 'waiting' | 'flipping' | 'shrinking' | 'dead';

interface MinimalAnimState {
  x: number; z: number;
  tx: number; tz: number;
  scale: number;
  targetScale: number;
  phase: MinimalPhase;
  flipAngle: number;
  flipDelay: number;
  flipTimer: number;
}

function MinimalGrid({ tileW: _tileW }: { tileW: number }) {
  const characters = useGameCharacters();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();

  // Use the correct player key (mirrors IndividualGrid for online mode)
  const myPlayerKey = mode === 'online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : activePlayer;
  const eliminatedIds = useEliminatedIds(myPlayerKey);

  const meshRef = useRef<THREE.InstancedMesh>(null);
  const animRef = useRef<Map<string, MinimalAnimState>>(new Map());
  const matBuf = useRef(new THREE.Matrix4());
  const posBuf = useRef(new THREE.Vector3());
  const sclBuf = useRef(new THREE.Vector3());
  const quatBuf = useRef(new THREE.Quaternion());

  // Stable atlas + per-character index (created once per character list)
  const atlasRef = useRef<TextureAtlas | null>(null);
  const charIndexMapRef = useRef<Map<string, number>>(new Map());

  // Per-instance UV attribute
  const uvAttrRef = useRef<THREE.InstancedBufferAttribute | null>(null);

  const activeChars = useMemo(() => {
    const elimSet = new Set(eliminatedIds);
    return characters.filter((c) => !elimSet.has(c.id));
  }, [characters, eliminatedIds]);
  const layout = useMemo(() => computeAdaptiveGrid(activeChars.length), [activeChars.length]);
  const targets = useMemo(
    () => computeTargetPositions(activeChars, layout.cols, layout.tileW, layout.tileH, layout.gap),
    [activeChars, layout],
  );

  // ShaderMaterial — created once, atlas texture bound as uniform
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: { uAtlas: { value: null } },
      vertexShader: ATLAS_VERT,
      fragmentShader: ATLAS_FRAG,
      side: THREE.DoubleSide,
      transparent: false,
    });
  }, []);

  // ── Atlas construction + procedural portrait rendering ──────────────────────
  useEffect(() => {
    if (!characters || characters.length === 0) return;

    // Build stable index map: character.id → atlas cell index
    const indexMap = new Map<string, number>();
    characters.forEach((c, i) => indexMap.set(c.id, i));
    charIndexMapRef.current = indexMap;

    // Create atlas
    const atlas = new TextureAtlas(characters.length, 128);
    atlasRef.current = atlas;

    // Bind atlas texture to shader uniform
    material.uniforms.uAtlas.value = atlas.texture;

    // Fill all cells with existing cached images or fallback to procedural
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];
      const cached = globalTextureCache.get(char.id);

      if (cached && cached.image) {
        // Draw the cached REAL image instantly
        atlas.drawCell(i, cached.image as HTMLImageElement);
      } else if (proceduralCanvasCache.has(char.id)) {
        // Draw the cached PROCEDURAL placeholder instantly
        atlas.drawCell(i, proceduralCanvasCache.get(char.id)!);
      } else {
        // Fallback to solid color until procedural batch reaches it
        const hue = idToHue(char.id);
        const hsl = `hsl(${Math.round(hue)}, 70%, 55%)`;
        atlas.fillCell(i, hsl);
      }
    }

    // Batch-render procedural portraits into atlas cells
    let procIdx = 0;
    let rafId = 0;
    const PROC_BATCH = 50;
    function renderProceduralBatch() {
      const end = Math.min(procIdx + PROC_BATCH, characters.length);
      for (; procIdx < end; procIdx++) {
        const char = characters[procIdx];
        if (!globalTextureCache.has(char.id) && !proceduralCanvasCache.has(char.id)) {
          const canvas = renderPortraitCanvas(char, undefined, true);
          proceduralCanvasCache.set(char.id, canvas);
          atlas.drawCell(procIdx, canvas);
        }
      }
      // Mark dirty once per batch (not per cell)
      atlas.markDirty();
      if (procIdx < characters.length) {
        rafId = requestAnimationFrame(renderProceduralBatch);
      }
    }
    rafId = requestAnimationFrame(renderProceduralBatch);

    return () => {
      cancelAnimationFrame(rafId);
      atlas.dispose();
      atlasRef.current = null;
    };
  }, [characters, material]);

  // ── Progressive NFT image loading ───────────────────────────────────────────
  useEffect(() => {
    if (!characters || characters.length === 0) return;

    let cancelled = false;
    const BATCH_SIZE = 20;
    const BATCH_DELAY = 80;
    const IMG_SIZE = 128; // Match atlas cell size for crisp rendering

    function loadImage(url: string): Promise<HTMLImageElement | null> {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 12000);
        img.src = url;
      });
    }

    const loadBatches = async () => {
      // Wait for atlas to be ready (procedural rendering may still be in progress)
      await new Promise(r => setTimeout(r, 200));

      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (char) => {
            if (cancelled) return;
            const atlas = atlasRef.current;
            if (!atlas) return;

            // Skip if already in global cache
            if (globalTextureCache.has(char.id)) return;

            const numericId = char.id.replace('nft_', '');
            const hash = char.imageUrl ? extractImageHash(char.imageUrl) : null;
            const urls = [
              hash ? `/api/nft-img?hash=${hash}` : null,
              `/nft/${numericId}.png`,
              `/api/nft-art/${numericId}`,
            ].filter(Boolean) as string[];

            for (const url of urls) {
              const img = await loadImage(url);
              if (img && !cancelled && atlasRef.current) {
                // Generate a fully initialized CanvasTexture to guarantee WebGL survival across component bounds
                const canvas = document.createElement('canvas');
                canvas.width = IMG_SIZE;
                canvas.height = IMG_SIZE;
                const ctx = canvas.getContext('2d')!;
                ctx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);
                const texture = new THREE.CanvasTexture(canvas);
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.needsUpdate = true;
                globalTextureCache.set(char.id, texture);

                const idx = charIndexMapRef.current.get(char.id);
                if (idx !== undefined) {
                  atlasRef.current.drawCell(idx, canvas); // Draw using the canvas to preserve precise bounds
                }
                break;
              }
            }
          })
        );

        if (cancelled) break;

        // Mark atlas dirty once per batch
        if (atlasRef.current) atlasRef.current.markDirty();
        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    };

    loadBatches();
    return () => { cancelled = true; };
  }, [characters]);

  // Create UV attribute buffer
  useEffect(() => {
    if (!characters || characters.length === 0) return;
    const arr = new Float32Array(characters.length * 4);
    const attr = new THREE.InstancedBufferAttribute(arr, 4);
    attr.setUsage(THREE.DynamicDrawUsage);
    uvAttrRef.current = attr;

    // Attach to geometry once mesh is ready
    const mesh = meshRef.current;
    if (mesh) {
      mesh.geometry.setAttribute('aAtlasUV', attr);
    }
  }, [characters]);

  // Reset instance count to 0 immediately on mount so no stale instances show
  useLayoutEffect(() => {
    if (meshRef.current) meshRef.current.count = 0;
  }, []);

  // Attach UV attribute when mesh ref becomes available
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (mesh && uvAttrRef.current) {
      mesh.geometry.setAttribute('aAtlasUV', uvAttrRef.current);
    }
  }, []);

  // Sync animation states — runs after render, populates animRef
  useEffect(() => {
    const existing = animRef.current;
    const elimSet = new Set(eliminatedIds);
    const atlas = atlasRef.current;
    const indexMap = charIndexMapRef.current;
    const uvAttr = uvAttrRef.current;
    const newlyEliminated: string[] = [];

    // Rebuild UV mapping for all visible instances
    let visibleIdx = 0;

    for (const char of characters) {
      const isEliminated = elimSet.has(char.id);
      const target = targets.get(char.id);

      if (!existing.has(char.id)) {
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          x: tx, z: tz, tx, tz,
          scale: isEliminated ? 0 : 1,
          targetScale: isEliminated ? 0 : 1,
          phase: isEliminated ? 'dead' : 'alive',
          flipAngle: 0,
          flipDelay: 0,
          flipTimer: 0,
        });
      } else {
        const st = existing.get(char.id)!;
        if (target && st.phase === 'alive') {
          st.tx = target[0]; st.tz = target[1];
        }
        // Trigger flip — enter 'waiting' phase with staggered delay
        if (isEliminated && st.phase === 'alive') {
          newlyEliminated.push(char.id);
          st.phase = 'waiting';
          st.flipTimer = 0;
        }
      }

      // Set UV for this instance (skip dead tiles)
      const st = existing.get(char.id);
      if (st && !(st.scale < 0.001 && st.phase === 'dead')) {
        if (atlas && uvAttr && indexMap.has(char.id)) {
          const cellIdx = indexMap.get(char.id)!;
          const [uOff, vOff, uScl, vScl] = atlas.getUV(cellIdx);
          uvAttr.setXYZW(visibleIdx, uOff, vOff, uScl, vScl);
        }
        visibleIdx++;
      }
    }

    if (uvAttr) uvAttr.needsUpdate = true;

    // Assign staggered delays — cascade capped at ~800ms
    if (newlyEliminated.length > 0) {
      sfx.tilesCascade(newlyEliminated.length);
      const TOTAL_CASCADE_MS = 800;
      const perTileDelay = Math.min(0.08, TOTAL_CASCADE_MS / 1000 / newlyEliminated.length);
      newlyEliminated.forEach((id, idx) => {
        const st = existing.get(id);
        if (st) st.flipDelay = idx * perTileDelay;
      });
    }
  }, [characters, eliminatedIds, targets]);

  // Single useFrame: lerp all instance matrices + flip animation
  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh || animRef.current.size === 0) return;

    const tPos = 1 - Math.pow(0.003, delta);
    const tFlip = 1 - Math.pow(0.00005, delta);
    const tScl = 1 - Math.pow(0.0001, delta);

    let idx = 0;
    for (const char of characters) {
      const st = animRef.current.get(char.id);
      if (!st) continue;
      if (st.phase === 'dead') continue;

      // Position lerp (only alive tiles move to new targets)
      if (st.phase === 'alive') {
        st.x = lerp(st.x, st.tx, tPos);
        st.z = lerp(st.z, st.tz, tPos);
      }

      // Waiting phase: count delay before starting flip
      if (st.phase === 'waiting') {
        st.flipTimer += delta;
        if (st.flipTimer >= st.flipDelay) {
          st.phase = 'flipping';
        }
      }

      // Flip animation (tile rotates around X axis)
      if (st.phase === 'flipping') {
        st.flipAngle = lerp(st.flipAngle, -Math.PI / 2.2, tFlip * 2);
        if (Math.abs(st.flipAngle + Math.PI / 2.2) < 0.04) {
          st.phase = 'shrinking';
          st.targetScale = 0;
        }
      }

      // Shrink after flip
      if (st.phase === 'shrinking') {
        st.scale = lerp(st.scale, 0, tScl * 2);
        if (st.scale < 0.01) {
          st.phase = 'dead';
          st.scale = 0;
        }
      }

      // Compose instance matrix: position + rotation + scale
      quatBuf.current.setFromAxisAngle(X_AXIS, st.flipAngle);
      posBuf.current.set(st.x, 0, st.z);
      sclBuf.current.set(layout.tileW * st.scale, layout.tileH * st.scale, 0.002);
      matBuf.current.compose(posBuf.current, quatBuf.current, sclBuf.current);
      mesh.setMatrixAt(idx, matBuf.current);
      idx++;
    }

    mesh.count = idx;
    mesh.instanceMatrix.needsUpdate = true;
  });

  // Dispose material on unmount
  useEffect(() => {
    return () => { material.dispose(); };
  }, [material]);

  return (
    <group position={[0, BOARD.height / 2 + 0.01, 0]}>
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, characters.length]}
        frustumCulled={false}
        material={material}
      >
        <planeGeometry args={[1, 1]} />
      </instancedMesh>
    </group>
  );
}

// ─── Standard LOD: individual CharacterTile components ─────────────────────────

type AnimPhase = 'alive' | 'waiting' | 'flipping' | 'shrinking' | 'dead';

interface TileAnim {
  id: string;
  x: number; z: number;
  tx: number; tz: number;
  scale: number;
  targetScale: number;
  flipAngle: number;
  phase: AnimPhase;
  flipDelay: number; // stagger delay in seconds
  flipTimer: number;
}

function IndividualGrid({ textures, tileW }: CharacterGridProps) {
  const characters = useGameCharacters();
  const activePlayer = useActivePlayer();
  const mode = useGameMode();
  const onlinePlayerNum = useOnlinePlayerNum();

  // In true simultaneous online mode, the board is permanently locked to the local player.
  const myPlayerKey = mode === 'online'
    ? (onlinePlayerNum === 2 ? 'player2' : 'player1')
    : activePlayer;

  const eliminatedIds = useEliminatedIds(myPlayerKey);

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
    const newlyEliminated: string[] = [];
    for (const char of characters) {
      const isEliminated = elimSet.has(char.id);
      const target = targets.get(char.id);

      if (!existing.has(char.id)) {
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          id: char.id, x: tx, z: tz, tx, tz,
          scale: 1, targetScale: 1,
          flipAngle: 0,
          phase: isEliminated ? 'flipping' : 'alive',
          flipDelay: 0,
          flipTimer: 0,
        });
      } else {
        const st = existing.get(char.id)!;
        if (target && (st.phase === 'alive')) {
          st.tx = target[0];
          st.tz = target[1];
        }
        // Trigger flip — enter 'waiting' phase with staggered delay
        if (isEliminated && st.phase === 'alive') {
          newlyEliminated.push(char.id);
          st.phase = 'waiting';
          st.flipTimer = 0;
        }
        if (!isEliminated && st.phase !== 'alive' && st.phase !== 'waiting') {
          const [tx, tz] = target ? [target[0], target[1]] : [st.tx, st.tz];
          st.phase = 'alive';
          st.scale = 1;
          st.flipAngle = 0;
          st.flipDelay = 0;
          st.flipTimer = 0;
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
    // Assign staggered delays — total cascade capped at ~1s regardless of tile count
    if (newlyEliminated.length > 0) {
      sfx.tilesCascade(newlyEliminated.length);
      const TOTAL_CASCADE_MS = 800; // max ~0.8s for entire cascade
      const perTileDelay = Math.min(0.08, TOTAL_CASCADE_MS / 1000 / newlyEliminated.length);
      newlyEliminated.forEach((id, idx) => {
        const st = existing.get(id);
        if (st) st.flipDelay = idx * perTileDelay;
      });
    }
  }, [characters, eliminatedIds, targets]);

  // Single useFrame: position lerp + staggered flip + gentle shrink
  useFrame((_, delta) => {
    const tPos = 1 - Math.pow(0.003, delta);
    const tFlip = 1 - Math.pow(0.00005, delta);   // fast flip
    const tScl = 1 - Math.pow(0.0001, delta);      // fast shrink

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

      // Waiting phase: count delay before starting flip
      if (st.phase === 'waiting') {
        st.flipTimer += delta;
        if (st.flipTimer >= st.flipDelay) {
          st.phase = 'flipping';
        }
      }

      // Flip animation (tile gracefully rotates to facedown)
      if (st.phase === 'flipping') {
        st.flipAngle = lerp(st.flipAngle, -Math.PI / 2.2, tFlip * 2);
        const pivot = pivotRefs.current.get(st.id);
        if (pivot) pivot.rotation.x = st.flipAngle;
        if (Math.abs(st.flipAngle + Math.PI / 2.2) < 0.04) {
          st.phase = 'shrinking';
          st.targetScale = 0;
        }
      }

      // Gentle shrink
      if (st.phase === 'shrinking') {
        st.scale = lerp(st.scale, 0, tScl * 2);
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
                    flipDelay: 0, flipTimer: 0,
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
