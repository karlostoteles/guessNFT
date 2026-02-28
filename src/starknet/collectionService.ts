/**
 * Generates the full 999-token SCHIZODIO collection as game characters.
 *
 * Strategy:
 * - Characters are created with deterministic traits derived from token ID (no API calls).
 * - Real artwork loads lazily via the serverless proxy once tiles are large enough to see.
 * - Result is module-level memoized — only computed once per session.
 */

import type { Character } from '../data/characters';
import { nftToCharacter } from '../data/nftCharacterAdapter';
import type { SchizodioNFT } from './types';

export const COLLECTION_SIZE = 999;

let _cached: Character[] | null = null;

/**
 * Generate all 999 SCHIZODIO stub characters.
 * Result is memoized — subsequent calls return the same array instance.
 */
export function generateAllCollectionCharacters(): Character[] {
  if (_cached) return _cached;

  const chars: Character[] = [];
  for (let i = 1; i <= COLLECTION_SIZE; i++) {
    const stub: SchizodioNFT = {
      tokenId: String(i),
      name: `#${i}`,
      // imageUrl starts empty — will be populated lazily by useCharacterTextures
      // when tiles are large enough to warrant loading real art
      imageUrl: '',
      attributes: [],
    };
    chars.push(nftToCharacter(stub));
  }

  _cached = chars;
  return chars;
}

/** Clear the cache (useful for hot-reload during development) */
export function clearCollectionCache(): void {
  _cached = null;
}
