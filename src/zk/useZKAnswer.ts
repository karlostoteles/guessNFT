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
import {
  loadCollectionData,
  getCharacterBitmap,
  getCharacterMerklePath,
} from './collectionData';
import { GamePhase } from '@/core/store/types';
import { TRAITS_ROOT, GAME_CONTRACT } from './config';
import { getStarknetAccount, toFeltHex, toDecimalField, splitU256, toBigInt } from './zkSdk';
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

const GAME_CREATED_SELECTOR =
  '0x1eb99ed24a15baaccc5c9a5458e3fc04f9cc107dbd431ef6e70b4158a253e8f';

function getExecAccount(playerNum?: 1 | 2) {
  const account = getStarknetAccount(playerNum);
  if (!account) {
    throw new Error('No Starknet account connected');
  }
  return account;
}

function extractGameIdFromReceipt(receipt: any): string {
  const events: any[] = receipt?.events ?? [];
  for (const ev of events) {
    if (!Array.isArray(ev.keys)) continue;
    const selectorIdx = ev.keys.findIndex(
      (k: string) => String(k).toLowerCase() === GAME_CREATED_SELECTOR,
    );
    if (selectorIdx < 0) continue;
    if (Array.isArray(ev.data) && ev.data.length >= 2) {
      const candidate = toBigInt(ev.data[1]);
      return toFeltHex(candidate);
    }
  }
  throw new Error('Unable to extract game_id from create_game transaction receipt');
}

// ─── Contract calls ───────────────────────────────────────────────────────────

export async function createGameOnChain(playerNum?: 1 | 2): Promise<string> {
  const account = getExecAccount(playerNum);
  const [rootLow, rootHigh] = splitU256(TRAITS_ROOT);

  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'create_game',
    calldata: [rootLow, rootHigh, '0'],
  }]);
  const receipt = await account.waitForTransaction(tx.transaction_hash);
  return extractGameIdFromReceipt(receipt);
}

export async function joinGameOnChain(gameId: string, playerNum?: 1 | 2): Promise<void> {
  const account = getExecAccount(playerNum);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'join_game',
    calldata: [toFeltHex(gameId)],
  }]);
  await account.waitForTransaction(tx.transaction_hash);
}

export async function commitCharacterOnChain(
  gameId: string,
  commitmentHash: string,
  zkCommitment: string,
  playerNum?: 1 | 2,
): Promise<void> {
  const account = getExecAccount(playerNum);
  const [zkLow, zkHigh] = splitU256(zkCommitment);
  const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'commit_character',
    calldata: [toFeltHex(gameId), toFeltHex(commitmentHash), zkLow, zkHigh],
  }]);
  await account.waitForTransaction(tx.transaction_hash);
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

    await account.waitForTransaction(tx.transaction_hash);

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

  await account.waitForTransaction(tx.transaction_hash);
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

  await account.waitForTransaction(tx.transaction_hash);
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

  await account.waitForTransaction(tx.transaction_hash);
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

  await account.waitForTransaction(tx.transaction_hash);
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
