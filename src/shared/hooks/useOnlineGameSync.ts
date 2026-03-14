/**
 * useOnlineGameSync
 *
 * Manages real-time Dojo/Torii sync for online 1v1 games.
 * - Subscribes to Game and Turn models via Torii WASM client.
 * - Automatically triggers ZK proof generation when player needs to answer.
 * - Synchronizes on-chain state transitions with the local game store.
 *
 * Must be mounted for the duration of an online game.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import type { PlayerId } from '@/core/store/types';
import { getToriiClient, WORLD_ADDRESS } from '../../zk/toriiClient';
import type { Clause, Subscription, Model } from '../../zk/toriiClient';
import { getStarknetAccount, toFeltHex } from '../../zk/zkSdk';
import {
  generateAndSubmitProof,
  askQuestionOnChain,
  commitCharacterOnChain,
  makeGuessOnChain,
  revealCharacterOnChain,
  prewarmProver,
  terminateProver,
  setZKStoreCallbacks,
} from '../../zk/useZKAnswer';
import { ensureZKCommitment } from '@/services/starknet/commitReveal';

// ─── Helpers: extract typed values from Torii Ty fields ────────────────────

function tyToNumber(ty: any): number {
  if (!ty) return 0;
  if (typeof ty.value === 'number') return ty.value;
  if (typeof ty.value === 'string') return Number(ty.value);
  if (typeof ty.value === 'boolean') return ty.value ? 1 : 0;
  return 0;
}

function tyToBool(ty: any): boolean {
  if (!ty) return false;
  if (typeof ty.value === 'boolean') return ty.value;
  if (typeof ty.value === 'number') return ty.value !== 0;
  if (typeof ty.value === 'string') return ty.value !== '0' && ty.value !== '' && ty.value !== '0x0';
  return false;
}

function tyToHex(ty: any): string {
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

function parseGameModel(model: Record<string, any>): OnChainGame {
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

export function useOnlineGameSync() {
  const mode = useGameStore((s) => s.mode);
  const onlineGameId = useGameStore((s) => s.starknetGameId || s.onlineGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);
  const phase = useGameStore((s) => s.phase);

  // Online mode is now fully managed by useToriiGameSync (via OnlineGameManager
  // in App.tsx). This hook must be disabled to avoid duplicate Torii subscriptions,
  // double on-chain submissions, and phase-setting race conditions.
  // We use a flag instead of early return to respect React's Rules of Hooks.
  const isDisabled = mode === 'online';

  const subscriptionRef = useRef<Subscription | null>(null);
  const lastProcessedKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const proofInFlightRef = useRef(false);
  const commitInFlightRef = useRef(false);
  const committedForSessionRef = useRef<string | null>(null);
  const sentQuestionRef = useRef<number | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const revealInFlightRef = useRef(false);

  // In standard Dojo, keys[1] is the game_id (felt).
  // Torii expect keys as strings.
  const gameIdHex = onlineGameId ? (onlineGameId.startsWith('0x') ? onlineGameId : '0x' + onlineGameId.replace(/-/g, '')) : '0x0';

  const myChainAddress = (): string => {
    const account = getStarknetAccount(onlinePlayerNum as 1 | 2 ?? undefined);
    return account ? String(account.address) : '0x0';
  };

  // Wire ZK store callbacks (only if not disabled — useToriiGameSync does this too)
  useEffect(() => {
    if (isDisabled) return;
    const state = useGameStore.getState();
    setZKStoreCallbacks({
      setZkPhase: state.setZkPhase,
      clearProofError: state.clearProofError,
      setVerifiedAnswer: state.setVerifiedAnswer,
      setProofError: state.setProofError,
    });
  }, [isDisabled]);

  // Pre-warm / terminate worker lifecycle
  useEffect(() => {
    if (isDisabled) return;
    prewarmProver();
    return () => terminateProver();
  }, [mode, isDisabled]);

  // Push commitment on-chain when character is selected
  useEffect(() => {
    if (isDisabled ||!onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;
    if (commitInFlightRef.current) return;

    const state = useGameStore.getState();
    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const player = state.players[myKey];
    if (!player.secretCharacterId) return;

    // Load commitment from local storage (Phase 1)
    const commitData = (window as any).getCommitment?.(myKey, state.gameSessionId);
    // Actually we should import getCommitment
    // Let's use useGameStore.getState().getCommitment if we have it or import it.
    
    // For now, I'll rely on triggerCommitment being called from handleGameUpdate
    // but this effect is a good backup for manual character selection.
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // Send ask_question on-chain when I ask a question
  useEffect(() => {
    if (isDisabled ||!onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;

    const state = useGameStore.getState();
    const currentQuestion = state.currentQuestion;
    if (!currentQuestion) return;

    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myKey) return;
    
    // numeric questionId for ZK mode
    // Our questions currently use string IDs, we need to map the question to an ID.
    // Gianfranco's demo uses numeric IDs directly.
    // I'll assume for now we use numeric IDs or have a mapping.
    const questionIdNum = (currentQuestion as any).questionIdNum ?? 0;

    if (sentQuestionRef.current === questionIdNum) return;
    sentQuestionRef.current = questionIdNum;

    askQuestionOnChain(onlineGameId, questionIdNum, onlinePlayerNum as 1 | 2)
      .catch(console.error);
  }, [phase, onlineGameId]);

  // Send make_guess on-chain when I make a guess
  useEffect(() => {
    if (isDisabled ||!onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;

    const state = useGameStore.getState();
    const guessedCharacterId = state.guessedCharacterId;
    if (!guessedCharacterId || state.currentQuestion) return;
    
    if (sentGuessRef.current === guessedCharacterId) return;
    sentGuessRef.current = guessedCharacterId;

    const charIdFelt = state.players[onlinePlayerNum === 1 ? 'player1' : 'player2'].secretCharacterId; 
    // Wait, the guess is for the OPPONENT's character.
    // In EGS, make_guess takes characterIdFelt.
    
    // Mapping our string ID to felt
    const feltId = guessedCharacterId.startsWith('nft_') ? guessedCharacterId.slice(4) : guessedCharacterId;

    makeGuessOnChain(onlineGameId, feltId, onlinePlayerNum as 1 | 2)
      .catch(console.error);
  }, [useGameStore.getState().guessedCharacterId, phase, onlineGameId]);

  useEffect(() => {
    if (isDisabled ||!onlineGameId || !onlinePlayerNum) return;

    const gameId = gameIdHex;
    const playerNum = onlinePlayerNum as 1 | 2;
    let cancelled = false;

    async function setupSubscription() {
      try {
        const client = await getToriiClient();

        // Initial fetch
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

        // Subscription
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
          (...args: any[]) => {
            if (cancelled) return;
            let gameModel: any;
            if (args[1] && typeof args[1] === 'object') {
               gameModel = args[1]['whoiswho-Game'];
            }
            if (gameModel) {
              handleGameUpdate(parseGameModel(gameModel), gameId, playerNum);
            }
          },
        );

        if (cancelled) {
          sub.cancel();
          return;
        }

        subscriptionRef.current = sub;
      } catch (err) {
        console.error('[torii-sync] Subscription failed:', err);
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
      } catch {}
    }, 5000);

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (subscriptionRef.current) subscriptionRef.current.cancel();
      lastProcessedKeyRef.current = null;
    };
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ─── Phase change handler ──────────────────────────────────────────────
  async function handleGameUpdate(game: OnChainGame, gameId: string, myPlayerNum: 1 | 2) {
    const stateKey = `${game.phase}:${Number(game.awaiting_answer)}:${game.turn_count}`;
    if (lastProcessedKeyRef.current === stateKey) return;
    lastProcessedKeyRef.current = stateKey;

    const state = useGameStore.getState();

    switch (game.phase) {
      case PHASE.WAITING_FOR_PLAYER2:
        if (state.phase !== GamePhase.ONLINE_WAITING) {
          state.setZkPhase(GamePhase.ONLINE_WAITING);
        }
        break;

      case PHASE.COMMIT_PHASE:
        const myKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';
        if (!state.players[myKey].secretCharacterId) {
          state.startSetup();
        } else {
          triggerCommitment(gameId, myPlayerNum);
        }
        break;

      case PHASE.PLAYING:
        if (!game.awaiting_answer) {
          if (game.turn_count === 0 && state.phase === GamePhase.ONLINE_WAITING) {
            state.advanceToGameStart();
          }

          state.setActivePlayer(game.current_turn === 1 ? 'player1' : 'player2');

          if (game.turn_count > 0 && game.current_turn !== myPlayerNum) {
            const answer = await queryTurnAnswer(gameId, game.turn_count);
            if (answer !== null) state.applyOpponentAnswer(answer);
          }

          if (game.current_turn === myPlayerNum) {
            state.setZkPhase(GamePhase.QUESTION_SELECT);
          } else {
            state.setZkPhase(GamePhase.ONLINE_WAITING);
          }
        } else {
          const iAmAnswerer = game.current_turn !== myPlayerNum;
          if (iAmAnswerer) {
            if (!proofInFlightRef.current && !state.processedTurnIds.has(game.turn_count)) {
              proofInFlightRef.current = true;
              state.setActivePlayer(game.current_turn === 1 ? 'player1' : 'player2');
              state.receiveOpponentQuestion(game.last_question_id, null);
              triggerProofGeneration(gameId, game, myPlayerNum);
            }
          } else {
            state.setZkPhase(GamePhase.ANSWER_PENDING);
          }
        }
        break;

      case PHASE.REVEAL:
        state.setZkPhase(GamePhase.REVEAL_WAITING);
        triggerAutoReveal(gameId, myPlayerNum);
        break;

      case PHASE.COMPLETED:
        const winnerPlayer: PlayerId = game.winner === game.player1 ? 'player1' : 'player2';
        state.setWinner(winnerPlayer);
        state.setZkPhase(GamePhase.GAME_OVER);
        break;
    }
  }

  async function triggerCommitment(gameId: string, playerNum: 1 | 2) {
    if (commitInFlightRef.current) return;
    const state = useGameStore.getState();
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    
    // Import from services directly
    const { getCommitment, ensureZKCommitment } = await import('@/services/starknet/commitReveal');
    const commitment = getCommitment(myKey, state.gameSessionId);
    if (!commitment) return;

    commitInFlightRef.current = true;
    try {
      const updated = await ensureZKCommitment(myKey, state.gameSessionId, BigInt(gameId), BigInt(myChainAddress()));
      await commitCharacterOnChain(gameId, updated.commitment, updated.zkCommitment, playerNum);
      committedForSessionRef.current = `${gameId}:${state.gameSessionId}`;
    } catch (err) {
      console.error('[sync] Commitment failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      commitInFlightRef.current = false;
    }
  }

  async function triggerProofGeneration(gameId: string, game: OnChainGame, playerNum: 1 | 2) {
    const state = useGameStore.getState();
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const mySecretId = state.players[myKey].secretCharacterId;
    if (!mySecretId) { proofInFlightRef.current = false; return; }

    const { getCommitment } = await import('@/services/starknet/commitReveal');
    const commitment = getCommitment(myKey, state.gameSessionId);
    if (!commitment || !commitment.zkCommitment) {
      console.warn('[sync] No ZK commitment found');
      proofInFlightRef.current = false;
      return;
    }

    const numericCharId = mySecretId.startsWith('nft_')
      ? parseInt(mySecretId.slice(4), 10) - 1
      : parseInt(mySecretId, 10);

    try {
      await generateAndSubmitProof({
        gameId,
        turnId: String(game.turn_count),
        commitment: commitment.zkCommitment,
        questionId: game.last_question_id,
        characterId: numericCharId,
        salt: commitment.salt,
        playerNum,
      });
      // Set of turn IDs we've processed
      state.processedTurnIds.add(game.turn_count);
    } catch (err) {
      console.error('[sync] Proof failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      proofInFlightRef.current = false;
    }
  }

  async function triggerAutoReveal(gameId: string, playerNum: 1 | 2) {
    if (revealInFlightRef.current) return;
    revealInFlightRef.current = true;
    const state = useGameStore.getState();
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';

    try {
      const { getCommitment } = await import('@/services/starknet/commitReveal');
      const commitment = getCommitment(myKey, state.gameSessionId);
      if (!commitment) return;

      const { characterIdToCircuitId } = await import('../../zk/zkCommitment');
      const charIdFelt = characterIdToCircuitId(commitment.characterId).toString(10);
      await revealCharacterOnChain(gameId, charIdFelt, commitment.salt, playerNum);
    } catch (err) {
      console.error('[sync] Reveal failed:', err);
      lastProcessedKeyRef.current = null;
    } finally {
      revealInFlightRef.current = false;
    }
  }

  return { checkAndAdvanceIfReady: () => {} };
}
