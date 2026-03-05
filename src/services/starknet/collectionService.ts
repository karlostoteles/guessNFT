/**
 * Generates the full 999-token SCHIZODIO collection as game characters.
 *
 * Strategy:
 * - Characters are created with deterministic traits derived from token ID (no API calls).
 * - Real artwork loads lazily via the serverless proxy once tiles are large enough to see.
 * - Result is module-level memoized — only computed once per session.
 */

import type { Character } from '@/core/data/characters';
import { buildTraitsFromBitmap, deriveFreeTraits, hashString } from '@/core/data/nftCharacterAdapter';
import schizodioData from '@/core/data/schizodio.json';

export const COLLECTION_SIZE = 999;

let _cached: Character[] | null = null;

export async function generateAllCollectionCharacters(): Promise<Character[]> {
  if (_cached) return _cached;

  const { characters, question_schema } = schizodioData;
  const chars: Character[] = [];

  for (const raw of characters) {
    const seed = hashString(String(raw.id));

    // 1. Parse real NFT traits from bitmap
    const nftTraits = buildTraitsFromBitmap(raw.bitmap, question_schema);

    // 2. Derive free-mode traits (web2 fallbacks)
    const traits = deriveFreeTraits(nftTraits, seed);

    chars.push({
      id: `nft_${raw.id}`,
      name: raw.name || `Schizodio #${raw.id}`,
      imageUrl: raw.image_url,
      traits,
    });
  }

  _cached = chars;
  return chars;
}

/** Clear the cache (useful for hot-reload during development) */
export function clearCollectionCache(): void {
  _cached = null;
}
