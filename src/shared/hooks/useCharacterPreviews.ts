import { useMemo } from 'react';
import { useGameCharacters } from '@/core/store/selectors';
import { renderPortrait } from '@/rendering/canvas/PortraitRenderer';

/**
 * Generates portrait preview URLs for all characters.
 * - NFT characters with a real imageUrl → use the URL directly (real art)
 * - All others → procedural canvas data URL
 *
 * Used in UI panels (character select, guess panel) where we need
 * thumbnails rather than Three.js textures.
 */
export function useCharacterPreviews(): Map<string, string> {
  const characters = useGameCharacters();

  return useMemo(() => {
    const map = new Map<string, string>();
    // For large collections (>50 tokens), skip expensive canvas generation.
    // Characters without an imageUrl will show a colour swatch in CharacterSelectScreen.
    const skipCanvas = characters.length > 50;

    for (const char of characters) {
      // Prefer real NFT image URL when available
      const imageUrl = (char as any).imageUrl as string | undefined;
      if (imageUrl) {
        map.set(char.id, imageUrl);
        continue;
      }

      if (skipCanvas) continue; // Large collection — colour swatch used instead

      // Fall back to procedural canvas portrait (small collections only)
      const texture = renderPortrait(char);
      if (texture.image instanceof HTMLCanvasElement) {
        const small = document.createElement('canvas');
        small.width = 128;
        small.height = 128;
        const ctx = small.getContext('2d')!;
        ctx.drawImage(texture.image, 0, 0, 128, 128);
        map.set(char.id, small.toDataURL());
      }
      texture.dispose();
    }
    return map;
  }, [characters]);
}
