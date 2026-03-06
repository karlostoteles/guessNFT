import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Returns a texture map for all game characters.
 *
 * Strategy for real NFT art:
 *   1. Start with procedural portraits (instant)
 *   2. Async: load real images using HTMLImageElement → draw to Canvas → CanvasTexture
 *      This bypasses Three.js TextureLoader CORS restrictions by drawing the image
 *      to a canvas we control, then creating a texture from that canvas.
 *   3. First tries local /nft/{id}.png (same-origin, from download pipeline)
 *   4. Falls back to external URL from character.imageUrl
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters() || [];
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';
  const isLargeBoard = characters.length > 100;

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());

  // 1. Build initial procedural textures
  useEffect(() => {
    if (isMinimal) {
      setTextures(new Map());
      return;
    }

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

      const map = new Map<string, THREE.Texture>();
      for (const char of characters) {
        map.set(char.id, placeholder);
      }
      setTextures(map);
      return () => { placeholder.dispose(); };
    }

    const map = new Map<string, THREE.Texture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char, undefined, false));
    }
    setTextures(map);
    return () => {
      for (const texture of map.values()) texture.dispose();
    };
  }, [isMinimal, characters, isLargeBoard]);

  // 2. Async upgrade: load real NFT art via Image → Canvas → CanvasTexture
  useEffect(() => {
    if (isMinimal || !characters || characters.length === 0) return;

    let cancelled = false;
    const BATCH_SIZE = 15;
    const BATCH_DELAY = 100;
    const IMG_SIZE = 128; // Render at 128×128 for WebGL performance

    function loadImageAsTexture(url: string): Promise<THREE.CanvasTexture | null> {
      return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = IMG_SIZE;
            canvas.height = IMG_SIZE;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, IMG_SIZE, IMG_SIZE);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            texture.needsUpdate = true;
            resolve(texture);
          } catch {
            resolve(null); // Canvas tainted (CORS)
          }
        };
        img.onerror = () => resolve(null);
        // Timeout after 8 seconds
        setTimeout(() => resolve(null), 8000);
        img.src = url;
      });
    }

    const loadBatches = async () => {
      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);
        const batchTextures = new Map<string, THREE.Texture>();

        await Promise.all(
          batch.map(async (char) => {
            if (cancelled) return;

            const numericId = char.id.replace('nft_', '');

            // Try local first (from download pipeline), then external URL
            const urls = [
              `/nft/${numericId}.png`,
              char.imageUrl,
            ].filter(Boolean) as string[];

            for (const url of urls) {
              const texture = await loadImageAsTexture(url);
              if (texture && !cancelled) {
                batchTextures.set(char.id, texture);
                break; // Success — skip other URLs
              }
            }
          })
        );

        if (cancelled) break;

        if (batchTextures.size > 0) {
          setTextures((prev) => {
            const next = new Map(prev);
            for (const [id, tex] of batchTextures) {
              next.set(id, tex);
            }
            return next;
          });
        }

        await new Promise(r => setTimeout(r, BATCH_DELAY));
      }
    };

    loadBatches();
    return () => { cancelled = true; };
  }, [characters, isMinimal]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
