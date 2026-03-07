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
import { BarretenbergSync } from '@aztec/bb.js';

const STORAGE_KEY = 'whoiswho_commitments';

export interface Commitment {
  playerId: 'player1' | 'player2';
  characterId: string;
  salt: string;          // hex string
  commitment: string;    // hex Pedersen hash (commit-reveal)
  zkCommitment?: string; // hex Poseidon2 BN254 hash (ZK proofs) — u256
  gameSessionId: string;
}

/**
 * Generate a cryptographically random salt guaranteed to be within the
 * Stark field: 0 <= salt < P  (P ≈ 2^251.58).
 *
 * Generate 32 raw bytes then reduce mod P — this keeps the full entropy
 * distribution while preventing the "PedersenArg should be 0 <= value <
 * CURVE.P" crash that starknet.js throws when the salt exceeds the prime.
 */
const STARK_PRIME = BigInt('0x800000000000011000000000000000000000000000000000000000000000001');

/**
 * Rejection-sampled salt: uniform in [0, STARK_PRIME) with zero modulo bias.
 */
function generateSalt(): string {
  while (true) {
    const bytes = crypto.getRandomValues(new Uint8Array(32));
    const val = bytes.reduce((acc, b) => (acc << 8n) | BigInt(b), 0n);
    if (val < STARK_PRIME) return '0x' + val.toString(16);
  }
}

// ─── Poseidon2 BN254 helpers (matches hash4 / hash5 in Noir circuit) ────────

function toBE32(n: bigint): Uint8Array {
  const buf = new Uint8Array(32);
  let v = n;
  for (let i = 31; i >= 0; i--) { buf[i] = Number(v & 0xffn); v >>= 8n; }
  return buf;
}

function fromBE32(bytes: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i++) v = (v << 8n) | BigInt(bytes[i]);
  return v;
}

function add32(a: Uint8Array, b: Uint8Array): Uint8Array {
  const va = fromBE32(a);
  const vb = fromBE32(b);
  return toBE32(va + vb);
}

const ZERO_32 = new Uint8Array(32);

let bbInstance: BarretenbergSync | null = null;
async function getBB(): Promise<BarretenbergSync> {
  if (!bbInstance) {
    await BarretenbergSync.initSingleton();
    bbInstance = BarretenbergSync.getSingleton();
  }
  return bbInstance;
}

/**
 * Poseidon2 BN254 commitment: hash4(game_id, player, character_id, salt).
 * Matches the circuit's `hash4()` exactly.
 * Returns bigint (stored as u256 on Starknet).
 */
export async function computeZKCommitment(
  gameId: bigint,
  player: bigint,
  characterId: bigint,
  salt: bigint,
): Promise<bigint> {
  const bb = await getBB();
  // hash4: perm([a, b, c, 0]) → mid; perm([mid[0]+d, mid[1], mid[2], mid[3]])[0]
  const mid = bb.poseidon2Permutation({
    inputs: [toBE32(gameId), toBE32(player), toBE32(characterId), ZERO_32],
  });
  const result = bb.poseidon2Permutation({
    inputs: [add32(mid.outputs[0], toBE32(salt)), mid.outputs[1], mid.outputs[2], mid.outputs[3]],
  });
  return fromBE32(result.outputs[0]);
}

/**
 * Convert a string character ID to a felt252-compatible value.
 * We hash the string to get a numeric felt.
 */
export function characterIdToFelt(characterId: string): string {
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

/**
 * Convert app character IDs to the circuit's 0-based character index:
 * - "nft_1"   -> 0
 * - "nft_999" -> 998
 * - "42"      -> 42 (already numeric)
 */
function characterIdToCircuitId(characterId: string): bigint {
  if (characterId.startsWith('nft_')) {
    const tokenId = Number.parseInt(characterId.slice(4), 10);
    if (!Number.isFinite(tokenId) || tokenId < 1) {
      throw new Error(`Invalid NFT character id: ${characterId}`);
    }
    return BigInt(tokenId - 1);
  }
  return BigInt(characterId);
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

  const all = loadAll().filter(
    (x) => !(x.playerId === playerId && x.gameSessionId === gameSessionId)
  );
  saveAll([...all, c]);

  console.log(`[commitReveal] Committed ${playerId} character #${characterId}`, {
    commitment,
    salt: import.meta.env.DEV ? salt : '***',
  });

  return c;
}

/**
 * Create commitment with ZK commitment (for NFT/online mode).
 * Computes both Pedersen (commit-reveal) and Poseidon2 BN254 (ZK proofs).
 */
export async function createCommitmentWithZK(
  playerId: 'player1' | 'player2',
  characterId: string,
  gameSessionId: string,
  gameId: bigint,
  playerAddress: bigint,
): Promise<Commitment> {
  const c = createCommitment(playerId, characterId, gameSessionId);

  const numericId = characterIdToCircuitId(characterId);

  const zkHash = await computeZKCommitment(
    gameId,
    playerAddress,
    numericId,
    BigInt(c.salt),
  );
  c.zkCommitment = '0x' + zkHash.toString(16);

  // Re-save with zkCommitment
  const all = loadAll().filter(
    (x) => !(x.playerId === playerId && x.gameSessionId === gameSessionId)
  );
  saveAll([...all, c]);

  return c;
}

/**
 * Add/update zkCommitment on an existing stored commitment, reusing the same salt.
 * Safe to call repeatedly; no-op if the stored zkCommitment already matches.
 */
export async function ensureZKCommitment(
  playerId: 'player1' | 'player2',
  gameSessionId: string,
  gameId: bigint,
  playerAddress: bigint,
): Promise<Commitment> {
  const all = loadAll();
  const idx = all.findIndex((c) => c.playerId === playerId && c.gameSessionId === gameSessionId);
  if (idx < 0) {
    throw new Error(`No stored commitment for ${playerId} in session ${gameSessionId}`);
  }

  const c = all[idx];
  const numericId = characterIdToCircuitId(c.characterId);
  const zkHash = await computeZKCommitment(gameId, playerAddress, numericId, BigInt(c.salt));
  const zkHex = '0x' + zkHash.toString(16);

  if (c.zkCommitment === zkHex) {
    return c;
  }

  const updated: Commitment = { ...c, zkCommitment: zkHex };
  const next = [...all];
  next[idx] = updated;
  saveAll(next);
  return updated;
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

