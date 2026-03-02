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
import type { PlayerId } from '@/core/store/types';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { QUESTIONS } from '@/core/data/questions';
import {
  subscribeToGame,
  subscribeToEvents,
  sendEvent,
  finishGame,
  submitCommitment,
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

  // Refs to avoid stale closures in event handlers
  const sentQuestionRef = useRef<string | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const sentAnswerForRef = useRef<string | null>(null); // question_id we already answered

  const myAddress = () => {
    try {
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
          console.log('[sync] Advancing to game start (direct check)');
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

  // ─── Send QUESTION_ASKED when I ask a question ────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING) return;
    if (!currentQuestion) return;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';

    // Only send if I asked the question and haven't sent it yet
    if (currentQuestion.askedBy !== myPlayerKey) return;
    if (sentQuestionRef.current === currentQuestion.questionId) return;

    sentQuestionRef.current = currentQuestion.questionId;

    sendEvent(
      onlineGameId,
      'QUESTION_ASKED',
      onlinePlayerNum,
      myAddress(),
      currentQuestion.turnNumber,
      { question_id: currentQuestion.questionId }
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.questionId]);

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

    sendEvent(
      onlineGameId,
      'GUESS_MADE',
      onlinePlayerNum,
      myAddress(),
      turnNumber,
      { character_id: guessedCharacterId }
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCharacterId, phase]);

  // ─── Handle game meta updates (status changes) ────────────────────────────
  function handleGameUpdate(game: SupabaseGame) {
    const state = useGameStore.getState();
    if (game.status === 'in_progress' && state.phase === GamePhase.ONLINE_WAITING) {
      console.log('[sync] Game started via realtime subscription');
      state.advanceToGameStart();
    }
  }

  // ─── Handle incoming events from opponent ─────────────────────────────────
  function handleEvent(event: SupabaseGameEvent) {
    const isFromMe = event.player_num === onlinePlayerNum;
    if (isFromMe) return; // ignore own events (we already applied them locally)

    const state = useGameStore.getState();

    switch (event.event_type) {
      case 'CHARACTER_COMMITTED': {
        // Opponent has committed their character.
        // Check game status directly — this fires before (or instead of) the
        // games-table realtime update, so it's the fastest path to advancing.
        if (state.phase === GamePhase.ONLINE_WAITING && state.onlineGameId) {
          console.log('[sync] Opponent committed — checking game status');
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
        sendEvent(
          state.onlineGameId!,
          'ANSWER_GIVEN',
          opponentPlayerNum,
          myAddress(),
          event.turn_number,
          { answer, question_id }
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

      case 'GUESS_MADE': {
        const { character_id } = event.payload as { character_id: string };

        // Evaluate whether opponent guessed my character correctly
        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const isCorrect = character_id === mySecretId;

        const opponentPlayerNum = (event.player_num as 1 | 2);
        const winnerPlayerNum: 1 | 2 | null = isCorrect ? opponentPlayerNum : null;

        // Tell opponent the result
        sendEvent(
          state.onlineGameId!,
          'GUESS_RESULT',
          onlinePlayerNum === 1 ? 2 : 1,
          myAddress(),
          event.turn_number,
          { is_correct: isCorrect, winner_player_num: winnerPlayerNum }
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
