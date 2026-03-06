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

  // NOTE: Real NFT images cannot be loaded into WebGL textures because
  // the external asset server (v1assets.schizod.io) does not send CORS headers.
  // Three.js TextureLoader requires CORS to upload cross-origin images to the GPU.
  // The Board panel (GuessPanel) shows real NFT art via standard <img> tags instead.

  return textures;
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
