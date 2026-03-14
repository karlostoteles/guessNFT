import { useEffect, useRef } from 'react';
import { getToriiClient, WORLD_ADDRESS } from './toriiClient';
import type { Clause, Subscription, Ty, Model } from './toriiClient';
import { getStarknetAccount, toFeltHex } from './zkSdk';
import {
  generateAndSubmitProof,
  askQuestionOnChain,
  commitCharacterOnChain,
  makeGuessOnChain,
  revealCharacterOnChain,
  prewarmProver,
  terminateProver,
  setZKStoreCallbacks,
} from './useZKAnswer';
import { characterIdToCircuitId } from './zkCommitment';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase, type PlayerId } from '@/core/store/types';
import { characterIdToFelt, ensureZKCommitment, getCommitment } from '@/services/starknet/commitReveal';

// ─── Helpers: extract typed values from Torii Ty fields ────────────────────

function tyToNumber(ty: Ty | undefined): number {
  if (!ty) return 0;
  if (typeof ty.value === 'number') return ty.value;
  if (typeof ty.value === 'string') return Number(ty.value);
  if (typeof ty.value === 'boolean') return ty.value ? 1 : 0;
  return 0;
}

function tyToBool(ty: Ty | undefined): boolean {
  if (!ty) return false;
  if (typeof ty.value === 'boolean') return ty.value;
  if (typeof ty.value === 'number') return ty.value !== 0;
  if (typeof ty.value === 'string') return ty.value !== '0' && ty.value !== '' && ty.value !== '0x0';
  return false;
}

function tyToHex(ty: Ty | undefined): string {
  if (!ty) return '0x0';
  if (typeof ty.value === 'string') return ty.value;
  if (typeof ty.value === 'number') return '0x' + ty.value.toString(16);
  return '0x0';
}

interface OnChainGame {
  phase: number;
  current_turn: number;
  turn_count: number;
  last_question_id: number;
  awaiting_answer: boolean;
  guess_character_id: string;
  winner: string;
  player1: string;
  player2: string;
  question_set_id: number;
}

function parseGameModel(model: Model): OnChainGame {
  return {
    phase:              tyToNumber(model.phase),
    current_turn:       tyToNumber(model.current_turn),
    turn_count:         tyToNumber(model.turn_count),
    last_question_id:   tyToNumber(model.last_question_id),
    awaiting_answer:    tyToBool(model.awaiting_answer),
    guess_character_id: tyToHex(model.guess_character_id),
    winner:             tyToHex(model.winner),
    player1:            tyToHex(model.player1),
    player2:            tyToHex(model.player2),
    question_set_id:    tyToNumber(model.question_set_id),
  };
}

// Contract phase constants
const PHASE = {
  WAITING_FOR_PLAYER2: 0,
  COMMIT_PHASE: 1,
  PLAYING: 2,
  REVEAL: 3,
  COMPLETED: 4,
} as const;

// ─── Turn query helper ──────────────────────────────────────────────────────

async function queryTurnAnswer(
  gameId: string,
  turnNumber: number,
): Promise<boolean | null> {
  try {
    const client = await getToriiClient();
    const result = await client.getEntities({
      world_addresses: [WORLD_ADDRESS],
      pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
      clause: {
        Keys: {
          keys: [gameId, `0x${turnNumber.toString(16)}`],
          pattern_matching: 'FixedLen',
          models: ['whoiswho-Turn'],
        },
      },
      no_hashed_keys: false,
      models: ['whoiswho-Turn'],
      historical: false,
    });

    const items: any[] = (result as any).items ?? Object.values(result);
    if (!items.length) return null;
    const turnModel = items[0]?.models?.['whoiswho-Turn'];
    if (!turnModel) return null;

    const answeredBy = tyToHex(turnModel.answered_by);
    if (!answeredBy || answeredBy === '0x0') {
      return null;
    }

    return tyToBool(turnModel.answer);
  } catch (err) {
    console.error('[sync] queryTurnAnswer failed:', err);
    return null;
  }
}

// ─── Main hook ───────────────────────────────────────────────────────────────

/**
 * Torii game sync hook.
 *
 * Post-merge: call with no args, read store directly via useGameStore.
 */
