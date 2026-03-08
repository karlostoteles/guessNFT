/**
 * ZK store slice — standalone ZK state and actions.
 *
 * Post-merge, these will be merged into src/core/store/gameStore.ts.
 * This file documents the exact state fields and action implementations
 * that the ZK system needs injected into the main game store.
 */
import { getCachedCollectionData } from './collectionData';
import { evaluateBit } from './evaluateBit';
import { SCHIZODIO_QUESTIONS } from './schizodioQuestions';

/**
 * Get the bitmap for an NFT character from the runtime-cached schizodio.json.
 * Character IDs in nft/online mode are "nft_1" through "nft_999".
 * schizodio.json is 0-indexed: characters[0].id === 0 corresponds to tokenId 1.
 */
export function getNftBitmap(characterId: string): [string, string, string, string] | null {
  if (!characterId.startsWith('nft_')) return null;
  const tokenId = parseInt(characterId.replace('nft_', ''), 10);
  if (isNaN(tokenId) || tokenId < 1 || tokenId > 999) return null;
  const dataset = getCachedCollectionData();
  if (!dataset) return null;
  const char = dataset.characters[tokenId - 1];
  if (!char) return null;
  return char.bitmap as [string, string, string, string];
}

/**
 * ZK-aware question lookup by numeric ID.
 * Used by receiveOpponentQuestion and askQuestion in ZK mode.
 */
export function findSchizodioQuestion(questionId: number) {
  return SCHIZODIO_QUESTIONS.find((q) => q.id === questionId) ?? null;
}

/**
 * Evaluate answer via bitmap for a given character and question.
 * Used by askQuestion (local nft mode) and advancePhase (auto-elimination).
 */
export function evaluateQuestionByBitmap(
  characterId: string,
  questionId: number,
): boolean {
  const bitmap = getNftBitmap(characterId);
  if (!bitmap) return false;
  return evaluateBit(bitmap, questionId);
}

/**
 * Auto-eliminate characters based on the answered question.
 * Returns array of character IDs that should be eliminated.
 */
export function computeAutoEliminations(
  characters: Array<{ id: string }>,
  alreadyEliminated: string[],
  questionId: number,
  answer: boolean,
): string[] {
  const toEliminate: string[] = [];
  for (const char of characters) {
    if (alreadyEliminated.includes(char.id)) continue;
    const bitmap = getNftBitmap(char.id);
    if (!bitmap) continue;
    const matchesQuestion = evaluateBit(bitmap, questionId);
    const shouldEliminate = answer ? !matchesQuestion : matchesQuestion;
    if (shouldEliminate) {
      toEliminate.push(char.id);
    }
  }
  return toEliminate;
}
