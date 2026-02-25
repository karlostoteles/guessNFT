import { useMemo } from 'react';
import { CHARACTERS } from '../data/characters';
import { renderPortrait } from '../canvas/PortraitRenderer';

/**
 * Generates 2D preview data URLs for all characters.
 * Used in UI panels (character select, guess panel) where we need
 * 2D thumbnails rather than Three.js textures.
 */
export function useCharacterPreviews(): Map<string, string> {
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const char of CHARACTERS) {
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
  }, []);
}