export function useToriiGameSync() {
  const store = useGameStore();

  const subscriptionRef = useRef<Subscription | null>(null);
  const lastProcessedKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eliminateInFlightRef = useRef(false);
  const revealInFlightRef = useRef(false);
  const proofInFlightRef = useRef(false);
  const commitInFlightRef = useRef(false);
  const committedForSessionRef = useRef<string | null>(null);
  const sentQuestionRef = useRef<number | null>(null);
  const sentGuessRef = useRef<string | null>(null);

  const mode = store.mode;
  // Use starknetGameId (on-chain felt), not onlineGameId (Supabase UUID).
  // Normalise to 0x-prefixed hex so BigInt() never chokes on a UUID with dashes.
  const rawStarknetId = store.starknetGameId || store.onlineGameId || '';
  const starknetGameId = rawStarknetId.startsWith('0x')
    ? rawStarknetId
    : rawStarknetId
    ? '0x' + rawStarknetId.replace(/-/g, '')
    : '';
  const onlinePlayerNum = store.onlinePlayerNum;

  const myChainAddress = (): string => {
    const account = getStarknetAccount(onlinePlayerNum as 1 | 2 ?? undefined);
    return account ? String(account.address) : '0x0';
  };

  // Wire ZK store callbacks
  useEffect(() => {
    setZKStoreCallbacks({
      setZkPhase: store.setZkPhase,
      clearProofError: store.clearProofError,
      setVerifiedAnswer: store.setVerifiedAnswer,
      setProofError: store.setProofError,
    });
  }, [store]);

  // Pre-warm / terminate worker lifecycle
  useEffect(() => {
    if (mode !== 'online') return;
    prewarmProver();
    return () => terminateProver();
  }, [mode]);

  // NOTE: Commitment is triggered by handleGameUpdate() when Torii reports
  // COMMIT_PHASE — NOT eagerly on ONLINE_WAITING. The on-chain game must reach
  // COMMIT_PHASE (after player 2 joins) before commit_character is valid.

  // Send ask_question on-chain when I ask a question
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (store.phase !== GamePhase.ANSWER_PENDING) return;

    const currentQuestion = store.currentQuestion;
    if (!currentQuestion) return;

    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myKey) return;
    if (sentQuestionRef.current === Number(currentQuestion.questionId)) return;

    // Convert questionId to number for on-chain (stripping zkq_ prefix if necessary)
    let qIdNum = Number(currentQuestion.questionId);
    if (isNaN(qIdNum) && currentQuestion.questionId.startsWith('zkq_')) {
      qIdNum = Number(currentQuestion.questionId.slice(4));
    }

    sentQuestionRef.current = qIdNum;

    askQuestionOnChain(starknetGameId, qIdNum, onlinePlayerNum as 1 | 2)
      .catch(console.error);
  }, [store.phase, starknetGameId]);

  // Send make_guess on-chain when I make a guess
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (store.phase !== GamePhase.ANSWER_PENDING) return;

    const guessedCharacterId = store.guessedCharacterId;
    if (!guessedCharacterId) return;
    if (store.currentQuestion) return;
    if (sentGuessRef.current === guessedCharacterId) return;

    sentGuessRef.current = guessedCharacterId;

    const charIdFelt = characterIdToFelt(guessedCharacterId);
    makeGuessOnChain(starknetGameId, charIdFelt, onlinePlayerNum as 1 | 2)
      .catch(console.error);
  }, [store.guessedCharacterId, store.phase, starknetGameId]);

  // Subscribe to Game entity via Torii
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;

    const gameId = starknetGameId;
    const playerNum = onlinePlayerNum as 1 | 2;
    let cancelled = false;

    async function setupSubscription() {
      try {
        const client = await getToriiClient();

        const initialEntity = await client.getEntities({
          world_addresses: [WORLD_ADDRESS],
          pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
          clause: {
            Keys: {
              keys: [gameId],
              pattern_matching: 'FixedLen',
              models: ['whoiswho-Game'],
            },
          },
          no_hashed_keys: false,
          models: ['whoiswho-Game'],
          historical: false,
        });

        if (cancelled) return;

        const items: any[] = (initialEntity as any).items ?? Object.values(initialEntity);
        if (items.length > 0) {
          const gameModel = items[0].models?.['whoiswho-Game'];
          if (gameModel) {
            handleGameUpdate(parseGameModel(gameModel), gameId, playerNum);
          }
        }

        const clause: Clause = {
          Keys: {
            keys: [gameId],
            pattern_matching: 'VariableLen',
            models: ['whoiswho-Game'],
          },
        };

        const sub = await client.onEntityUpdated(
          clause,
          [WORLD_ADDRESS],
          (...args: unknown[]) => {
            if (cancelled) return;

            let gameModel: Model | undefined;

            if (typeof args[0] === 'string' && args[1] && typeof args[1] === 'object') {
              const models = args[1] as Record<string, Model>;
              gameModel = models['whoiswho-Game'];
            } else if (args[0] && typeof args[0] === 'object' && 'models' in (args[0] as object)) {
              const entity = args[0] as { models: Record<string, Model> };
              gameModel = entity.models?.['whoiswho-Game'];
            } else if (Array.isArray(args[0])) {
              const entities = args[0] as Array<{ models: Record<string, Model> }>;
              if (entities.length > 0) {
                gameModel = entities[0].models?.['whoiswho-Game'];
              }
            }

            if (gameModel) {
              handleGameUpdate(parseGameModel(gameModel), gameId, playerNum);
            } else {
              console.warn('[torii-sync] Received update but could not parse Game model. Args:', args);
            }
          },
        );

        if (cancelled) {
          sub.cancel();
          return;
        }

        subscriptionRef.current = sub;
      } catch (err) {
        console.error('[torii-sync] Failed to set up subscription:', err);
      }
    }

    setupSubscription();

    pollIntervalRef.current = setInterval(async () => {
      if (cancelled) return;
      try {
        const client = await getToriiClient();
        const result = await client.getEntities({
          world_addresses: [WORLD_ADDRESS],
          pagination: { limit: 1, cursor: undefined, direction: 'Forward', order_by: [] },
          clause: {
            Keys: {
              keys: [gameId],
              pattern_matching: 'FixedLen',
              models: ['whoiswho-Game'],
            },
          },
          no_hashed_keys: false,
          models: ['whoiswho-Game'],
          historical: false,
        });
        const items: any[] = (result as any).items ?? Object.values(result);
        if (items.length > 0) {
          const gameModel = items[0].models?.['whoiswho-Game'];
          if (gameModel) {
            handleGameUpdate(parseGameModel(gameModel), gameId, playerNum);
          }
        }
      } catch {
        // Polling failure is non-fatal
      }
    }, 3000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      if (subscriptionRef.current) {
        subscriptionRef.current.cancel();
        subscriptionRef.current = null;
      }
      lastProcessedKeyRef.current = null;
      proofInFlightRef.current = false;
      commitInFlightRef.current = false;
      eliminateInFlightRef.current = false;
      revealInFlightRef.current = false;
    };
  }, [mode, starknetGameId, onlinePlayerNum]);

  // ─── Retrieve opponent's answer from Turn model ────────────────────────
  async function applyOpponentAnswerFromTurn(
    gameId: string,
    turnCount: number,
  ): Promise<void> {
    let answer = await queryTurnAnswer(gameId, turnCount);

    if (answer === null) {
      await new Promise(r => setTimeout(r, 300));
      answer = await queryTurnAnswer(gameId, turnCount);
    }

    if (answer === null) {
      console.warn('[sync] Turn answer not available for turn', turnCount);
      lastProcessedKeyRef.current = null;
      return;
    }

    store.applyOpponentAnswer(answer);
  }

  // ─── Submit commitment on-chain ─────────────────────────────────────────
  async function triggerCommitment(gameId: string, playerNum: 1 | 2) {
    if (commitInFlightRef.current) return;

    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    // Always read current state to avoid stale gameSessionId from closure
    const currentSessionId = useGameStore.getState().gameSessionId;
    const commitment = getCommitment(myKey, currentSessionId);
    if (!commitment) return;

    const sessionKey = `${gameId}:${currentSessionId}:${playerNum}`;
    if (committedForSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const chainAddr = myChainAddress();
    try {
      const updatedCommitment = await ensureZKCommitment(
        myKey,
        currentSessionId,
        BigInt(gameId),
        BigInt(chainAddr),
      );
      await commitCharacterOnChain(
        gameId,
        updatedCommitment.commitment,
        updatedCommitment.zkCommitment!,
        playerNum,
      );
      committedForSessionRef.current = sessionKey;
      console.log('[torii-sync] Commitment submitted on-chain');
    } catch (err) {
      console.error('[torii-sync] Commitment submission failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      commitInFlightRef.current = false;
    }
  }

  // ─── Phase change handler ──────────────────────────────────────────────
  async function handleGameUpdate(game: OnChainGame, gameId: string, myPlayerNum: 1 | 2) {
    const stateKey = `${game.phase}:${Number(game.awaiting_answer)}:${game.turn_count}`;
    if (lastProcessedKeyRef.current === stateKey) return;
    lastProcessedKeyRef.current = stateKey;

    // Always read current store state — avoids stale closure bugs in polling callbacks
    const s = useGameStore.getState();

    console.log(`[torii-sync] Phase ${game.phase}, awaiting_answer=${game.awaiting_answer}, turn_count=${game.turn_count}, current_turn=${game.current_turn}`);

    switch (game.phase) {
      case PHASE.WAITING_FOR_PLAYER2: {
        if (s.phase !== GamePhase.SETUP_P1 && s.phase !== GamePhase.SETUP_P2) {
          s.setZkPhase(GamePhase.ONLINE_WAITING);
        }
        break;
      }

      case PHASE.COMMIT_PHASE: {
        const myKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';
        const hasCharacter = !!s.players[myKey].secretCharacterId;
        if (!hasCharacter) {
          s.startSetup();
        } else {
          s.setZkPhase(GamePhase.ONLINE_WAITING);
        }
        triggerCommitment(gameId, myPlayerNum);
        const sessionKey = `${gameId}:${s.gameSessionId}:${myPlayerNum}`;
        if (committedForSessionRef.current !== sessionKey) {
          lastProcessedKeyRef.current = null;
        }
        break;
      }

      case PHASE.PLAYING: {
        if (!game.awaiting_answer) {
          if (game.turn_count === 0) {
            s.advanceToGameStart();
          }

          s.setActivePlayer(game.current_turn === 1 ? 'player1' : 'player2');

          if (game.turn_count > 0 && game.current_turn !== myPlayerNum) {
            await applyOpponentAnswerFromTurn(gameId, game.turn_count);
          }

          if (game.current_turn === myPlayerNum) {
            s.setZkPhase(GamePhase.QUESTION_SELECT);
          } else {
            s.setZkPhase(GamePhase.ONLINE_WAITING);
          }

        } else {
          const iAmAnswerer = game.current_turn !== myPlayerNum;

          if (iAmAnswerer) {
            const alreadyProcessed = s.processedTurnIds.has(game.turn_count);
            if (!proofInFlightRef.current && !alreadyProcessed) {
              proofInFlightRef.current = true;
              s.setActivePlayer(game.current_turn === 1 ? 'player1' : 'player2');
              s.receiveOpponentQuestion(game.last_question_id, null);
              triggerProofGeneration(gameId, game, myPlayerNum);
            }
          } else {
            s.setZkPhase(GamePhase.ANSWER_PENDING);
          }
        }
        break;
      }

      case PHASE.REVEAL:
        s.setZkPhase(GamePhase.ONLINE_WAITING);
        triggerAutoReveal(gameId, myPlayerNum);
        break;

      case PHASE.COMPLETED: {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        const winnerAddr = game.winner;
        const winnerPlayer: PlayerId = winnerAddr === game.player1 ? 'player1' : 'player2';
        // store.setWinner(winnerPlayer); // This might be handled by applyGuessResult
        s.setZkPhase(GamePhase.GAME_OVER);
        break;
      }

      default:
        console.warn(`[torii-sync] Unknown contract phase: ${game.phase}`);
        break;
    }
  }

  // ─── Async side effects ────────────────────────────────────────────────
  async function triggerProofGeneration(gameId: string, game: OnChainGame, playerNum: 1 | 2) {
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const mySecretId = store.players[myKey].secretCharacterId;
    if (!mySecretId) {
      proofInFlightRef.current = false;
      return;
    }

    const commitment = getCommitment(myKey, store.gameSessionId);
    if (!commitment) {
      console.warn('[torii-sync] No commitment found — cannot generate proof');
      proofInFlightRef.current = false;
      return;
    }

    const numericCharId = mySecretId.startsWith('nft_')
      ? parseInt(mySecretId.slice(4), 10) - 1
      : parseInt(mySecretId, 10);

    if (isNaN(numericCharId) || numericCharId < 0) {
      console.warn('[torii-sync] Invalid character ID for proof:', mySecretId);
      proofInFlightRef.current = false;
      return;
    }

    try {
      const result = await generateAndSubmitProof({
        gameId,
        turnId: String(game.turn_count),
        commitment: commitment.zkCommitment ?? commitment.commitment,
        questionId: game.last_question_id,
        characterId: numericCharId,
        salt: commitment.salt,
        playerNum,
      });

      const answer = Boolean(result.answerBit);
      console.log('[torii-sync] Proof submitted, answer:', answer);
    } catch (err) {
      console.error('[torii-sync] Proof generation/submission failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      proofInFlightRef.current = false;
    }
  }

  async function triggerAutoReveal(gameId: string, playerNum: 1 | 2) {
    if (revealInFlightRef.current) return;
    revealInFlightRef.current = true;

    try {
      const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
      const commitment = getCommitment(myKey, store.gameSessionId);

      if (!commitment) {
        console.error('[torii-sync] Cannot reveal: commitment not found');
        store.setProofError('Cannot reveal: commitment not found in localStorage.');
        return;
      }

      const charIdFelt = characterIdToFelt(commitment.characterId);
      await revealCharacterOnChain(gameId, charIdFelt, commitment.salt, playerNum);
    } catch (err) {
      console.error('[torii-sync] Auto-reveal failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      revealInFlightRef.current = false;
    }
  }
}
