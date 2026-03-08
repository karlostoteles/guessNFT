import { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

// No longer needed: we use procedural canvases exclusively
// export const globalTextureCache = new Map<string, THREE.Texture>();

export const globalTextureCache = new Map<string, THREE.Texture>();

/**
 * Returns a texture map for all game characters.
 *
 * Strategy:
 *   1. Procedural portrait (instant)
 *   2. Async upgrade via /api/nft-img?hash=... (fast — skips metadata fetch)
 *   3. Fallback: /api/nft-art/{id} (slower — fetches metadata first)
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters() || [];
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';
  const isLargeBoard = characters.length > 100;

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(() => new Map(globalTextureCache));

  // 1. Build procedural textures
  useEffect(() => {
    if (isMinimal) return;

    if (isLargeBoard) {
      const placeholder = renderPortrait({
        id: 'placeholder', name: 'Loading...',
        traits: {
          hair_color: 'black', hair_style: 'short',
          skin_tone: 'medium', eye_color: 'brown',
          gender: 'male', has_glasses: false,
          has_hat: false, has_beard: false,
          has_earrings: false,
        } as any
      }, undefined, true);

      setTextures((prev) => {
        const next = new Map(prev);
        for (const char of characters) {
          if (!globalTextureCache.has(char.id) && !next.has(char.id)) {
            next.set(char.id, placeholder);
          } else if (globalTextureCache.has(char.id)) {
            next.set(char.id, globalTextureCache.get(char.id)!);
          }
        }
        return next;
      });
      return; // Not automatically disposing placeholder on unmount to avoid breaking cache usage later
    }

    setTextures((prev) => {
      const next = new Map(prev);
      for (const char of characters) {
        if (!globalTextureCache.has(char.id) && !next.has(char.id)) {
          const tex = renderPortrait(char, undefined, false);
          next.set(char.id, tex);
        } else if (globalTextureCache.has(char.id)) {
          next.set(char.id, globalTextureCache.get(char.id)!);
        }
      }
      return next;
    });
  }, [isMinimal, characters, isLargeBoard]);

  // We no longer do Async PNG upgrades — using procedural light versions globally!

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
