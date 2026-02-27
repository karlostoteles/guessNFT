/**
 * Commit-Reveal scheme for WhoisWho on Starknet.
 *
 * How it works:
 *   1. COMMIT:  player picks a character, generates random salt.
 *               commitment = pedersen_hash(character_id_felt, salt)
 *               Phase 1 (local):  commitment stored in localStorage
 *               Phase 2 (on-chain): tx call game_contract.commit_character(commitment)
 *
 *   2. PLAY:    questions/answers happen. Neither player can change their character
 *               after committing because they don't know the salt the other used.
 *
 *   3. REVEAL:  at game end, each player reveals (character_id, salt).
 *               Phase 1: verify hash(character_id, salt) === stored_commitment
 *               Phase 2: game_contract.reveal_character(char_id, salt) — contract verifies
 *
 * This file is Phase 1: fully local, no contract. The API surface matches what Phase 2
 * will look like, so wiring up the contract later is a drop-in replacement.
 *
 * Cryptographic note:
 *   Starknet uses Pedersen hash natively. Here we use a JS Pedersen from starknet.js
 *   so commitments are compatible with what the future Cairo contract will verify.
 */
import { hash } from 'starknet';

const STORAGE_KEY = 'whoiswho_commitments';

export interface Commitment {
  playerId: 'player1' | 'player2';
  characterId: string;
  salt: string;        // hex string, 32 bytes
  commitment: string;  // hex Pedersen hash
  gameSessionId: string;
}

/** Generate a cryptographically random 32-byte salt as hex */
function generateSalt(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return '0x' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Convert a string character ID to a felt252-compatible value.
 * We hash the string to get a numeric felt.
 */
function characterIdToFelt(characterId: string): string {
  // Encode string as bytes, then take modulo of the Starknet field prime
  let val = BigInt(0);
  for (let i = 0; i < characterId.length; i++) {
    val = (val * BigInt(256) + BigInt(characterId.charCodeAt(i))) %
      BigInt('0x800000000000011000000000000000000000000000000000000000000000001'); // Stark prime
  }
  return '0x' + val.toString(16);
}

/**
 * Compute the commitment: pedersen(character_id_felt, salt).
 * This matches what the Cairo contract will compute:
 *   let commitment = pedersen(char_felt, salt);
 */
function computeCommitment(characterIdFelt: string, salt: string): string {
  return hash.computePedersenHash(characterIdFelt, salt);
}

// ─── Phase 1 API (local storage) ─────────────────────────────────────────────

function loadAll(): Commitment[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveAll(commitments: Commitment[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(commitments));
}

/**
 * Create and store a commitment for a player's character choice.
 * Call this immediately when the player selects their secret character.
 * Returns the commitment object (store the salt securely until reveal).
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

  // Store locally (Phase 1). Phase 2: also call game_contract.commit_character(commitment)
  const all = loadAll().filter(
    (x) => !(x.playerId === playerId && x.gameSessionId === gameSessionId)
  );
  saveAll([...all, c]);

  console.log(`[commitReveal] Committed ${playerId} character #${characterId}`, {
    commitment,
    // Never log salt in production — shown here for Phase 1 dev visibility
    salt: import.meta.env.DEV ? salt : '***',
  });

  return c;
}

/**
 * Verify a reveal: checks that hash(characterId, salt) === stored commitment.
 * Returns true if valid, false if tampered.
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
    console.warn('[commitReveal] No stored commitment found for', playerId);
    return false;
  }

  const characterIdFelt = characterIdToFelt(characterId);
  const recomputed = computeCommitment(characterIdFelt, salt);
  const valid = recomputed === stored.commitment;

  if (!valid) {
    console.error('[commitReveal] COMMITMENT MISMATCH — possible cheating!', {
      stored: stored.commitment,
      recomputed,
    });
  }

  return valid;
}

/**
 * Retrieve the stored commitment for a player (includes salt for reveal).
 */
export function getCommitment(
  playerId: 'player1' | 'player2',
  gameSessionId: string
): Commitment | null {
  return loadAll().find((c) => c.playerId === playerId && c.gameSessionId === gameSessionId) ?? null;
}

/**
 * Clear commitments for a finished game session.
 */
export function clearCommitments(gameSessionId: string) {
  saveAll(loadAll().filter((c) => c.gameSessionId !== gameSessionId));
}

/**
 * Generate a unique game session ID.
 */
export function generateGameSessionId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// ─── Phase 2 stubs (on-chain) ─────────────────────────────────────────────────
// When the Cairo contract is deployed, replace the Phase 1 localStorage calls above
// with these Starknet transaction calls. The commitment value stays identical.

/**
 * [Phase 2 stub] Submit commitment on-chain.
 * Replace localStorage with a contract call:
 *
 *   const account = cartridgeController.getAccount();
 *   await account.execute([{
 *     contractAddress: GAME_CONTRACT,
 *     entrypoint: 'commit_character',
 *     calldata: [gameId, commitment],
 *   }]);
 */
export async function submitCommitmentOnChain(
  _commitment: string,
  _gameId: string
): Promise<string> {
  throw new Error(
    '[Phase 2] Contract not deployed yet. Set GAME_CONTRACT in config.ts and implement this function.'
  );
}

/**
 * [Phase 2 stub] Reveal character on-chain.
 *
 *   await account.execute([{
 *     contractAddress: GAME_CONTRACT,
 *     entrypoint: 'reveal_character',
 *     calldata: [gameId, characterIdFelt, salt],
 *   }]);
 */
export async function revealCharacterOnChain(
  _characterId: string,
  _salt: string,
  _gameId: string
): Promise<string> {
  throw new Error(
    '[Phase 2] Contract not deployed yet. Set GAME_CONTRACT in config.ts and implement this function.'
  );
}
