/**
 * Generates the full 999-token SCHIZODIO collection as game characters.
 *
 * Strategy:
 * - Characters are created with deterministic traits derived from token ID (no API calls).
 * - Real artwork loads lazily via the serverless proxy once tiles are large enough to see.
 * - Result is module-level memoized — only computed once per session.
 */

import type { Character } from '@/core/data/characters';
import { nftToCharacter } from '@/core/data/nftCharacterAdapter';
import type { SchizodioNFT } from './types';

export const COLLECTION_SIZE = 999;

let _cached: Character[] | null = null;

export async function generateAllCollectionCharacters(): Promise<Character[]> {
  if (_cached) return _cached;

  const chars: Character[] = [];
  for (let i = 0; i <= 999; i++) {
    const stub: SchizodioNFT = {
      tokenId: String(i),
      name: `Schizodio #${i}`,
      imageUrl: `https://v1assets.schizod.io/images/revealed/${i}.png`,
      attributes: [], // Will use deterministic fallback in nftToCharacter
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
