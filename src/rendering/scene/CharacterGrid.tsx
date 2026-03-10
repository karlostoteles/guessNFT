/**
 * CharacterGrid — adaptive, animated grid of character tiles.
 *
 * OPTIMIZED: Uses unified ImageCache to prevent duplicate image loading.
 * All image loading goes through ImageCache, shared with React UI.
 *
 * Two rendering paths based on LOD (derived from tileW):
 *
 *  minimal (tileW < 0.38)
 *    → InstancedMesh with texture atlas: all tiles share one draw call.
 *      Per-instance UV offsets sample each tile's portrait from a shared atlas.
 *      Staggered flip → shrink elimination animation. Progressive NFT loading.
 *
 *  flat / full (tileW >= 0.38)
 *    → Individual CharacterTile React elements. Parent group refs tracked in
 *      a Map; a single useFrame lerps every group position + handles the
 *      flip→shrink elimination animation.
 */

import { useRef, useMemo, useEffect, useLayoutEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BOARD, getTileLOD, computeAdaptiveGrid } from '@/core/rules/constants';
import { useGameCharacters, useActivePlayer, useEliminatedIds, useGameMode, useOnlinePlayerNum, useSecretCharacterId } from '@/core/store/selectors';
import { CharacterTile } from './CharacterTile';
import { TextureAtlas } from '@/rendering/canvas/TextureAtlas';
import { renderPortraitCanvas } from '@/rendering/canvas/PortraitRenderer';
import { sfx } from '@/shared/audio/sfx';
import ImageCache from '@/shared/services/ImageCache';

interface CharacterGridProps {
  textures: Map<string, THREE.Texture>;
  tileW: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

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

    // Stagger every other row to allow characters to peek between the row in front.
    const rowStagger = (row % 2 === 1) ? (tileW + gap) / 2 : 0;

    map.set(char.id, [
      startX + col * (tileW + gap) + rowStagger,
      startZ + row * (tileH + gap),
    ]);
  });
  return map;
}

// ─── Main component ────────────────────────────────────────────────────────

export function CharacterGrid({ textures, tileW }: CharacterGridProps) {
  const characters = useGameCharacters();
  const lod = getTileLOD(tileW);

  if (lod === 'minimal') {
    return <MinimalGrid tileW={tileW} />;
  }
  return <IndividualGrid textures={textures} tileW={tileW} />;
}

// ─── Atlas shader source ───────────────────────────────────────────────────

const ATLAS_VERT = /* glsl */`
attribute vec4 aAtlasUV; // uOffset, vOffset, uScale, vScale
varying vec2 vAtlasCoord;
varying vec2 vTileUV;
varying vec4 vCellRect;

void main() {
  vTileUV = uv;
  vCellRect = aAtlasUV;
  vAtlasCoord = aAtlasUV.xy + uv * aAtlasUV.zw;
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}
`;

const ATLAS_FRAG = /* glsl */`
uniform sampler2D uAtlas;
varying vec2 vAtlasCoord;
varying vec2 vTileUV;

// We need the atlas cell parameters to correctly map our cropped tile UV
// back into the atlas. We can extract it from vAtlasCoord, or we can just pass
// them from the vertex shader inside a varying.
varying vec4 vCellRect; // xy = offset, zw = scale

void main() {
  float borderX = 0.04;
  float borderY = 0.05;
  
  if (vTileUV.x < borderX || vTileUV.x > 1.0 - borderX ||
      vTileUV.y < borderY || vTileUV.y > 1.0 - borderY) {
    gl_FragColor = vec4(0.72, 0.53, 0.12, 1.0); // #b88820 gold border
  } else {
    // 1:1 image mapped onto a 1:1.35 tall plane.
    // We want the image to look unstretched (preserve aspect ratio).
    // This means we only want to show a 1:1.35 horizontal slice of the original square image.
    // i.e., crop off the left and right edges.
    
    float cx = vTileUV.x - 0.5;
    float croppedU = 0.5 + cx * 1.35;
    
    // Clamp to border limits so we don't sample outside the cell
    croppedU = clamp(croppedU, 0.0, 1.0);
    
    // Re-map the corrected U coordinate back into the specific Atlas Cell
    vec2 finalCoord;
    finalCoord.x = vCellRect.x + croppedU * vCellRect.z;
    finalCoord.y = vAtlasCoord.y; // Y is perfectly 1:1 mapped, leave it alone
    
    gl_FragColor = texture2D(uAtlas, finalCoord);
  }
  #include <colorspace_fragment>
}
`;

