import { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Extract the image hash from a schizodio URL.
 * Input:  "https://v1assets.schizod.io/images/revealed/5b377cf6...png"
 * Output: "5b377cf6..."
 */
function extractImageHash(url: string): string | null {
  const match = url.match(/\/([a-f0-9]+)\.png$/i);
  return match ? match[1] : null;
}

const globalTextureCache = new Map<string, THREE.Texture>();

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

  // Track all async loaded textures during THIS effect so we can potentially clean them up if needed
  // However we now keep them globally so they avoid reloading 
  // 2. Async upgrade: load real art
  useEffect(() => {
    if (isMinimal || !characters || characters.length === 0) return;

    let cancelled = false;
    const BATCH_SIZE = 20;
    const BATCH_DELAY = 80;
    const IMG_SIZE = 64; // Small for WebGL tiles — saves GPU memory

    function loadImageAsTexture(url: string): Promise<THREE.CanvasTexture | null> {
      return new Promise((resolve) => {
        const img = new Image();
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
            resolve(null);
          }
        };
        img.onerror = () => resolve(null);
        setTimeout(() => resolve(null), 12000);
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
            if (globalTextureCache.has(char.id)) return;

            const numericId = char.id.replace('nft_', '');

            // Fast path: use image hash directly (skips metadata fetch)
            const hash = char.imageUrl ? extractImageHash(char.imageUrl) : null;
            const urls = [
              hash ? `/api/nft-img?hash=${hash}` : null,
              `/nft/${numericId}.png`,           // local (from download pipeline)
              `/api/nft-art/${numericId}`,        // slow fallback (metadata + image)
            ].filter(Boolean) as string[];

            for (const url of urls) {
              const texture = await loadImageAsTexture(url);
              if (texture && !cancelled) {
                globalTextureCache.set(char.id, texture);
                batchTextures.set(char.id, texture);
                break;
              } else if (texture) {
                texture.dispose();
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
    return () => {
      cancelled = true;
      // We purposefully DO NOT dispose them off the GPU because 
      // they remain in globalTextureCache for instant restoration
    };
  }, [characters, isMinimal]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
