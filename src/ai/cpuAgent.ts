/**
 * CPU Opponent Agent for WhoisWho.
 *
 * Strategy: binary search — always picks the question that splits
 * remaining characters as close to 50/50 as possible.
 *
 * Calls game store actions directly after a human-like delay.
 */
import { useGameStore } from '../store/gameStore';
import { SCHIZODIO_QUESTIONS, SchizodioQuestion } from '../data/schizodioQuestions';
import { evaluateBit } from '../utils/evaluateBit';
import type { Character } from '../data/characters';
import { getCachedCollectionData } from '../starknet/collectionData';

const CPU_THINK_DELAY = 1200;  // ms before CPU asks a question
const CPU_RISK_DELAY = 900;    // ms before CPU risks a guess

function getNftBitmap(characterId: string): [string, string, string, string] | null {
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
 * Pick the question that eliminates closest to 50% of remaining characters.
 * Avoids questions already asked.
 */
function pickBestQuestion(
  remaining: Character[],
  askedIds: Set<number>
): SchizodioQuestion | null {
  const available = SCHIZODIO_QUESTIONS.filter((q) => !askedIds.has(q.id));
  if (available.length === 0) return null;

  let best: SchizodioQuestion = available[0];
  let bestScore = Infinity;

  for (const q of available) {
    let yesCount = 0;
    for (const c of remaining) {
      const bitmap = getNftBitmap(c.id);
      if (bitmap && evaluateBit(bitmap, q.id)) yesCount++;
    }
    const noCount = remaining.length - yesCount;
    // Score = imbalance. 0 = perfect 50/50 split
    const score = Math.abs(yesCount - noCount);
    if (score < bestScore) {
      bestScore = score;
      best = q;
    }
  }

  return best;
}

/**
 * Check if CPU is confident enough to Risk It.
 * Returns the character ID to guess, or null if not confident.
 */
function shouldRiskIt(remaining: Character[]): string | null {
  // Risk It when only 1 character left — guaranteed win
  if (remaining.length === 1) return remaining[0].id;
  // Also risk it when down to 2 with 60% confidence (random chance for fun)
  if (remaining.length === 2 && Math.random() < 0.35) return remaining[Math.floor(Math.random() * 2)].id;
  return null;
}

/**
 * Execute one CPU turn. Call this when phase === QUESTION_SELECT and
 * activePlayer === 'player2' (the CPU).
 */
export function executeCPUTurn() {
  const store = useGameStore.getState();
  const { characters, players, questionHistory } = store;

  // CPU is always player2
  const cpuEliminated = players.player2.eliminatedCharacterIds;
  const remaining = characters.filter((c) => !cpuEliminated.includes(c.id));

  // Already-asked question IDs (by CPU this game)
  const askedIds = new Set(
    questionHistory.filter((q) => q.askedBy === 'player2').map((q) => q.questionId)
  );

  // Check if CPU should risk it first
  const riskTarget = shouldRiskIt(remaining);
  if (riskTarget) {
    setTimeout(() => {
      const s = useGameStore.getState();
      if (s.activePlayer !== 'player2') return;
      s.startGuess();
      setTimeout(() => {
        const s2 = useGameStore.getState();
        s2.makeGuess(riskTarget);
      }, CPU_RISK_DELAY);
    }, CPU_THINK_DELAY);
    return;
  }

  // Otherwise ask the best question
  const question = pickBestQuestion(remaining, askedIds);
  if (!question) return;

  setTimeout(() => {
    const s = useGameStore.getState();
    if (s.activePlayer !== 'player2') return;
    s.askQuestion(question.id);
  }, CPU_THINK_DELAY);
}