// X-axis unit vector (pre-allocated for quaternion rotation)
const X_AXIS = new THREE.Vector3(1, 0, 0);

// ─── Minimal LOD: InstancedMesh + Texture Atlas (one draw call) ───────────

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
  // True once a pre-built /atlas/schizodio-atlas.webp has been drawn — skip per-image loading
  const prebuiltLoadedRef = useRef(false);

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

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.translate(0, 0.5, 0); // Origin at bottom center
    return geo;
  }, []);

  // ── Atlas construction using unified ImageCache ──────────────────────────
  useEffect(() => {
    if (!characters || characters.length === 0) return;
    console.log(`[MinimalGrid] Mounting with ${characters.length} characters`);

    // Build stable index map: character.id → atlas cell index
    const indexMap = new Map<string, number>();
    characters.forEach((c, i) => indexMap.set(c.id, i));
    charIndexMapRef.current = indexMap;

    // Create atlas
    const atlas = new TextureAtlas(characters.length, 128);
    atlasRef.current = atlas;
    prebuiltLoadedRef.current = false;

    // Bind atlas texture to shader uniform
    material.uniforms.uAtlas.value = atlas.texture;

    // Fill all cells from unified cache or procedural fallback
    for (let i = 0; i < characters.length; i++) {
      const char = characters[i];

      // Check unified cache first (may have been loaded by React UI)
      const cachedImage = ImageCache.get(char.id);
      if (cachedImage) {
        atlas.drawCell(i, cachedImage);
        continue;
      }

      // Check procedural cache
      const proceduralCanvas = ImageCache.getProcedural(char.id);
      if (proceduralCanvas) {
        atlas.drawCell(i, proceduralCanvas);
        continue;
      }

      // Fallback to solid color
      const hue = idToHue(char.id);
      const hsl = `hsl(${Math.round(hue)}, 70%, 55%)`;
      atlas.fillCell(i, hsl);
    }

    // Batch-render procedural portraits into atlas cells (for characters not yet cached)
    let procIdx = 0;
    let rafId = 0;
    let procCancelled = false;
    const PROC_BATCH = 50;

    function renderProceduralBatch() {
      if (procCancelled) return;
      const end = Math.min(procIdx + PROC_BATCH, characters.length);
      for (; procIdx < end; procIdx++) {
        const char = characters[procIdx];
        if (!ImageCache.has(char.id) && !ImageCache.getProcedural(char.id)) {
          const canvas = renderPortraitCanvas(char, undefined, true);
          ImageCache.setProcedural(char.id, canvas);
          atlas.drawCell(procIdx, canvas);
        }
      }
      // Mark dirty once per batch (not per cell)
      atlas.markDirty();
      if (procIdx < characters.length) {
        rafId = requestAnimationFrame(renderProceduralBatch);
      }
    }
    // Try loading pre-built static atlas first — start immediately so the browser
    // can fetch it (or pull it from cache) before the procedural batch begins.
    const prebuilt = new Image();
    let procTimeout: ReturnType<typeof setTimeout> | null = null;

    prebuilt.onload = () => {
      console.log('[MinimalGrid] Static atlas image loaded successfully');
      if (!procCancelled && atlasRef.current === atlas) {
        procCancelled = true;
        if (procTimeout !== null) { clearTimeout(procTimeout); procTimeout = null; }
        cancelAnimationFrame(rafId);
        atlas.drawFull(prebuilt);
        ImageCache.clearProcedural(); // free ~16 MB of procedural canvases
        prebuiltLoadedRef.current = true;
      }
    };
    prebuilt.onerror = (e) => {
      console.error('[MinimalGrid] Failed to load static atlas:', e);
    };
    prebuilt.crossOrigin = 'anonymous';
    prebuilt.src = '/atlas/schizodio-atlas.webp';

    // Delay the procedural fallback by 500ms — a cached WebP loads in < 50ms, so
    // on round 2 the atlas wins and procedural portraits never flash on screen.
    procTimeout = setTimeout(() => {
      procTimeout = null;
      if (!procCancelled) rafId = requestAnimationFrame(renderProceduralBatch);
    }, 500);

    return () => {
      procCancelled = true;
      if (procTimeout !== null) { clearTimeout(procTimeout); procTimeout = null; }
      cancelAnimationFrame(rafId);
      atlas.dispose();
      atlasRef.current = null;
    };
  }, [characters, material]);

  // ── Progressive NFT image loading via unified ImageCache ─────────────────
  useEffect(() => {
    if (!characters || characters.length === 0) return;

    let cancelled = false;

    const loadImages = async () => {
      // Wait for atlas to be ready; also allows pre-built atlas time to load
      await new Promise(r => setTimeout(r, 300));
      // If pre-built atlas loaded successfully, it already has all 999 NFT images — skip
      if (prebuiltLoadedRef.current) return;

      // Load via unified cache (deduplicates with React UI loads)
      await ImageCache.batchLoad(
        characters.map(c => ({ id: c.id, imageUrl: (c as any).imageUrl })),
        { batchSize: 20, batchDelay: 80 }
      );

      // Update atlas with newly loaded images
      if (cancelled || !atlasRef.current) return;

      for (let i = 0; i < characters.length; i++) {
        const char = characters[i];
        const image = ImageCache.get(char.id);
        if (image) {
          // Check if this is a real image (not procedural)
          const isProcedural = ImageCache.getProcedural(char.id) === image;
          if (!isProcedural) {
            atlasRef.current.drawCell(i, image);
          }
        }
      }
      atlasRef.current.markDirty();
    };

    loadImages();
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
          flipAngle: isEliminated ? -Math.PI / 2.2 : -0.35,
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
        // Revive tiles no longer eliminated (player switch or game reset)
        if (!isEliminated && (st.phase === 'dead' || st.phase === 'shrinking')) {
          const [tx, tz] = target ?? [0, 0];
          st.phase = 'alive';
          st.scale = 1;
          st.flipAngle = 0;
          st.flipDelay = 0;
          st.flipTimer = 0;
          st.x = tx; st.z = tz; st.tx = tx; st.tz = tz;
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

      // Position + Rotation lerp for alive tiles
      if (st.phase === 'alive') {
        st.x = lerp(st.x, st.tx, tPos);
        st.z = lerp(st.z, st.tz, tPos);
        st.flipAngle = lerp(st.flipAngle, -0.35, tFlip);
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
        geometry={geometry}
      >
      </instancedMesh>
    </group>
  );
}

// ─── Standard LOD: individual CharacterTile components ──────────────────────

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
  const mySecretId = useSecretCharacterId(myPlayerKey);

  const groupRefs = useRef<Map<string, THREE.Group>>(new Map());
  const pivotRefs = useRef<Map<string, THREE.Group>>(new Map());
  const animRef = useRef<Map<string, TileAnim>>(new Map());

  const activeChars = useMemo(() => {
    const elimSet = new Set(eliminatedIds);
    return characters.filter((c) => !elimSet.has(c.id) && c.id !== mySecretId);
  }, [characters, eliminatedIds, mySecretId]);
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
      const isEliminated = elimSet.has(char.id) || char.id === mySecretId;
      const target = targets.get(char.id);

      if (!existing.has(char.id)) {
        const [tx, tz] = target ?? [0, 0];
        existing.set(char.id, {
          id: char.id, x: tx, z: tz, tx, tz,
          scale: 1, targetScale: 1,
          flipAngle: isEliminated ? -Math.PI / 2.2 : -0.35,
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
          st.flipAngle = -0.35;
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
          if (pivot) pivot.rotation.x = -0.35;
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

      // Position + Rotation lerp for alive tiles
      if (st.phase === 'alive') {
        st.x = lerp(st.x, st.tx, tPos);
        st.z = lerp(st.z, st.tz, tPos);
        st.flipAngle = lerp(st.flipAngle, -0.35, tFlip);
        const pivot = pivotRefs.current.get(st.id);
        if (pivot) pivot.rotation.x = st.flipAngle;
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
                  const isElim = elimSet.has(char.id) || char.id === mySecretId;
                  animRef.current.set(char.id, {
                    id: char.id, x: tx, z: tz, tx, tz,
                    scale: isElim ? 0 : 1, targetScale: isElim ? 0 : 1,
                    flipAngle: isElim ? -Math.PI / 2.2 : -0.35, phase: isElim ? 'dead' : 'alive',
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

// Re-export proceduralCanvasCache for backward compatibility
export { proceduralCanvasCache } from '@/shared/services/ImageCache';
