import { useMemo } from 'react';
import * as THREE from 'three';
import { CHARACTERS } from '../data/characters';
import { renderPortrait, renderCardBack } from '../canvas/PortraitRenderer';

export function useCharacterTextures(): Map<string, THREE.CanvasTexture> {
  return useMemo(() => {
    const map = new Map<string, THREE.CanvasTexture>();
    for (const char of CHARACTERS) {
      map.set(char.id, renderPortrait(char));
    }
    return map;
  }, []);
}

export function useCardBackTexture(): THREE.CanvasTexture {
  return useMemo(() => renderCardBack(), []);
}
