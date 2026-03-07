/**
 * useToriiGameSync — Torii WASM-based real-time sync for online 1v1 games.
 *
 * Replaces the Supabase-based useOnlineGameSync hook entirely.
 * Subscribes to the on-chain Game model via Torii and drives the Zustand store
 * based on phase transitions from the contract state machine.
 *
 * The contract's Game model IS the source of truth:
 *   phase, current_turn, turn_count, last_question_id, awaiting_answer,
 *   guess_character_id, winner, player1, player2, question_set_id
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { GamePhase } from '../store/types';
import type { PlayerId } from '../store/types';
import { getToriiClient, WORLD_ADDRESS } from '../dojo/toriiClient';
import type { Clause, Subscription, Ty, Model } from '../dojo/toriiClient';
import { getCommitment, characterIdToFelt, ensureZKCommitment } from '../starknet/commitReveal';
import { getStarknetAccount } from '../starknet/sdk';
import {
  generateAndSubmitProof,
  askQuestionOnChain,
  commitCharacterOnChain,
  makeGuessOnChain,
  revealCharacterOnChain,
  prewarmProver,
  terminateProver,
} from './useZKAnswer';

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
  current_turn: number;        // 1 or 2
  turn_count: number;
  last_question_id: number;   // u16 — transparent in JS
  awaiting_answer: boolean;   // NEW — replaces multi-phase sub-states
  guess_character_id: string;
  winner: string;
  player1: string;
  player2: string;
  question_set_id: number;    // u8
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

// ─── Contract phase constants (from packages/contracts/src/constants.cairo) ──

const PHASE = {
  WAITING_FOR_PLAYER2: 0,
  COMMIT_PHASE: 1,
  PLAYING: 2,
  REVEAL: 3,
  COMPLETED: 4,
} as const;

// ─── Module-level Turn query helper ──────────────────────────────────────────

/**
 * Query Torii for the Turn model to retrieve the opponent's verified answer.
 * Called when awaiting_answer flips to false and we were the asker.
 *
 * Torii API (torii-client v1.8.2):
 *   - FixedLen: entity must have exactly N keys (correct for 2-key Turn model)
 *   - Cairo bool: ty.value is a raw JS boolean (handled by tyToBool)
 *   - Model name: '{namespace}-{ModelName}' = 'whoiswho-Turn'
 */
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
          pattern_matching: 'FixedLen',   // exactly 2 keys — correct for Turn model
          models: ['whoiswho-Turn'],
        },
      },
      no_hashed_keys: false,
      models: ['whoiswho-Turn'],
      historical: false,
    });

    // Handle both Record<string, Entity> and {items: Entity[]} shapes
    const items: any[] = (result as any).items ?? Object.values(result);
    if (!items.length) return null;
    const turnModel = items[0]?.models?.['whoiswho-Turn'];
    if (!turnModel) return null;

    // Verify the answer was actually written (answered_by != 0x0)
    const answeredBy = tyToHex(turnModel.answered_by);
    if (!answeredBy || answeredBy === '0x0') {
      return null;  // Turn not yet indexed — caller will retry
    }

    return tyToBool(turnModel.answer);
  } catch (err) {
    console.error('[sync] queryTurnAnswer failed:', err);
    return null;
  }
}

// ─── Main hook ───────────────────────────────────────────────────────────────

