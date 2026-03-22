/**
 * useOnlineGameSync — Server-Authoritative State Machine
 *
 * All game state flows through the Supabase `games` row:
 *   - Active player writes phase/question/elimination to DB
 *   - Non-active player reads from DB via postgres_changes realtime
 *   - Guesses use game_events (INSERT-based) for latency
 *   - Presence channel detects disconnects
 *
 * The old broadcast-based event system (QUESTION_ASKED, ANSWER_GIVEN,
 * ELIMINATION_UPDATE) is removed. The DB row is the single source of truth.
 */
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/core/store/gameStore';
import { GamePhase } from '@/core/store/types';
import type { PlayerId, QuestionRecord } from '@/core/store/types';

const DISCONNECT_TIMEOUT_S = 60;
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { QUESTIONS } from '@/core/data/questions';
import {
  subscribeToGame,
  subscribeToEvents,
  sendEvent,
  finishGame,
  submitCommitment,
  updateTurn,
  updateGameState,
  getGame,
  getPastEvents,
} from '@/services/supabase/gameService';
import type { SupabaseGame, SupabaseGameEvent } from '@/services/supabase/types';
import { supabase } from '@/services/supabase/client';
import { getCommitment } from '@/services/starknet/commitReveal';

export function useOnlineGameSync(): { opponentDisconnected: boolean } {
  const phase = useGameStore((s) => s.phase);
  const mode = useGameStore((s) => s.mode);
  const onlineGameId = useGameStore((s) => s.onlineGameId);
  const onlinePlayerNum = useGameStore((s) => s.onlinePlayerNum);
  const currentQuestion = useGameStore((s) => s.currentQuestion);
  const guessedCharacterId = useGameStore((s) => s.guessedCharacterId);
  const turnNumber = useGameStore((s) => s.turnNumber);
  const activePlayer = useGameStore((s) => s.activePlayer);

  // Refs for dedup and state tracking
  const lastWrittenQuestionRef = useRef<string | null>(null);
  const lastWrittenEliminationTurnRef = useRef<number>(0);
  const lastPushedTurnRef = useRef<number>(0);
  const lastAnsweredQuestionRef = useRef<string | null>(null);
  const sentGuessRef = useRef<string | null>(null);
  const myGuessTimestampRef = useRef<number>(0);
  const processedEventIds = useRef<Set<string>>(new Set());
  const recoveryAttemptedRef = useRef(false);
  const [opponentDisconnected, setOpponentDisconnected] = useState(false);

  const myAddress = () => {
    try {
      const { useWalletStore } = require('@/services/starknet/walletStore');
      return useWalletStore.getState().address ?? 'anonymous';
    } catch {
      return 'anonymous';
    }
  };

  // ─── Helper: poll game status and advance if in_progress ─────────────────
  async function checkAndAdvanceIfReady(gameId: string) {
    try {
      const { data: game } = await supabase
        .from('games')
        .select('*')
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

  // ─── Subscribe to DB changes + events ────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;

    // Reset all refs for a fresh game session
    lastWrittenQuestionRef.current = null;
    lastWrittenEliminationTurnRef.current = 0;
    lastPushedTurnRef.current = 0;
    lastAnsweredQuestionRef.current = null;
    sentGuessRef.current = null;
    myGuessTimestampRef.current = 0;
    processedEventIds.current.clear();
    recoveryAttemptedRef.current = false;

    const gameSub = subscribeToGame(onlineGameId, handleGameUpdate);
    const eventSub = subscribeToEvents(onlineGameId, handleEvent);

    return () => {
      supabase.removeChannel(gameSub);
      supabase.removeChannel(eventSub);
    };
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ─── Presence heartbeat ──────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;

    const presenceChannel = supabase.channel(`presence:${onlineGameId}`);
    let opponentLastSeen = Date.now();
    setOpponentDisconnected(false);

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const allPresences = Object.values(presenceChannel.presenceState()).flat() as unknown as { player_num: number | string }[];
        const opponentPresent = allPresences.some(
          (p) => Number(p.player_num) !== Number(onlinePlayerNum)
        );
        if (opponentPresent) {
          opponentLastSeen = Date.now();
          setOpponentDisconnected(false);
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ player_num: onlinePlayerNum });
        }
      });

    const checkInterval = setInterval(() => {
      if ((Date.now() - opponentLastSeen) / 1000 > DISCONNECT_TIMEOUT_S) {
        setOpponentDisconnected(true);
      }
    }, 5000);

    return () => {
      clearInterval(checkInterval);
      presenceChannel.untrack();
      supabase.removeChannel(presenceChannel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, onlineGameId, onlinePlayerNum]);

  // ─── Push commitment to Supabase ─────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;

    const state = useGameStore.getState();
    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    const commitment = getCommitment(myPlayerKey, state.gameSessionId);
    if (!commitment) return;

    const gameId = onlineGameId;
    submitCommitment(gameId, onlinePlayerNum, commitment.commitment, myAddress(), 1)
      .then(() => checkAndAdvanceIfReady(gameId))
      .catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Poll for game start ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ONLINE_WAITING) return;

    const gameId = onlineGameId;
    const intervalId = setInterval(() => checkAndAdvanceIfReady(gameId), 3000);
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ─── Recovery on rejoin ──────────────────────────────────────────────────
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
        if (!game) return;
        if (game.status === 'finished') {
          const winnerKey = game.winner_player_num === 1 ? 'player1' : game.winner_player_num === 2 ? 'player2' : null;
          useGameStore.setState({ winner: winnerKey, phase: GamePhase.GAME_OVER });
          return;
        }
        if (game.status !== 'in_progress') return;

        // Recover from DB state directly (server-authoritative)
        const state = useGameStore.getState();
        const myPlayerKey: PlayerId = playerNum === 1 ? 'player1' : 'player2';
        const commitment = getCommitment(myPlayerKey, state.gameSessionId);
        const mySecretId = commitment?.characterId ?? state.players[myPlayerKey].secretCharacterId;

        // Rebuild question history from events (DB row only has current question)
        const events = await getPastEvents(gameId);
        const questionHistory: QuestionRecord[] = [];

        for (const evt of events) {
          const evtPlayerKey: PlayerId = evt.player_num === 1 ? 'player1' : 'player2';
          if (evt.event_type === 'QUESTION_ASKED') {
            const { question_id } = evt.payload as { question_id: string };
            const q = QUESTIONS.find((qn) => qn.id === question_id);
            if (q) {
              const answerEvt = events.find(
                (e) => e.event_type === 'ANSWER_GIVEN' &&
                  (e.payload as any).question_id === question_id
              );
              questionHistory.push({
                questionId: question_id,
                questionText: q.text,
                traitKey: q.traitKey,
                traitValue: q.traitValue,
                answer: answerEvt ? (answerEvt.payload as any).answer as boolean : null,
                askedBy: evtPlayerKey,
                turnNumber: evt.turn_number,
              });
            }
          }
          processedEventIds.current.add(evt.idempotency_key ?? evt.id);
        }

        // Use DB elimination arrays (authoritative)
        const myEliminated = playerNum === 1 ? (game.eliminated_p1 || []) : (game.eliminated_p2 || []);
        const oppEliminated = playerNum === 1 ? (game.eliminated_p2 || []) : (game.eliminated_p1 || []);

        state.restoreFromEvents(
          game.turn_number || 1,
          questionHistory,
          myEliminated,
          oppEliminated,
          mySecretId ?? null,
        );

        // Snap to DB phase/activePlayer
        if (game.current_phase) {
          useGameStore.setState({ phase: game.current_phase as GamePhase });
        }
        if (game.active_player_num) {
          const nextPlayer: PlayerId = game.active_player_num === 1 ? 'player1' : 'player2';
          useGameStore.setState({
            activePlayer: nextPlayer,
            boardRotation: nextPlayer === 'player1' ? 0 : Math.PI,
          });
        }

        console.log(`[sync] Recovered: turn=${game.turn_number}, phase=${game.current_phase}, questions=${questionHistory.length}`);
      } catch (err) {
        console.error('[sync] Recovery failed', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, mode, onlineGameId, onlinePlayerNum]);

  // ═══════════════════════════════════════════════════════════════════════════
  // DB WRITE EFFECTS — active player pushes state changes to DB
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── Write question to DB when I ask one ────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.ANSWER_PENDING || !currentQuestion) return;

    const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
    if (currentQuestion.askedBy !== myPlayerKey) return;
    if (lastWrittenQuestionRef.current === currentQuestion.questionId) return;
    lastWrittenQuestionRef.current = currentQuestion.questionId;

    // Write question + phase to DB — opponent will see it via realtime
    updateGameState(onlineGameId, {
      current_phase: 'ANSWER_PENDING',
      current_question: currentQuestion as any,
    }).catch(console.error);

    // Also log as event for history recovery
    const idemKey = `q_${onlineGameId}_${onlinePlayerNum}_${currentQuestion.questionId}`;
    sendEvent(
      onlineGameId, 'QUESTION_ASKED', onlinePlayerNum, myAddress(),
      currentQuestion.turnNumber, { question_id: currentQuestion.questionId }, idemKey
    ).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentQuestion?.questionId]);

  // ─── Write elimination to DB after AUTO_ELIMINATING phase starts ────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase !== GamePhase.AUTO_ELIMINATING) return;
    if (turnNumber <= lastWrittenEliminationTurnRef.current) return;
    lastWrittenEliminationTurnRef.current = turnNumber;

    const state = useGameStore.getState();
    updateGameState(onlineGameId, {
      current_phase: 'AUTO_ELIMINATING',
      eliminated_p1: state.players.player1.eliminatedCharacterIds,
      eliminated_p2: state.players.player2.eliminatedCharacterIds,
    }).catch(console.error);

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, turnNumber, mode, onlineGameId, onlinePlayerNum]);

  // ─── Push turn swap to DB ───────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    if (phase === GamePhase.MENU || phase === GamePhase.SETUP_P1 || phase === GamePhase.SETUP_P2 || phase === GamePhase.ONLINE_WAITING) return;
    if (turnNumber <= lastPushedTurnRef.current) return;
    lastPushedTurnRef.current = turnNumber;

    const activePlayerNum: 1 | 2 = activePlayer === 'player1' ? 1 : 2;
    updateTurn(onlineGameId, activePlayerNum, turnNumber).catch((err) =>
      console.error('[sync] updateTurn failed', err)
    );
  }, [turnNumber, phase, mode, onlineGameId, onlinePlayerNum, activePlayer]);

  // ─── Send GUESS_MADE when I make a guess ────────────────────────────────
  useEffect(() => {
    if (mode !== 'online' || !onlineGameId || !onlinePlayerNum) return;
    // Guess sets phase to GUESS_WRONG or GUESS_RESULT, not ANSWER_PENDING
    if (phase !== GamePhase.GUESS_WRONG && phase !== GamePhase.GUESS_RESULT) return;
    if (!guessedCharacterId) return;
    if (sentGuessRef.current === guessedCharacterId) return;

    sentGuessRef.current = guessedCharacterId;
    myGuessTimestampRef.current = Date.now();

    const idemKey = `g_${onlineGameId}_${onlinePlayerNum}_${guessedCharacterId}_t${turnNumber}`;
    sendEvent(
      onlineGameId, 'GUESS_MADE', onlinePlayerNum, myAddress(), turnNumber,
      { character_id: guessedCharacterId, timestamp: myGuessTimestampRef.current }, idemKey
    ).catch(console.error);

    // Also write phase to DB for guess outcomes
    const state = useGameStore.getState();
    if (phase === GamePhase.GUESS_RESULT) {
      const winnerPlayerNum: 1 | 2 = state.winner === 'player1' ? 1 : 2;
      finishGame(onlineGameId, winnerPlayerNum).catch(console.error);
      updateGameState(onlineGameId, { current_phase: 'GUESS_RESULT' }).catch(console.error);
    } else {
      updateGameState(onlineGameId, { current_phase: 'GUESS_WRONG' }).catch(console.error);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [guessedCharacterId, phase]);

  // ═══════════════════════════════════════════════════════════════════════════
  // INCOMING: Handle DB row updates (server-authoritative state machine)
  // ═══════════════════════════════════════════════════════════════════════════

  function handleGameUpdate(game: SupabaseGame) {
    const state = useGameStore.getState();

    // Game start
    if (game.status === 'in_progress' && state.phase === GamePhase.ONLINE_WAITING) {
      state.advanceToGameStart();
      return;
    }

    // Game finished
    if (game.status === 'finished') {
      if (state.phase !== GamePhase.GAME_OVER && state.phase !== GamePhase.GUESS_RESULT) {
        const winnerKey = game.winner_player_num === 1 ? 'player1' : game.winner_player_num === 2 ? 'player2' : null;
        useGameStore.setState({ winner: winnerKey, phase: GamePhase.GUESS_RESULT });
      }
      return;
    }

    // Skip sync during setup
    if (state.phase === GamePhase.ONLINE_WAITING || state.phase === GamePhase.MENU) return;

    // Auto-answer: if DB says ANSWER_PENDING and the question was asked by the opponent,
    // I (the answerer) evaluate and write the answer back to DB.
    const myPlayerNum = state.onlinePlayerNum;
    const myPlayerKey: PlayerId = myPlayerNum === 1 ? 'player1' : 'player2';

    if (game.current_phase === 'ANSWER_PENDING' && game.current_question) {
      const question = game.current_question as unknown as QuestionRecord;

      if (question.askedBy !== myPlayerKey && lastAnsweredQuestionRef.current !== question.questionId) {
        lastAnsweredQuestionRef.current = question.questionId;

        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const myChar = state.characters.find((c) => c.id === mySecretId);
        const q = QUESTIONS.find((q) => q.id === question.questionId);

        if (q && myChar && state.onlineGameId) {
          const answer = evaluateQuestion(q, myChar);
          console.log(`[sync] Auto-answering question ${question.questionId}: ${answer}`);

          updateGameState(state.onlineGameId, {
            current_phase: 'ANSWER_REVEALED',
            current_answer: answer,
          }).catch(console.error);

          // Also log as event for history recovery
          const answerIdemKey = `a_${state.onlineGameId}_${myPlayerNum}_${question.questionId}`;
          sendEvent(
            state.onlineGameId, 'ANSWER_GIVEN', myPlayerNum!, myAddress(),
            question.turnNumber, { answer, question_id: question.questionId }, answerIdemKey
          ).catch(console.error);
        }
        return; // Don't sync yet — wait for the ANSWER_REVEALED update
      }
    }

    // Master sync: snap local state from DB row
    state.syncOnlineStateFromDB(game);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // INCOMING: Handle game_events (only GUESS_MADE/GUESS_RESULT/COMMITTED)
  // ═══════════════════════════════════════════════════════════════════════════

  function handleEvent(event: SupabaseGameEvent) {
    const isFromMe = event.player_num === onlinePlayerNum;
    if (isFromMe) return;

    const eventKey = event.idempotency_key ?? event.id;
    if (processedEventIds.current.has(eventKey)) return;
    processedEventIds.current.add(eventKey);

    const state = useGameStore.getState();

    switch (event.event_type) {
      case 'CHARACTER_COMMITTED': {
        if (state.phase === GamePhase.ONLINE_WAITING && state.onlineGameId) {
          checkAndAdvanceIfReady(state.onlineGameId);
        }
        break;
      }

      case 'GUESS_MADE': {
        const { character_id, timestamp: opponentTimestamp } = event.payload as {
          character_id: string;
          timestamp?: number;
        };

        const myPlayerKey: PlayerId = onlinePlayerNum === 1 ? 'player1' : 'player2';
        const mySecretId = state.players[myPlayerKey].secretCharacterId;
        const isCorrect = character_id === mySecretId;
        const opponentPlayerNum = event.player_num as 1 | 2;

        let winnerPlayerNum: 1 | 2 | null = isCorrect ? opponentPlayerNum : null;

        // Simultaneous guess tiebreaker
        if (isCorrect && state.phase === GamePhase.GUESS_RESULT && state.winner === myPlayerKey) {
          const myTs = myGuessTimestampRef.current || 0;
          const oppTs = opponentTimestamp || 0;
          winnerPlayerNum = (myTs && oppTs)
            ? (myTs <= oppTs ? (onlinePlayerNum as 1 | 2) : opponentPlayerNum)
            : 1;
        }

        // Send result back via event
        const idemKey = `gr_${state.onlineGameId}_${onlinePlayerNum}_${character_id}_t${event.turn_number}`;
        sendEvent(
          state.onlineGameId!, 'GUESS_RESULT', onlinePlayerNum!, myAddress(),
          event.turn_number, { is_correct: isCorrect, winner_player_num: winnerPlayerNum }, idemKey
        ).catch(console.error);

        if (isCorrect) {
          finishGame(state.onlineGameId!, winnerPlayerNum!).catch(console.error);
        }

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
            winner_player_num === 2 ? 'player2' : null;
        state.applyGuessResult(is_correct, winner);
        break;
      }

      default:
        break;
    }
  }

  return { opponentDisconnected };
}
