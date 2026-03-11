import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortraitCanvas, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';
import ImageCache from '@/shared/services/ImageCache';

/**
 * Returns a texture map for all game characters.
 *
 * OPTIMIZED: Uses unified ImageCache to prevent duplicate loading.
 * Images are loaded ONCE and shared between Three.js and React UI.
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters() || [];
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';
  const isLargeBoard = characters.length > 100;

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(() => new Map());

  // Build textures from cache + procedural fallbacks
  useEffect(() => {
    if (isMinimal) return;

    let cancelled = false;
    const newTextures = new Map<string, THREE.Texture>();
    const targetSize = isLargeBoard ? 128 : 256;

    // Phase 1: Instant procedural placeholders
    for (const char of characters) {
      // Check unified cache first
      const cachedTexture = ImageCache.getTexture(char.id, targetSize);
      if (cachedTexture) {
        newTextures.set(char.id, cachedTexture);
        continue;
      }

      // Check procedural cache
      const proceduralCanvas = ImageCache.getProcedural(char.id);
      if (proceduralCanvas) {
        const texture = new THREE.CanvasTexture(proceduralCanvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        newTextures.set(char.id, texture);
        continue;
      }

      // Generate procedural placeholder
      const canvas = renderPortraitCanvas(char, undefined, true);
      if (canvas instanceof HTMLCanvasElement) {
        ImageCache.setProcedural(char.id, canvas);
        const texture = new THREE.CanvasTexture(canvas);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.needsUpdate = true;
        newTextures.set(char.id, texture);
      }
    }

    if (!cancelled) {
      setTextures(newTextures);
    }

    // Phase 2: Async load real NFT images via unified cache
    const loadRealImages = async () => {
      const BATCH_SIZE = 20;
      const BATCH_DELAY = 80;

      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);

        await Promise.all(
          batch.map(async (char) => {
            if (cancelled) return;

            // Load via unified cache (deduplicated)
            const image = await ImageCache.load(char.id, (char as any).imageUrl, { size: targetSize });
            if (image && !cancelled) {
              const texture = ImageCache.getTexture(char.id, targetSize);
              if (texture) {
                setTextures(prev => {
                  const next = new Map(prev);
                  next.set(char.id, texture);
                  return next;
                });
              }
            }
          })
        );

        if (!cancelled && i + BATCH_SIZE < characters.length) {
          await new Promise(r => setTimeout(r, BATCH_DELAY));
        }
      }
    };

    loadRealImages();

    return () => {
      cancelled = true;
    };
  }, [isMinimal, characters, isLargeBoard]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}

// Re-export for backward compatibility
export { globalTextureCache } from '@/shared/services/ImageCache';