export function useToriiGameSync() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const starknetGameId = useGameStore((s) => s.starknetGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);

  const subscriptionRef = useRef<Subscription | null>(null);
  const lastProcessedKeyRef = useRef<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eliminateInFlightRef = useRef(false);
  const revealInFlightRef = useRef(false);
  const proofInFlightRef = useRef(false);
  const commitInFlightRef = useRef(false);

  const myChainAddress = (): string => {
    const account = getStarknetAccount(onlinePlayerNum ?? undefined);
    return account ? String(account.address) : '0x0';
  };

  // ─── Pre-warm / terminate worker lifecycle ──────────────────────────────
  useEffect(() => {
    if (mode !== 'online') return;
    prewarmProver();
    return () => terminateProver();
  }, [mode]);

  // ─── Push commitment on-chain when character is selected ─────────────────
  const committedForSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;
    if (commitInFlightRef.current) return;

    const state = useGameStore.getState();
    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const commitment = getCommitment(myKey, state.gameSessionId);
    if (!commitment) return;

    const gameId = starknetGameId;
    const playerNum = onlinePlayerNum;
    const sessionKey = `${gameId}:${state.gameSessionId}:${playerNum}`;
    if (committedForSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const chainAddr = myChainAddress();

    ensureZKCommitment(myKey, state.gameSessionId, BigInt(gameId), BigInt(chainAddr))
      .then((updatedCommitment) =>
        commitCharacterOnChain(
          gameId,
          updatedCommitment.commitment,
          updatedCommitment.zkCommitment!,
          playerNum,
        ),
      )
      .then(() => {
        committedForSessionRef.current = sessionKey;
        console.log('[torii-sync] Commitment submitted on-chain');
      })
      .catch((err) => {
        console.error('[torii-sync] Commitment (useEffect) failed:', err);
        // Reset dedup key so triggerCommitment can retry on next poll
        lastProcessedKeyRef.current = null;
      })
      .finally(() => {
        commitInFlightRef.current = false;
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, starknetGameId, onlinePlayerNum]);

  // ─── Send ask_question on-chain when I ask a question ───────────────────
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const sentQuestionRef = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;
    if (!currentQuestion) return;

    const myKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myKey) return;
    if (sentQuestionRef.current === currentQuestion.questionId) return;

    sentQuestionRef.current = currentQuestion.questionId;

    askQuestionOnChain(starknetGameId, currentQuestion.questionId, onlinePlayerNum)
      .catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.questionId, starknetGameId]);

  // ─── Send make_guess on-chain when I make a guess ───────────────────────
  const guessedCharacterId = useGameStore((s) => s.guessedCharacterId);
  const sentGuessRef = useRef<string | null>(null);

  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;
    if (!guessedCharacterId) return;
    if (currentQuestion) return; // It's a question, not a guess
    if (sentGuessRef.current === guessedCharacterId) return;

    sentGuessRef.current = guessedCharacterId;

    const charIdFelt = characterIdToFelt(guessedCharacterId);
    makeGuessOnChain(starknetGameId, charIdFelt, onlinePlayerNum)
      .catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCharacterId, phase, starknetGameId]);

  // ─── Subscribe to Game entity via Torii ─────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !starknetGameId || !onlinePlayerNum) return;

    const gameId = starknetGameId;
    const playerNum = onlinePlayerNum;
    let cancelled = false;

    async function setupSubscription() {
      try {
        const client = await getToriiClient();

        // Initial state query
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

        // Process initial state
        const items: any[] = (initialEntity as any).items ?? Object.values(initialEntity);
        if (items.length > 0) {
          const gameModel = items[0].models?.['whoiswho-Game'];
          if (gameModel) {
            handleGameUpdate(parseGameModel(gameModel), gameId, playerNum);
          }
        }

        // Subscribe to future changes
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
          // The WASM callback may receive various formats depending on version.
          // Handle defensively.
          (...args: unknown[]) => {
            if (cancelled) return;

            let gameModel: Model | undefined;

            // Format 1: (hashedKeys: string, models: Record<string, Model>)
            if (typeof args[0] === 'string' && args[1] && typeof args[1] === 'object') {
              const models = args[1] as Record<string, Model>;
              gameModel = models['whoiswho-Game'];
            }
            // Format 2: single Entity object
            else if (args[0] && typeof args[0] === 'object' && 'models' in (args[0] as object)) {
              const entity = args[0] as { models: Record<string, Model> };
              gameModel = entity.models?.['whoiswho-Game'];
            }
            // Format 3: array of entities
            else if (Array.isArray(args[0])) {
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

    // Polling fallback: Torii WASM subscription may silently drop.
    // Poll every 3s to ensure we never get permanently stuck.
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
        // Polling failure is non-fatal — subscription may still work
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, starknetGameId, onlinePlayerNum]);

  // ─── Retrieve opponent's answer from Turn model and apply to store ────────
  // IMPORTANT: defined inside hook closure — captures lastProcessedKeyRef (useRef).
  // Do NOT move to module-level helpers.
  async function applyOpponentAnswerFromTurn(
    gameId: string,
    turnCount: number,
  ): Promise<void> {
    let answer = await queryTurnAnswer(gameId, turnCount);

    if (answer === null) {
      // Turn model may not be indexed yet — single retry
      await new Promise(r => setTimeout(r, 300));
      answer = await queryTurnAnswer(gameId, turnCount);
    }

    if (answer === null) {
      // Polling fallback at 3s will retry on next PLAYING:false update
      console.warn('[sync] Turn answer not available for turn', turnCount);
      // Reset dedup key so the next Torii poll can retry this transition
      lastProcessedKeyRef.current = null;
      return;
    }

    const store = useGameStore.getState();
    store.applyOpponentAnswer(answer);
  }

  // ─── Submit commitment on-chain (called from COMMIT_PHASE switch case) ───
  async function triggerCommitment(gameId: string, playerNum: 1 | 2) {
    if (commitInFlightRef.current) return;

    const store = useGameStore.getState();
    const myKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
    const commitment = getCommitment(myKey, store.gameSessionId);
    if (!commitment) return;

    const sessionKey = `${gameId}:${store.gameSessionId}:${playerNum}`;
    if (committedForSessionRef.current === sessionKey) return;

    commitInFlightRef.current = true;
    const chainAddr = myChainAddress();
    try {
      const updatedCommitment = await ensureZKCommitment(
        myKey,
        store.gameSessionId,
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
      // Reset dedup key so the next 3s poll retries this transition
      lastProcessedKeyRef.current = null;
    } finally {
      commitInFlightRef.current = false;
    }
  }

  // ─── Phase change handler ──────────────────────────────────────────────

  async function handleGameUpdate(game: OnChainGame, gameId: string, myPlayerNum: 1 | 2) {
    const store = useGameStore.getState();

    // Composite dedup key — prevents replay of same transition
    // Encodes all state that drives distinct actions within a phase
    const stateKey = `${game.phase}:${Number(game.awaiting_answer)}:${game.turn_count}`;
    if (lastProcessedKeyRef.current === stateKey) return;
    lastProcessedKeyRef.current = stateKey;

    console.log(`[torii-sync] Phase ${game.phase}, awaiting_answer=${game.awaiting_answer}, turn_count=${game.turn_count}, current_turn=${game.current_turn}`);

    switch (game.phase) {

      case PHASE.WAITING_FOR_PLAYER2: {
        // Guard: don't regress from character selection to waiting.
        // After P2's handleJoin calls startSetup() → SETUP_P1, stale Torii data
        // may still show WAITING_FOR_PLAYER2 until the indexer catches up.
        const currentPhase = useGameStore.getState().phase;
        if (currentPhase !== GamePhase.SETUP_P1 && currentPhase !== GamePhase.SETUP_P2) {
          store.setPhase(GamePhase.ONLINE_WAITING);
        }
        break;
      }

      case PHASE.COMMIT_PHASE: {
        const myKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';
        const hasCharacter = !!useGameStore.getState().players[myKey].secretCharacterId;
        if (!hasCharacter) {
          store.startSetup();  // sends to SETUP_P1/P2 so player can select character
        } else {
          store.setPhase(GamePhase.ONLINE_WAITING);
        }
        triggerCommitment(gameId, myPlayerNum);
        // If commitment isn't confirmed yet, allow retry on next poll
        const sessionKey = `${gameId}:${useGameStore.getState().gameSessionId}:${myPlayerNum}`;
        if (committedForSessionRef.current !== sessionKey) {
          lastProcessedKeyRef.current = null;
        }
        break;
      }

      case PHASE.PLAYING: {
        if (!game.awaiting_answer) {
          // On first entry to PLAYING (turn_count === 0), initialize board state.
          // advanceToGameStart sets commitmentStatus='both', activePlayer='player1'.
          if (game.turn_count === 0) {
            store.advanceToGameStart();
          }

          // Set active player from on-chain current_turn (1→'player1', 2→'player2').
          // setActivePlayer is NOT in GameActions — must mutate store directly.
          useGameStore.setState((s) => {
            s.activePlayer = game.current_turn === 1 ? 'player1' : 'player2';
          });

          // Detect: opponent just answered.
          // After answer_question_with_proof, current_turn FLIPS to the answerer.
          // So: if current_turn !== myPlayerNum, I was the asker → query Turn for answer.
          if (game.turn_count > 0 && game.current_turn !== myPlayerNum) {
            await applyOpponentAnswerFromTurn(gameId, game.turn_count);
          }

          if (game.current_turn === myPlayerNum) {
            store.setPhase(GamePhase.QUESTION_SELECT);
          } else {
            store.setPhase(GamePhase.ONLINE_WAITING);
          }

        } else {
          // awaiting_answer = true: the NON-current_turn player must answer with ZK proof
          const iAmAnswerer = game.current_turn !== myPlayerNum;

          if (iAmAnswerer) {
            // Gate: don't trigger if already in flight or already processed this turn
            const alreadyProcessed = useGameStore.getState().processedTurnIds.has(game.turn_count);
            if (!proofInFlightRef.current && !alreadyProcessed) {
              proofInFlightRef.current = true;
              // Set activePlayer BEFORE receiveOpponentQuestion
              useGameStore.setState((s) => {
                s.activePlayer = game.current_turn === 1 ? 'player1' : 'player2';
              });
              store.receiveOpponentQuestion(game.last_question_id, game.turn_count);
              triggerProofGeneration(gameId, game, myPlayerNum);
            }
          } else {
            // I am the asker — wait for opponent's proof
            store.setPhase(GamePhase.ANSWER_PENDING);
          }
        }
        break;
      }

      case PHASE.REVEAL:
        store.setPhase(GamePhase.REVEAL_WAITING);
        triggerAutoReveal(gameId, myPlayerNum);
        break;

      case PHASE.COMPLETED: {
        // Cancel polling — game is done, no more updates needed
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        // winner on Game model is a felt252 address string — must resolve to PlayerId.
        const winnerAddr = game.winner;
        const winnerPlayer: PlayerId = winnerAddr === game.player1 ? 'player1' : 'player2';
        useGameStore.setState((s) => { s.winner = winnerPlayer; });
        store.setPhase(GamePhase.GAME_OVER);
        break;
      }

      default:
        console.warn(`[torii-sync] Unknown contract phase: ${game.phase}`);
        break;
    }
  }

  // ─── Async side effects ────────────────────────────────────────────────

  async function triggerProofGeneration(gameId: string, game: OnChainGame, playerNum: 1 | 2) {
    // proofInFlightRef.current is already set to true by the caller (PLAYING case)
    const store = useGameStore.getState();
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
      // Reset dedup so a retry is possible on next Torii update
      lastProcessedKeyRef.current = null;
    } finally {
      proofInFlightRef.current = false;
    }
  }

  async function triggerAutoReveal(gameId: string, playerNum: 1 | 2) {
    if (revealInFlightRef.current) return;
    revealInFlightRef.current = true;

    try {
      const store = useGameStore.getState();
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
