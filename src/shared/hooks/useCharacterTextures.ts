import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Returns a texture map for all game characters.
 *
 * LOD-aware strategy:
 *  minimal (tileW < 0.38) → no textures; CharacterGrid renders coloured planes via InstancedMesh
 *  flat    (tileW < 1.0)  → procedural canvas portrait; real NFT art skipped (too small to matter)
 *  full    (tileW ≥ 1.0)  → canvas portrait + async real NFT image upgrade
 *
 * At 999 tiles we create zero canvas objects → instant render, zero GC pressure.
 * As tiles grow (eliminations shrink the pool) we progressively load real artwork.
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters();
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';

  // Build initial procedural textures — only when NOT minimal LOD
  const initialTextures = useMemo(() => {
    if (isMinimal) return new Map<string, THREE.Texture>();
    const map = new Map<string, THREE.Texture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char));
    }
    return map;
    // We intentionally include isMinimal as a dep to reset textures when LOD changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMinimal, characters]);

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(initialTextures);

  // Sync procedural textures when characters change or LOD crosses the minimal threshold
  useEffect(() => {
    setTextures(initialTextures);
  }, [initialTextures]);

  // Async: upgrade to real NFT images — flat + full LOD (tiles big enough to see detail)
  useEffect(() => {
    if (lod === 'minimal') return; // too small — coloured instanced-mesh is fine

    let cancelled = false;
    const loader = new THREE.TextureLoader();

    for (const char of characters) {
      // Explicit imageUrl wins; otherwise derive from id ('nft_53' → proxy URL)
      let imageUrl = (char as any).imageUrl as string | undefined;
      if (!imageUrl && char.id.startsWith('nft_')) {
        const tokenId = char.id.replace('nft_', '');
        // Use smaller thumbnail for flat LOD tiles; full image for large tiles
        imageUrl = lod === 'full'
          ? `/api/nft-art/${tokenId}`
          : `/api/nft-art-thumb/${tokenId}`;
      }
      if (!imageUrl) continue;

      loader.load(
        imageUrl,
        (texture) => {
          if (cancelled) return;
          texture.colorSpace = THREE.SRGBColorSpace;
          texture.needsUpdate = true;
          setTextures((prev) => {
            const next = new Map(prev);
            next.set(char.id, texture);
            return next;
          });
        },
        undefined,
        () => {
          // Load failed — keep procedural canvas texture
        },
      );
    }

    return () => {
      cancelled = true;
    };
  }, [characters, lod]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
