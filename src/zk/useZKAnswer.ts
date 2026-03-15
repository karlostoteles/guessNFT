/**
 * ZK proof generation + on-chain submission for answering questions.
 *
 * Self-contained: all imports from src/zk/ internal paths.
 * Post-merge, hook into the main store via imports from src/core/store/.
 *
 * Exports:
 *   - generateAndSubmitProof(): standalone async — callable from any context
 *   - askQuestionOnChain(): submit ask_question tx on Katana
 *   - useZKAnswer(): React hook wrapper
 *   - prewarmProver() / terminateProver(): worker lifecycle
 */
import { useCallback } from 'react';
import { RpcProvider } from 'starknet';
import {
  loadCollectionData,
  getCharacterBitmap,
  getCharacterMerklePath,
} from './collectionData';
import { GamePhase } from '@/core/store/types';
import { TRAITS_ROOT, GAME_CONTRACT, STARKNET_RPC } from './config';
import { getStarknetAccount, toFeltHex, toDecimalField, splitU256, toBigInt } from './zkSdk';

// Use our own RPC provider so waitForTransaction never touches BlastAPI (CORS blocked from localhost)
let _rpcProvider: RpcProvider | null = null;
function getRpcProvider(): RpcProvider {
  if (!_rpcProvider) _rpcProvider = new RpcProvider({ nodeUrl: STARKNET_RPC });
  return _rpcProvider;
}

async function waitForTx(txHash: string): Promise<any> {
  return getRpcProvider().waitForTransaction(txHash);
}
import type {
  ProveRequest,
  ProveResult,
  WorkerMessage,
} from './workers/prover.worker';

// ─── Singleton worker ─────────────────────────────────────────────────────────

let globalWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
  if (!globalWorker) {
    globalWorker = new Worker(
      new URL('./workers/prover.worker.ts', import.meta.url),
      { type: 'module' },
    );
  }
  return globalWorker;
}

export function prewarmProver(): void {
  getOrCreateWorker();
}

export function terminateProver(): void {
  if (globalWorker) {
    globalWorker.terminate();
    globalWorker = null;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// World contract address for the guessnft deployment (2026-03-15)
const WORLD_ADDR = '0x06c320e0058a34ee61ca91e1731388f4554d77ecfbd3a7d6a651c6f5e5f73b53';

// From onchain/manifest_mainnet.json
// StoreSetRecord for Game model: keys[1] = this selector, data = [1, game_id, ...]
const GAME_MODEL_SELECTOR   = '0x3e82c21ea0c7330d12d7d8872da6d5c07fcc3a38dac1a99157d93085fd1ce72';
// EventEmitted for GameCreated: keys[1] = this selector, data = [1, game_id, ...]
const GAME_CREATED_SELECTOR = '0x4fb5dfb0b3699a65f5e70068bd2a7eb784a41ea9748c85d1ed794c9a7df7b24';

function getExecAccount(playerNum?: 1 | 2) {
  const account = getStarknetAccount(playerNum);
  if (!account) {
    throw new Error('No Starknet account connected');
  }
  return account;
}

/**
 * Extract game_id from a create_game receipt.
 *
 * Dojo 1.8 World event layout:
 *   StoreSetRecord:  keys=[StoreSetRecord_sel, model_sel, entity_hash], data=[key_count, ...keys, val_count, ...vals]
 *   EventEmitted:    keys=[EventEmitted_sel, event_sel, system_addr],   data=[key_count, ...keys, val_count, ...vals]
 *
 * For both the Game StoreSetRecord and the GameCreated EventEmitted,
 * data[0] = 0x1 (one key) and data[1] = game_id (uuid counter).
 */
function extractGameIdFromReceipt(receipt: any): string {
  const events: any[] = receipt?.events ?? [];
  console.log('[createGame] receipt events:', JSON.stringify(
    events.map((e: any) => ({ from: e.from_address, keys: e.keys, data: e.data })),
    null, 2,
  ));

  const worldBigInt = BigInt(WORLD_ADDR);
  const worldEvents = events.filter((e: any) => {
    try { return BigInt(e.from_address) === worldBigInt; } catch { return false; }
  });

  // Primary: find the StoreSetRecord for the Game model or EventEmitted for GameCreated
  // keys[1] matches one of the known selectors → data[1] is game_id
  for (const we of worldEvents) {
    if (!Array.isArray(we.keys) || !Array.isArray(we.data)) continue;
    const k1 = we.keys[1]?.toLowerCase();
    if (k1 === GAME_MODEL_SELECTOR || k1 === GAME_CREATED_SELECTOR) {
      const gameId = we.data[1];
      if (gameId && gameId !== '0x0') {
        console.log('[createGame] game_id via data[1] (selector match):', gameId);
        return gameId;
      }
    }
  }

  // Fallback: any world event with data[0]=0x1 (one key) and a non-zero data[1]
  for (const we of worldEvents) {
    if (!Array.isArray(we.data) || we.data.length < 2) continue;
    if (we.data[0] === '0x1' && we.data[1] && we.data[1] !== '0x0') {
      console.log('[createGame] game_id via data[1] fallback:', we.data[1]);
      return we.data[1];
    }
  }

  throw new Error(
    `Unable to extract game_id from receipt.\nEvents: ${JSON.stringify(
      events.map((e: any) => ({ from: e.from_address, keys: e.keys, data: e.data })),
      null, 2,
    )}`,
  );
}

// ─── Contract calls ───────────────────────────────────────────────────────────

export async function createGameOnChain(playerNum?: 1 | 2): Promise<string> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'create_game',
    calldata: [],
  }]);
  const receipt = await waitForTx(tx.transaction_hash);
  return extractGameIdFromReceipt(receipt);
}

