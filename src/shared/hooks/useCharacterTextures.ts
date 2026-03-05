import { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters, useActivePlayer, useEliminatedIds } from '@/core/store/selectors';
import { renderPortrait, renderCardBack } from '@/rendering/canvas/PortraitRenderer';
import { getTileLOD } from '@/core/rules/constants';

/**
 * Returns a texture map for all game characters.
 *
 * LOD-aware strategy:
 *  minimal (tileW < 0.38) → no textures; CharacterGrid renders coloured planes via InstancedMesh
 *  flat    (tileW < 1.0)  → low-res procedural placeholder → throttled real NFT images
 *  full    (tileW ≥ 1.0)  → high-res procedural portrait → async real NFT image upgrade
 */
export function useCharacterTextures(tileW: number = 1.4): Map<string, THREE.Texture> {
  const characters = useGameCharacters() || [];
  const lod = getTileLOD(tileW);
  const isMinimal = lod === 'minimal';
  const isLargeBoard = characters.length > 100;

  const [textures, setTextures] = useState<Map<string, THREE.Texture>>(new Map());

  // 1. Build initial textures (Instant Placeholders for large boards)
  useEffect(() => {
    if (isMinimal) {
      setTextures(new Map());
      return;
    }

    if (isLargeBoard) {
      // Create ONE shared low-res placeholder to avoid 1000 canvas creations
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

  const activePlayer = useActivePlayer();
  const eliminatedIds = useEliminatedIds(activePlayer);
  const remainingCount = characters.length - (eliminatedIds?.length || 0);

  // 2. Async: Upgrade to real NFT images with THROTTLING and BATCHED UPDATES
  useEffect(() => {
    // LOD Gating: Only load real images in individual mode
    if (lod === 'minimal' || !characters || characters.length === 0) return;

    let cancelled = false;
    const BATCH_SIZE = 12;
    const DELAY = 150;

    const loadBatches = async () => {
      for (let i = 0; i < characters.length; i += BATCH_SIZE) {
        if (cancelled) break;
        const batch = characters.slice(i, i + BATCH_SIZE);
        const newTextures = new Map<string, THREE.Texture>();

        await Promise.all(
          batch.map(async (char) => {
            // Use character imageUrl directly (populated from schizodio.json in collectionService)
            const imageUrl = char.imageUrl;
            if (!imageUrl) return;

            try {
              const img = await loadImage(imageUrl);
              if (cancelled) return;

              // Force isLargeBoard false for Schizodio mode to avoid low-res resizing
              // if the board is massive, unless we want to keep it.
              // Actually, renderPortrait uses isLargeBoard to decide canvas size.
              const texture = renderPortrait(char, img, isLargeBoard);
              newTextures.set(char.id, texture);
            } catch (err) {
              // Fail silently, character keeps placeholder
            }
          })
        );

        if (cancelled) break;

        // Single atomic state update per batch to keep PC cool & UI smooth
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
  }, [characters, lod, isLargeBoard]);

  return textures;
}

/** Helper to load image with promise */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
  });
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
