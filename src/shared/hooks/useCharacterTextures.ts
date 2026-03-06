import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Returns a texture map for all game characters.
 *
 * LOD-aware strategy:
 *  minimal (tileW < 0.38) → no textures; CharacterGrid renders coloured planes
 *  flat/full              → procedural portrait → async upgrade from local /nft/ images
 *
 * Local images are same-origin (no CORS), loaded from public/nft/{tokenId}.png
 * after running `node scripts/download-nft-images.mjs`.
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
          hair_color: 'black',
          hair_style: 'short',
          skin_tone: 'medium',
          eye_color: 'brown',
          gender: 'male',
          has_glasses: false,
          has_hat: false,
          has_beard: false,
          has_earrings: false
        } as any
      }, undefined, true);

      const map = new Map<string, THREE.Texture>();
      for (const char of characters) {
        map.set(char.id, placeholder);
      }
      setTextures(map);

      return () => {
        placeholder.dispose();
      };
    }

    // Small boards: generate individual procedural textures immediately
    const map = new Map<string, THREE.Texture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char, undefined, false));
    }
    setTextures(map);

    return () => {
      for (const texture of map.values()) {
        texture.dispose();
      }
    };
  }, [isMinimal, characters, isLargeBoard]);

  // 2. Async upgrade: load local /nft/{tokenId}.png images (same-origin, no CORS)
  useEffect(() => {
    if (isMinimal || !characters || characters.length === 0) return;

    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const BATCH_SIZE = 20;
    const DELAY = 50; // Small delay between batches to avoid frame hitches

    const loadBatches = async () => {
      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);
        const newTextures = new Map<string, THREE.Texture>();

        await Promise.all(
          batch.map(async (char) => {
            // Extract numeric ID from "nft_123" format
            const numericId = char.id.replace('nft_', '');
            const localUrl = `/nft/${numericId}.png`;

            try {
              const texture = await new Promise<THREE.Texture>((resolve, reject) => {
                loader.load(
                  localUrl,
                  (tex) => {
                    tex.colorSpace = THREE.SRGBColorSpace;
                    tex.needsUpdate = true;
                    resolve(tex);
                  },
                  undefined,
                  reject
                );
              });

              if (cancelled) {
                texture.dispose();
                return;
              }

              newTextures.set(char.id, texture);
            } catch {
              // Local image not available — keep procedural portrait
            }
          })
        );

        if (cancelled) break;

        if (newTextures.size > 0) {
          setTextures((prev) => {
            const next = new Map(prev);
            for (const [id, tex] of newTextures) {
              next.set(id, tex);
            }
            return next;
          });
        }

        await new Promise(r => setTimeout(r, DELAY));
      }
    };

    loadBatches();

    return () => {
      cancelled = true;
    };
  }, [characters, isMinimal]);

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
