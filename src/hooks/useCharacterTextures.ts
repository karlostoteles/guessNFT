import { useMemo } from 'react';
import * as THREE from 'three';
import { useGameCharacters } from '../store/selectors';
import { renderPortrait, renderCardBack } from '../canvas/PortraitRenderer';

export function useCharacterTextures(): Map<string, THREE.CanvasTexture> {
  const characters = useGameCharacters();
  return useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const char of characters) {
      map.set(char.id, renderPortrait(char));
    }
    return map;
  }, [characters]);
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