export async function joinGameOnChain(gameId: string, playerNum?: 1 | 2): Promise<void> {
  const account = getExecAccount(playerNum);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'join_game',
    calldata: [toFeltHex(gameId)],
  }]);
  await waitForTx(tx.transaction_hash);
}

export async function commitCharacterOnChain(
  gameId: string,
  commitmentHash: string,
  _zkCommitment?: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit_character',
    calldata: [toFeltHex(gameId), toFeltHex(commitmentHash)],
  }]);
  await waitForTx(tx.transaction_hash);
}

// ─── Standalone proof generation + on-chain submission ────────────────────────

export interface ZKAnswerOpts {
  gameId: string;
  turnId: string;
  commitment: string;
  questionId: number;
  characterId: number;
  salt: string;
  playerNum?: 1 | 2;
}

// Last proof opts for retry after error
let lastProofOpts: ZKAnswerOpts | null = null;

/**
 * Store interface — post-merge, these callbacks will be wired to the real store.
 * For now, callers must provide them.
 */
export interface ZKStoreCallbacks {
  setZkPhase: (phase: GamePhase) => void;
  clearProofError: () => void;
  setVerifiedAnswer: (answer: boolean) => void;
  setProofError: (message: string) => void;
}

// Module-level store callbacks — set by the sync hook at mount time
let storeCallbacks: ZKStoreCallbacks | null = null;

export function setZKStoreCallbacks(callbacks: ZKStoreCallbacks): void {
  storeCallbacks = callbacks;
}

function getStoreCallbacks(): ZKStoreCallbacks {
  if (!storeCallbacks) {
    throw new Error('ZK store callbacks not initialized. Call setZKStoreCallbacks() first.');
  }
  return storeCallbacks;
}

/**
 * Generate ZK proof and submit it on-chain.
 * Callable from any context (not just React hooks).
 * Manages store phases: PROVING → SUBMITTING → VERIFIED
 */
