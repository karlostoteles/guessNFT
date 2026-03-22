/**
 * Commit-Reveal for guessNFT on Starknet.
 *
 * Flow:
 *   1. COMMIT — player picks a character, generates random salt.
 *              commitment = pedersen(characterIdFelt, salt)
 *              Stored locally + submitted on-chain via commit(game_id, commitment)
 *
 *   2. PLAY  — questions/answers happen off-chain (Supabase).
 *
 *   3. REVEAL — at game end, player reveals (character_id, salt).
 *              Contract verifies pedersen(character_id, salt) == stored commitment.
 *
 * starknet.js computePedersenHash matches Cairo's core::pedersen::pedersen.
 */
import { hash } from 'starknet';
import { getAccount } from './sdk';
import { GAME_CONTRACT } from './config';

const STORAGE_KEY = 'guessnft_commitments';

export interface Commitment {
  playerId: 'player1' | 'player2';
  characterId: string;
  salt: string;        // hex string
  commitment: string;  // hex Pedersen hash
  gameSessionId: string;
}

// ─── Crypto helpers ──────────────────────────────────────────────────────────

const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000001');

function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const raw = BigInt('0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(''));
  return '0x' + (raw % STARK_PRIME).toString(16);
}

/** Encode a string as a felt252 (byte-fold mod Stark prime). */
export function stringToFelt(s: string): string {
  let val = BigInt(0);
  for (let i = 0; i < s.length; i++) {
    val = (val * BigInt(256) + BigInt(s.charCodeAt(i))) % STARK_PRIME;
  }
  return '0x' + val.toString(16);
}

/** @deprecated Use stringToFelt instead */
export const characterIdToFelt = stringToFelt;

function computeCommitment(characterIdFelt: string, salt: string): string {
  return hash.computePedersenHash(characterIdFelt, salt);
}

// ─── Local storage ───────────────────────────────────────────────────────────

function loadAll(): Commitment[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
  catch { return []; }
}

function saveAll(commitments: Commitment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commitments));
}

/**
 * Create and store a commitment for a player's character choice.
 */
export function createCommitment(
  playerId: 'player1' | 'player2',
  characterId: string,
  gameSessionId: string
): Commitment {
  const salt = generateSalt();
  const characterIdFelt = characterIdToFelt(characterId);
  const commitment = computeCommitment(characterIdFelt, salt);

  const c: Commitment = { playerId, characterId, salt, commitment, gameSessionId };

  const all = loadAll().filter(
    (x) => !(x.playerId === playerId && x.gameSessionId === gameSessionId)
  );
  saveAll([...all, c]);
  return c;
}

/**
 * Verify a reveal client-side: hash(characterId, salt) === stored commitment.
 */
export function verifyReveal(
  playerId: 'player1' | 'player2',
  characterId: string,
  salt: string,
  gameSessionId: string
): boolean {
  const all = loadAll();
  const stored = all.find((c) => c.playerId === playerId && c.gameSessionId === gameSessionId);
  if (!stored) {
    console.warn('[commitReveal] No stored commitment for', playerId);
    return false;
  }

  const characterIdFelt = characterIdToFelt(characterId);
  const recomputed = computeCommitment(characterIdFelt, salt);
  const valid = recomputed === stored.commitment;

  if (!valid) {
    console.error('[commitReveal] COMMITMENT MISMATCH', { stored: stored.commitment, recomputed });
  }
  return valid;
}

export function getCommitment(
  playerId: 'player1' | 'player2',
  gameSessionId: string
): Commitment | null {
  return loadAll().find((c) => c.playerId === playerId && c.gameSessionId === gameSessionId) ?? null;
}

export function clearCommitments(gameSessionId: string) {
  saveAll(loadAll().filter((c) => c.gameSessionId !== gameSessionId));
}

export function generateGameSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── On-chain calls ──────────────────────────────────────────────────────────

/**
 * Submit commitment on-chain: commit(game_id, commitment_hash)
 */
export async function submitCommitmentOnChain(
  commitment: string,
  gameId: string
): Promise<string> {
  const account = getAccount();
  const gameIdFelt = stringToFelt(gameId);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit',
    calldata: [gameIdFelt, commitment],
  }]);
  return (tx as any).transaction_hash || String(tx);
}

/**
 * Reveal character on-chain: reveal(game_id, character_id_felt, salt)
 * Contract verifies pedersen(character_id, salt) == stored commitment.
 */
export async function revealCharacterOnChain(
  characterId: string,
  salt: string,
  gameId: string
): Promise<string> {
  const account = getAccount();
  const gameIdFelt = stringToFelt(gameId);
  const characterIdFelt = stringToFelt(characterId);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'reveal',
    calldata: [gameIdFelt, characterIdFelt, salt],
  }]);
  return (tx as any).transaction_hash || String(tx);
}
