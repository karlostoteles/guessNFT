/**
 * useOnlineGameSync
 *
 * Manages real-time Supabase sync for online 1v1 games.
 * - Subscribes to game_events (opponent's actions) and the games table (status changes)
 * - Sends events when the local player takes actions
 * - Translates incoming events into game store actions
 *
 * Must be mounted for the duration of an online game.
 */
import { useEffect, useRef } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import type { PlayerId, QuestionRecord } from '@/core/store/types';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { QUESTIONS } from '@/core/data/questions';
import {
  subscribeToGame,
  subscribeToEvents,
  sendEvent,
  finishGame,
  submitCommitment,
  updateTurn,
  getGame,
  getPastEvents,
} from '@/services/supabase/gameService';
import type { SupabaseGame, SupabaseGameEvent } from '@/services/supabase/types';
import { supabase } from '@/services/supabase/client';
import { getCommitment } from '@/services/starknet/commitReveal';

export function useOnlineGameSync() {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const onlineGameId = useGameStore((s) => s.onlineGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const guessedCharacterId = useGameStore((s) => s.guessedCharacterId);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const activePlayer = useGameStore((s) => s.activePlayer);

  // Refs to avoid stale closures in event handlers
  const sentQuestionRef = useRef<string | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const sentAnswerForRef = useRef<string | null>(null); // question_id we already answered
  const lastPushedTurnRef = useRef<number>(0); // last turn_number written to DB
  const processedEventIds = useRef<Set<string>>(new Set()); // dedup incoming events

  const myAddress = () => {
    try {
      // Dynamic require avoids a circular import: walletStore is also consumed by
      // gameStore (via commitReveal), and a static import here would create a cycle.
      const { useWalletStore } = require('@/services/starknet/walletStore');
      return useWalletStore.getState().address ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  // ─── Helper: poll game status and advance if in_progress ─────────────────
  // Used as a fallback when Supabase realtime is slow or not configured.
  async function checkAndAdvanceIfReady(gameId: string) {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('status')
        .eq('id', gameId)
        .single();
      if (game?.status === 'in_progress') {
        const s = useGameStore.getState();
        if (s.phase === GamePhase.ONLINE_WAITING) {
          s.advanceToGameStart();
        }
      }
    } catch (e) {
      console.error('[sync] checkAndAdvanceIfReady error', e);
    }
  }

  // ─── Subscribe to realtime when in online game ────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;

    const gameSub = subscribeToGame(onlineGameId, handleGameUpdate);
    const eventSub = subscribeToEvents(onlineGameId, handleEvent);

    return () => {
      supabase.removeChannel(gameSub);
      supabase.removeChannel(eventSub);
    };
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ─── Push commitment to Supabase when character is selected (ONLINE_WAITING) ─
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const commitment = getCommitment(myPlayerKey, state.gameSessionId);
    if (!commitment) return;

    const gameId = onlineGameId;   // capture for async closure
    const playerNum = onlinePlayerNum;

    submitCommitment(
      gameId,
      playerNum,
      commitment.commitment,
      myAddress(),
      1 // turn 0 / setup
    ).then(() => {
      // Direct check as fallback — the player who committed last will see 'in_progress'
      // immediately without waiting for realtime to deliver the update.
      return checkAndAdvanceIfReady(gameId);
    }).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Poll for game start while on ONLINE_WAITING ──────────────────────────
  // Belt-and-suspenders fallback: every 3 s, check if the game has started.
  // This handles the case where Supabase Postgres Changes realtime is not
  // enabled on the 'games' table or the update event was missed.
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;

    const gameId = onlineGameId;
    const intervalId = setInterval(() => {
      checkAndAdvanceIfReady(gameId);
    }, 3000);

    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Recover full game state on rejoin ────────────────────────────────────
  // If we enter ONLINE_WAITING but the game is already in_progress, replay
  // all past events to rebuild question history, elimination state, and turn.
  const recoveryAttemptedRef = useRef(false);
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;
    if (recoveryAttemptedRef.current) return;

    recoveryAttemptedRef.current = true;

    const gameId = onlineGameId;
    const playerNum = onlinePlayerNum;

    (async () => {
      try {
        const game = await getGame(gameId);
        if (!game || game.status !== 'in_progress') return; // not started yet, normal flow

        const events = await getPastEvents(gameId);
        const state = useGameStore.getState();
        const myPlayerKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
        const opponentKey: PlayerId = playerNum === 1 ? 'player2' : 'player1';

        // Recover secret character from localStorage commitment
        const commitment = getCommitment(myPlayerKey, state.gameSessionId);
        const mySecretId = commitment?.characterId ?? state.players[myPlayerKey].secretCharacterId;

        // Replay events to rebuild question history and elimination state
        const questionHistory: QuestionRecord[] = [];
        let myEliminated: string[] = [];
        let opponentEliminated: string[] = [];
        const answeredQuestions = new Map<string, boolean>(); // question_id → answer

        for (const evt of events) {
          const evtPlayerKey: PlayerId = evt.player_num === 1 ? 'player1' : 'player2';

          switch (evt.event_type) {
            case 'QUESTION_ASKED': {
              const { question_id } = evt.payload as { question_id: string };
              const q = QUESTIONS.find((qn) => qn.id === question_id);
              if (q) {
                // Look for the corresponding answer event
                const answerEvt = events.find(
                  (e) => e.event_type === 'ANSWER_GIVEN' &&
                    (e.payload as any).question_id === question_id
                );
                const answer = answerEvt ? (answerEvt.payload as any).answer as boolean : null;
                if (answer !== null) {
                  answeredQuestions.set(question_id, answer);
                }
                questionHistory.push({
                  questionId: question_id,
                  questionText: q.text,
                  traitKey: q.traitKey,
                  traitValue: q.traitValue,
                  answer,
                  askedBy: evtPlayerKey,
                  turnNumber: evt.turn_number,
                });
              }
              break;
            }
            case 'ELIMINATION_UPDATE': {
              const { eliminated_ids } = evt.payload as { eliminated_ids: string[] };
              if (evtPlayerKey === myPlayerKey) {
                myEliminated = eliminated_ids;
              } else {
                opponentEliminated = eliminated_ids;
              }
              break;
            }
          }
        }

        // If no elimination events, rebuild from question history
        if (myEliminated.length === 0 && questionHistory.length > 0) {
          const myQuestions = questionHistory.filter((q) => q.askedBy === myPlayerKey && q.answer !== null);
          const eliminatedSet = new Set<string>();
          for (const qr of myQuestions) {
            const fullQ = QUESTIONS.find((q) => q.id === qr.questionId);
            if (!fullQ) continue;
            for (const char of state.characters) {
              if (eliminatedSet.has(char.id)) continue;
              const matches = evaluateQuestion(fullQ, char);
              const shouldElim = qr.answer ? !matches : matches;
              if (shouldElim) eliminatedSet.add(char.id);
            }
          }
          myEliminated = [...eliminatedSet];
        }

        if (opponentEliminated.length === 0 && questionHistory.length > 0) {
          const oppQuestions = questionHistory.filter((q) => q.askedBy === opponentKey && q.answer !== null);
          const eliminatedSet = new Set<string>();
          for (const qr of oppQuestions) {
            const fullQ = QUESTIONS.find((q) => q.id === qr.questionId);
            if (!fullQ) continue;
            for (const char of state.characters) {
              if (eliminatedSet.has(char.id)) continue;
              const matches = evaluateQuestion(fullQ, char);
              const shouldElim = qr.answer ? !matches : matches;
              if (shouldElim) eliminatedSet.add(char.id);
            }
          }
          opponentEliminated = [...eliminatedSet];
        }

        // Mark all replayed events as processed so live handler skips them
        for (const evt of events) {
          const key = (evt as any).idempotency_key ?? evt.id;
          processedEventIds.current.add(key);
        }

        // Restore state
        const dbTurn = game.turn_number || Math.max(1, ...questionHistory.map((q) => q.turnNumber));
        state.restoreFromEvents(
          dbTurn,
          questionHistory,
          myEliminated,
          opponentEliminated,
          mySecretId ?? null,
        );

        console.log(`[sync] Recovered game state: turn=${dbTurn}, questions=${questionHistory.length}, myElim=${myEliminated.length}, oppElim=${opponentEliminated.length}`);
      } catch (err) {
        console.error('[sync] Recovery failed, falling back to normal flow', err);
      }
    })();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Push turn_number + active_player_num to Supabase on every turn change ─
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    // Don't push during setup phases — only once game is in progress
    if (phase === GamePhase.MENU || phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2 || phase === GamePhase.ONLINE_WAITING) return;
    // Avoid duplicate writes for the same turn
    if (turnNumber <= lastPushedTurnRef.current) return;

    lastPushedTurnRef.current = turnNumber;

    const activePlayerNum: 1 | 2 = activePlayer === 'player1' ? 1 : 2;
    updateTurn(onlineGameId, activePlayerNum, turnNumber).catch((err) =>
      console.error('[sync] updateTurn failed', err)
    );
  }, [turnNumber, phase, mode, onlineGameId, onlinePlayerNum, activePlayer]);

  // ─── Send QUESTION_ASKED when I ask a question ────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_REVEALED) return;
    if (!currentQuestion) return;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';

    // Only send if I asked the question and haven't sent it yet
    if (currentQuestion.askedBy !== myPlayerKey) return;
    if (sentQuestionRef.current === currentQuestion.questionId) return;

    sentQuestionRef.current = currentQuestion.questionId;

    const idemKey = `q_${onlineGameId}_${onlinePlayerNum}_${currentQuestion.questionId}`;
    sendEvent(
      onlineGameId,
      'QUESTION_ASKED',
      onlinePlayerNum,
      myAddress(),
      currentQuestion.turnNumber,
      { question_id: currentQuestion.questionId },
      idemKey
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.questionId]);

  // ─── Broadcast eliminatedIds after elimination completes ──────────────────
  const sentEliminationForTurnRef = useRef<number>(0);
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.AUTO_ELIMINATING) return;
    if (turnNumber <= sentEliminationForTurnRef.current) return;

    sentEliminationForTurnRef.current = turnNumber;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const myEliminated = state.players[myPlayerKey].eliminatedCharacterIds;

    const idemKey = `elim_${onlineGameId}_${onlinePlayerNum}_t${turnNumber}`;
    sendEvent(
      onlineGameId,
      'ELIMINATION_UPDATE',
      onlinePlayerNum,
      myAddress(),
      turnNumber,
      { eliminated_ids: myEliminated },
      idemKey
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnNumber, mode, onlineGameId, onlinePlayerNum]);

  // ─── Send GUESS_MADE when I make a guess ──────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;
    if (!guessedCharacterId) return;
    if (sentGuessRef.current === guessedCharacterId) return;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';

    // Check this is a guess (not a question answer pending)
    if (currentQuestion) return; // It's a question, not a guess

    sentGuessRef.current = guessedCharacterId;

    const idemKey = `g_${onlineGameId}_${onlinePlayerNum}_${guessedCharacterId}_t${turnNumber}`;
    sendEvent(
      onlineGameId,
      'GUESS_MADE',
      onlinePlayerNum,
      myAddress(),
      turnNumber,
      { character_id: guessedCharacterId },
      idemKey
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCharacterId, phase]);

  // ─── Handle game meta updates (status changes) ────────────────────────────
  function handleGameUpdate(game: SupabaseGame) {
    const state = useGameStore.getState();
    if (game.status === 'in_progress' && state.phase === GamePhase.ONLINE_WAITING) {
      state.advanceToGameStart();
    }
  }

  // ─── Handle incoming events from opponent ─────────────────────────────────
  function handleEvent(event: SupabaseGameEvent) {
    const isFromMe = event.player_num === onlinePlayerNum;
    if (isFromMe) return; // ignore own events (we already applied them locally)

    // Dedup: skip events we've already processed (Supabase can re-deliver)
    const eventKey = event.idempotency_key ?? event.id;
    if (processedEventIds.current.has(eventKey)) return;
    processedEventIds.current.add(eventKey);

    const state = useGameStore.getState();

    switch (event.event_type) {
      case 'CHARACTER_COMMITTED': {
        // Opponent has committed their character.
        // Check game status directly — this fires before (or instead of) the
        // games-table realtime update, so it's the fastest path to advancing.
        if (state.phase === GamePhase.ONLINE_WAITING && state.onlineGameId) {
          checkAndAdvanceIfReady(state.onlineGameId);
        }
        break;
      }

      case 'QUESTION_ASKED': {
        const { question_id } = event.payload as { question_id: string };

        // Avoid double-answering
        if (sentAnswerForRef.current === question_id) return;
        sentAnswerForRef.current = question_id;

        // Find my character and evaluate the question against it
        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const myChar = state.characters.find((c) => c.id === mySecretId);
        const q = QUESTIONS.find((q) => q.id === question_id);

        if (!q || !myChar) {
          console.warn('[sync] Cannot evaluate question — missing data', { question_id, mySecretId });
          return;
        }

        const answer = evaluateQuestion(q, myChar);
        const opponentPlayerNum = onlinePlayerNum === 1 ? 2 : 1;

        // Send answer back
        const answerIdemKey = `a_${state.onlineGameId}_${onlinePlayerNum}_${question_id}`;
        sendEvent(
          state.onlineGameId!,
          'ANSWER_GIVEN',
          opponentPlayerNum,
          myAddress(),
          event.turn_number,
          { answer, question_id },
          answerIdemKey
        ).catch(console.error);

        // Update local state: show the question + answer as if I received it
        state.receiveOpponentQuestion(question_id, answer);
        break;
      }

      case 'ANSWER_GIVEN': {
        const { answer } = event.payload as { answer: boolean };
        state.applyOpponentAnswer(answer);
        break;
      }

      case 'ELIMINATION_UPDATE': {
        const { eliminated_ids } = event.payload as { eliminated_ids: string[] };
        state.receiveOpponentElimination(eliminated_ids);
        break;
      }

      case 'GUESS_MADE': {
        const { character_id } = event.payload as { character_id: string };

        // Evaluate whether opponent guessed my character correctly
        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const isCorrect = character_id === mySecretId;

        const opponentPlayerNum = (event.player_num as 1 | 2);
        const winnerPlayerNum: 1 | 2 | null = isCorrect ? opponentPlayerNum : null;

        // Tell opponent the result
        const guessResultIdemKey = `gr_${state.onlineGameId}_${onlinePlayerNum}_${character_id}_t${event.turn_number}`;
        sendEvent(
          state.onlineGameId!,
          'GUESS_RESULT',
          onlinePlayerNum === 1 ? 2 : 1,
          myAddress(),
          event.turn_number,
          { is_correct: isCorrect, winner_player_num: winnerPlayerNum },
          guessResultIdemKey
        ).catch(console.error);

        if (isCorrect) {
          finishGame(state.onlineGameId!, opponentPlayerNum as 1 | 2).catch(console.error);
        }

        // Apply to my local state
        state.receiveOpponentGuess(character_id, isCorrect, winnerPlayerNum);
        break;
      }

      case 'GUESS_RESULT': {
        const { is_correct, winner_player_num } = event.payload as {
          is_correct: boolean;
          winner_player_num: 1 | 2 | null;
        };

        const winner: PlayerId | null =
          winner_player_num === 1 ? 'player1' :
            winner_player_num === 2 ? 'player2' :
              null;

        state.applyGuessResult(is_correct, winner);
        break;
      }

      case 'CHARACTER_REVEALED':
        // Show verification badge at game end (future enhancement)
        break;

      default:
        break;
    }
  }
}