export async function generateAndSubmitProof(opts: ZKAnswerOpts): Promise<ProveResult> {
  lastProofOpts = opts;
  const store = getStoreCallbacks();
  store.setZkPhase(GamePhase.PROVING);
  store.clearProofError();

  const account = getExecAccount(opts.playerNum);
  const worker = getOrCreateWorker();
  const id = crypto.randomUUID();

  const dataset = await loadCollectionData();
  const bitmap = getCharacterBitmap(dataset, opts.characterId);
  const merkle_path = getCharacterMerklePath(dataset, opts.characterId);

  const req: ProveRequest = {
    type: 'prove',
    id,
    game_id: toDecimalField(opts.gameId),
    turn_id: toDecimalField(opts.turnId),
    player: toDecimalField(String(account.address)),
    commitment: toDecimalField(opts.commitment),
    question_id: opts.questionId,
    traits_root: toDecimalField(TRAITS_ROOT),
    character_id: opts.characterId,
    salt: toDecimalField(opts.salt),
    bitmap,
    merkle_path,
  };

  try {
    // 1. Generate proof via Web Worker
    const result = await new Promise<ProveResult>((resolve, reject) => {
      const handler = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.id !== id) return;

        if (e.data.type === 'progress') {
          if (e.data.step === 'proving') {
            getStoreCallbacks().setZkPhase(GamePhase.PROVING);
          }
        } else {
          worker.removeEventListener('message', handler);
          if (e.data.type === 'result') {
            resolve(e.data);
          } else {
            reject(new Error(e.data.message));
          }
        }
      };

      worker.addEventListener('message', handler);
      worker.postMessage(req);
    });

    // 2. Submit proof on-chain
    getStoreCallbacks().setZkPhase(GamePhase.SUBMITTING);

    const tx = await account.execute([{
      contractAddress: GAME_CONTRACT,
      entrypoint: 'answer_question_with_proof',
      calldata: [
        toFeltHex(opts.gameId),
        String(result.proofCalldata.length),
        ...result.proofCalldata,
      ],
    }]);

    await waitForTx(tx.transaction_hash);

    // 3. Mark verified
    getStoreCallbacks().setVerifiedAnswer(Boolean(result.answerBit));
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    getStoreCallbacks().setProofError(msg);
    throw err;
  }
}

/**
 * Retry the last failed proof generation.
 */
export async function retryLastProof(
  clearProcessedTurnId?: (turnId: number) => void,
): Promise<ProveResult | null> {
  if (!lastProofOpts) return null;
  const store = getStoreCallbacks();
  store.clearProofError();
  if (clearProcessedTurnId) {
    clearProcessedTurnId(Number(lastProofOpts.turnId));
  }
  return generateAndSubmitProof(lastProofOpts);
}

/**
 * Submit ask_question on-chain (Katana).
 */
export async function askQuestionOnChain(
  gameId: string,
  questionId: number,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'ask_question',
    calldata: [toFeltHex(gameId), String(questionId)],
  }]);

  await waitForTx(tx.transaction_hash);
  console.log('[zk] ask_question confirmed:', tx.transaction_hash);
}

/**
 * Submit eliminate_characters on-chain.
 */
export async function eliminateCharactersOnChain(
  gameId: string,
  eliminatedBitmap: bigint,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'eliminate_characters',
    calldata: [toFeltHex(gameId), toFeltHex(eliminatedBitmap)],
  }]);

  await waitForTx(tx.transaction_hash);
  console.log('[zk] eliminate_characters confirmed:', tx.transaction_hash);
}

/**
 * Submit make_guess on-chain.
 */
export async function makeGuessOnChain(
  gameId: string,
  characterIdFelt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'make_guess',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt)],
  }]);

  await waitForTx(tx.transaction_hash);
  console.log('[zk] make_guess confirmed:', tx.transaction_hash);
}

/**
 * Submit reveal_character on-chain.
 */
export async function revealCharacterOnChain(
  gameId: string,
  characterIdFelt: string,
  salt: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'reveal_character',
    calldata: [toFeltHex(gameId), toFeltHex(characterIdFelt), toFeltHex(salt)],
  }]);

  await waitForTx(tx.transaction_hash);
  console.log('[zk] reveal_character confirmed:', tx.transaction_hash);
}

// ─── React Hook (thin wrapper) ───────────────────────────────────────────────

export function useZKAnswer() {
  const generateProof = useCallback(
    (opts: ZKAnswerOpts) => generateAndSubmitProof(opts),
    [],
  );

  return { generateProof, prewarmProver, terminateProver };
}
