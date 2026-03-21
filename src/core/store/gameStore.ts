import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GamePhase, GameState, GameActions, PlayerId } from './types';
import { QUESTIONS } from '@/core/data/questions';
import { CHARACTERS } from '@/core/data/characters';
import type { Character } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { createCommitment, generateGameSessionId, clearCommitments } from '@/services/starknet/commitReveal';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { enrichCharacters } from '@/core/data/nftCharacterAdapter';

function getOpponent(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
}

/**
 * Pick the question that splits CPU's remaining characters closest to 50/50.
 * Used internally to drive simultaneous CPU questions in free mode.
 */
function pickBestQuestionForCPU(
  remaining: Character[],
  askedIds: Set<string>,
) {
  const available = QUESTIONS.filter((q) => !askedIds.has(q.id));
  if (available.length === 0) return null;

  // Optimisation: for massive pools, sample a subset to find a good-enough split
  // 30,000 evaluations (30 questions * 1000 chars) is too slow for a state update.
  const sample = remaining.length > 100
    ? [...remaining].sort(() => Math.random() - 0.5).slice(0, 50)
    : remaining;

  let best = available[0];
  let bestScore = Infinity;
  for (const q of available) {
    const yesCount = sample.filter((c) => evaluateQuestion(q, c)).length;
    const noCount = sample.length - yesCount;
    const score = Math.abs(yesCount - noCount);
    if (score < bestScore) { bestScore = score; best = q; }
  }
  return best;
}

const initialState: GameState = {
  phase: GamePhase.MENU,
  mode: 'free',
  characters: CHARACTERS,
  activePlayer: 'player1',
  turnNumber: 1,
  boardRotation: 0,
  players: {
    player1: { secretCharacterId: null, eliminatedCharacterIds: [] },
    player2: { secretCharacterId: null, eliminatedCharacterIds: [] },
  },
  currentQuestion: null,
  cpuQuestion: null,
  questionHistory: [],
  winner: null,
  guessedCharacterId: null,
  gameSessionId: generateGameSessionId(),
  commitmentStatus: 'none',
  onlineGameId: null,
  onlineRoomCode: null,
  onlinePlayerNum: null,
  soundEnabled: true,
  dangerZoneEnabled: true,
};

export const useGameStore = create<GameState & GameActions>()(
  immer((set) => ({
    ...initialState,

    setGameMode: (mode, characters) =>
      set((state) => {
        state.mode = mode;
        if (characters) {
          state.characters = characters;
        } else {
          state.characters = CHARACTERS;
        }
      }),

    startSetup: () =>
      set((state) => {
        state.phase = GamePhase.SETUP_P1;
      }),

    selectSecretCharacter: (player, characterId) =>
      set((state) => {
        state.players[player].secretCharacterId = characterId;

        if (state.mode === 'nft' || state.mode === 'online') {
          createCommitment(player, characterId, state.gameSessionId);
        }

        if (state.mode === 'online') {
          // Online mode: after selecting, wait for opponent to also commit.
          // Always set to 'partial' — the DB trigger transitions to 'in_progress'
          // (and advanceToGameStart sets 'both') when the opponent also commits.
          state.commitmentStatus = 'partial';
          state.phase = GamePhase.ONLINE_WAITING;
          return;
        }

        if (player === 'player1') {
          if (state.mode === 'free' || state.mode === 'nft-free') {
            // CPU picks a random character automatically
            const pool = state.characters.filter((c) => c.id !== characterId);
            const cpuPick = pool[Math.floor(Math.random() * pool.length)];
            if (cpuPick) state.players.player2.secretCharacterId = cpuPick.id;
            state.commitmentStatus = 'both';
            state.phase = GamePhase.HANDOFF_START;
          } else {
            state.commitmentStatus = 'partial';
            state.phase = GamePhase.HANDOFF_P1_TO_P2;
          }
        } else {
          state.commitmentStatus = 'both';
          state.phase = GamePhase.HANDOFF_START;
        }
      }),

    assignRandomSecretCharacter: (player) =>
      set((state) => {
        const pool = state.characters;
        const randomChar = pool[Math.floor(Math.random() * pool.length)];
        if (!randomChar) return;

        state.players[player].secretCharacterId = randomChar.id;

        if (state.mode === 'nft' || state.mode === 'online') {
          createCommitment(player, randomChar.id, state.gameSessionId);
        }

        if (state.mode === 'online') {
          state.commitmentStatus = 'partial';
          state.phase = GamePhase.ONLINE_WAITING;
          return;
        }

        if (player === 'player1') {
          if (state.mode === 'free' || state.mode === 'nft-free') {
            const opponentPool = state.characters.filter((c) => c.id !== randomChar.id);
            const cpuPick = opponentPool[Math.floor(Math.random() * opponentPool.length)];
            if (cpuPick) state.players.player2.secretCharacterId = cpuPick.id;
            state.commitmentStatus = 'both';
            state.phase = GamePhase.HANDOFF_START;
          } else {
            state.commitmentStatus = 'partial';
            state.phase = GamePhase.HANDOFF_P1_TO_P2;
          }
        } else {
          state.commitmentStatus = 'both';
          state.phase = GamePhase.HANDOFF_START;
        }
      }),

    advancePhase: () =>
      set((state) => {
        switch (state.phase) {
          case GamePhase.HANDOFF_P1_TO_P2:
            state.phase = GamePhase.SETUP_P2;
            break;
          case GamePhase.HANDOFF_START:
            state.activePlayer = 'player1';
            state.boardRotation = 0;
            state.phase = GamePhase.QUESTION_SELECT;
            break;
          case GamePhase.HANDOFF_TO_OPPONENT:
            state.phase = GamePhase.ANSWER_PENDING;
            break;
          case GamePhase.ANSWER_REVEALED: {
            // Apply P1's elimination based on their question
            const q = state.currentQuestion;
            if (q) {
              const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
              const fullQuestion = QUESTIONS.find((qn) => qn.id === q.questionId);
              if (fullQuestion) {
                const elimSet = new Set(eliminated);
                for (const char of state.characters) {
                  if (elimSet.has(char.id)) continue;
                  const matchesQuestion = evaluateQuestion(fullQuestion, char);
                  const shouldEliminate = q.answer ? !matchesQuestion : matchesQuestion;
                  if (shouldEliminate) {
                    eliminated.push(char.id);
                  }
                }
              }
            }
            // In free/nft-free mode: simultaneously apply CPU's elimination
            if ((state.mode === 'free' || state.mode === 'nft-free') && state.cpuQuestion) {
              const cpuQ = state.cpuQuestion;
              const cpuEliminated = state.players.player2.eliminatedCharacterIds;
              const fullCpuQ = QUESTIONS.find((qn) => qn.id === cpuQ.questionId);
              if (fullCpuQ) {
                const cpuElimSet = new Set(cpuEliminated);
                for (const char of state.characters) {
                  if (cpuElimSet.has(char.id)) continue;
                  const matchesQuestion = evaluateQuestion(fullCpuQ, char);
                  const shouldEliminate = cpuQ.answer ? !matchesQuestion : matchesQuestion;
                  if (shouldEliminate) {
                    cpuEliminated.push(char.id);
                  }
                }
              }

              // CPU auto-win: if down to 1 remaining, auto-guess
              const cpuElimSetFinal = new Set(cpuEliminated);
              const cpuRemaining = state.characters.filter(
                (c) => !cpuElimSetFinal.has(c.id)
              );
              if (cpuRemaining.length === 1) {
                state.guessedCharacterId = cpuRemaining[0].id;
                state.activePlayer = 'player2';
                const p1Secret = state.players.player1.secretCharacterId;
                if (cpuRemaining[0].id === p1Secret) {
                  state.winner = 'player2';
                  state.phase = GamePhase.GUESS_RESULT;
                } else {
                  state.phase = GamePhase.GUESS_WRONG;
                }
                return;
              }
            }
            state.phase = GamePhase.AUTO_ELIMINATING;
            break;
          }
          case GamePhase.AUTO_ELIMINATING: {
            if (state.mode === 'free' || state.mode === 'nft-free') {
              // Simultaneous mode: P1 always stays active, no player switching
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.cpuQuestion = null;
              state.phase = GamePhase.TURN_TRANSITION;
            } else if (state.mode === 'online') {
              // Online strict turn-based: swap active player after each Q&A cycle
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.phase = GamePhase.TURN_TRANSITION;
            } else {
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.phase = GamePhase.TURN_TRANSITION;
            }
            break;
          }
          case GamePhase.TURN_TRANSITION:
            state.phase = GamePhase.QUESTION_SELECT;
            break;
          case GamePhase.GUESS_WRONG: {
            if (state.mode === 'online') {
              // Online strict turn-based: swap active player after wrong guess
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.guessedCharacterId = null;
              state.phase = GamePhase.TURN_TRANSITION;
              break;
            }

            if (state.mode === 'free' || state.mode === 'nft-free') {
              // Simultaneous mode: local player stays active, no player switching
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.cpuQuestion = null;
              state.guessedCharacterId = null;

              {
                // Opponent (CPU) gets a free question because player risked it and failed!
                const cpuEliminated = state.players.player2.eliminatedCharacterIds;
                const cpuElimSet = new Set(cpuEliminated);
                const cpuRemaining = state.characters.filter((c) => !cpuElimSet.has(c.id));
                const cpuAskedIds = new Set(
                  state.questionHistory
                    .filter((r) => r.askedBy === 'player2')
                    .map((r) => r.questionId),
                );

                const cpuBestQ = pickBestQuestionForCPU(cpuRemaining, cpuAskedIds);
                if (cpuBestQ) {
                  const p1SecretId = state.players.player1.secretCharacterId;
                  const p1SecretChar = state.characters.find((c) => c.id === p1SecretId);
                  const cpuAnswer = p1SecretChar ? evaluateQuestion(cpuBestQ, p1SecretChar) : false;

                  const cpuRecord = {
                    questionId: cpuBestQ.id,
                    questionText: cpuBestQ.text,
                    traitKey: cpuBestQ.traitKey,
                    traitValue: cpuBestQ.traitValue,
                    answer: cpuAnswer,
                    askedBy: 'player2' as PlayerId,
                    turnNumber: state.turnNumber,
                  };
                  state.cpuQuestion = cpuRecord;
                  state.questionHistory.push(cpuRecord);

                  // Jump straight to ANSWER_REVEALED (so player sees CPU's free question)
                  state.phase = GamePhase.ANSWER_REVEALED;
                } else {
                  state.phase = GamePhase.TURN_TRANSITION;
                }
              }
            } else {
              const next = getOpponent(state.activePlayer);
              state.activePlayer = next;
              state.boardRotation = next === 'player1' ? 0 : Math.PI;
              state.turnNumber += 1;
              state.currentQuestion = null;
              state.guessedCharacterId = null;
              state.phase = GamePhase.TURN_TRANSITION;
            }
            break;
          }
          case GamePhase.GUESS_RESULT:
            state.phase = GamePhase.GAME_OVER;
            break;
        }
      }),

    askQuestion: (questionId) =>
      set((state) => {
        const q = QUESTIONS.find((q) => q.id === questionId);
        if (!q) return;

        // Local mode: auto-evaluate active player's question immediately
        const opponent = getOpponent(state.activePlayer);
        const secretId = state.players[opponent].secretCharacterId;
        const secretChar = state.characters.find((c) => c.id === secretId);
        const autoAnswer = secretChar ? evaluateQuestion(q, secretChar) : false;

        const record = {
          questionId,
          questionText: q.text,
          traitKey: q.traitKey,
          traitValue: q.traitValue,
          answer: autoAnswer,
          askedBy: state.activePlayer,
          turnNumber: state.turnNumber,
        };

        state.currentQuestion = record;
        state.questionHistory.push(record);

        // Free/nft-free mode: CPU simultaneously picks and answers its own question
        if (state.mode === 'free' || state.mode === 'nft-free') {
          const cpuEliminated = state.players.player2.eliminatedCharacterIds;
          const cpuElimSet = new Set(cpuEliminated);
          const cpuRemaining = state.characters.filter((c) => !cpuElimSet.has(c.id));
          const cpuAskedIds = new Set(
            state.questionHistory
              .filter((r) => r.askedBy === 'player2')
              .map((r) => r.questionId),
          );

          const cpuBestQ = pickBestQuestionForCPU(cpuRemaining, cpuAskedIds);
          if (cpuBestQ) {
            const p1SecretId = state.players.player1.secretCharacterId;
            const p1SecretChar = state.characters.find((c) => c.id === p1SecretId);
            const cpuAnswer = p1SecretChar ? evaluateQuestion(cpuBestQ, p1SecretChar) : false;

            const cpuRecord = {
              questionId: cpuBestQ.id,
              questionText: cpuBestQ.text,
              traitKey: cpuBestQ.traitKey,
              traitValue: cpuBestQ.traitValue,
              answer: cpuAnswer,
              askedBy: 'player2' as PlayerId,
              turnNumber: state.turnNumber,
            };
            state.cpuQuestion = cpuRecord;
            state.questionHistory.push(cpuRecord);
          }
        }

        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    answerQuestion: (answer) =>
      set((state) => {
        if (!state.currentQuestion) return;
        state.currentQuestion.answer = answer;
        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    toggleElimination: (characterId) =>
      set((state) => {
        const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
        const idx = eliminated.indexOf(characterId);
        if (idx >= 0) {
          eliminated.splice(idx, 1);
        } else {
          eliminated.push(characterId);
        }
      }),

    finishElimination: () =>
      set((state) => {
        const next = getOpponent(state.activePlayer);
        state.activePlayer = next;
        state.boardRotation = next === 'player1' ? 0 : Math.PI;
        state.turnNumber += 1;
        state.currentQuestion = null;
        state.phase = GamePhase.TURN_TRANSITION;
      }),

    startGuess: () =>
      set((state) => {
        state.phase = GamePhase.GUESS_SELECT;
      }),

    cancelGuess: () =>
      set((state) => {
        if (state.mode === 'online') {
          // Online mode: cancelling a guess just returns to question select.
          // Never swap activePlayer or increment turn here — that would
          // desynchronize from the authoritative DB turn state.
          state.guessedCharacterId = null;
          state.phase = GamePhase.QUESTION_SELECT;
        } else if (state.currentQuestion && state.mode !== 'free' && state.mode !== 'nft-free') {
          // Non-free modes: cancelling after asking ends the turn
          const next = getOpponent(state.activePlayer);
          state.activePlayer = next;
          state.boardRotation = next === 'player1' ? 0 : Math.PI;
          state.turnNumber += 1;
          state.currentQuestion = null;
          state.phase = GamePhase.TURN_TRANSITION;
        } else {
          // Free mode or no question yet: return to question select
          state.currentQuestion = null;
          state.cpuQuestion = null;
          state.phase = GamePhase.QUESTION_SELECT;
        }
      }),

    makeGuess: (characterId) =>
      set((state) => {
        state.guessedCharacterId = characterId;

        if (state.mode === 'online') {
          // In true simultaneous online mode, we instantly check against opponent's locally-known secret.
          // Note: The sync hook already verifies Game Over conditions. 
          const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1';
          const opponentSecretId = state.players[opponent].secretCharacterId;
          const isCorrect = characterId === opponentSecretId;

          if (isCorrect) {
            state.winner = state.activePlayer;
            state.phase = GamePhase.GUESS_RESULT;
          } else {
            state.phase = GamePhase.GUESS_WRONG;
          }
          return;
        }

        // Evaluate the active player's guess
        const opponent = getOpponent(state.activePlayer);
        const opponentSecretId = state.players[opponent].secretCharacterId;
        const p1IsCorrect = characterId === opponentSecretId;

        if (state.mode === 'free' || state.mode === 'nft-free') {
          // Check if CPU simultaneously wants to risk it this round
          const cpuEliminated = state.players.player2.eliminatedCharacterIds;
          const cpuElimSet = new Set(cpuEliminated);
          const cpuRemaining = state.characters.filter((c) => !cpuElimSet.has(c.id));
          let cpuRiskTarget: string | null = null;
          if (cpuRemaining.length === 1) {
            cpuRiskTarget = cpuRemaining[0].id;
          } else if (cpuRemaining.length === 2 && Math.random() < 0.35) {
            cpuRiskTarget = cpuRemaining[Math.floor(Math.random() * 2)].id;
          }

          if (cpuRiskTarget) {
            const p1SecretId = state.players.player1.secretCharacterId;
            const cpuIsCorrect = cpuRiskTarget === p1SecretId;

            if (p1IsCorrect && cpuIsCorrect) {
              // Both correct simultaneously → DRAW
              state.winner = null;
              state.phase = GamePhase.GUESS_RESULT;
            } else if (p1IsCorrect) {
              state.winner = state.activePlayer;
              state.phase = GamePhase.GUESS_RESULT;
            } else if (cpuIsCorrect) {
              state.winner = 'player2';
              state.phase = GamePhase.GUESS_RESULT;
            } else {
              // Both wrong — game continues
              state.phase = GamePhase.GUESS_WRONG;
            }
          } else {
            // CPU doesn't risk this round
            if (p1IsCorrect) {
              state.winner = state.activePlayer;
              state.phase = GamePhase.GUESS_RESULT;
            } else {
              state.phase = GamePhase.GUESS_WRONG;
            }
          }
          return;
        }

        // NFT local pass-and-play mode: non-simultaneous evaluation
        if (p1IsCorrect) {
          state.winner = state.activePlayer;
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          state.phase = GamePhase.GUESS_WRONG;
        }
      }),

    resetGame: () =>
      set((state) => {
        clearCommitments(state.gameSessionId);
        const currentMode = state.mode;
        const currentChars = state.characters;
        Object.assign(state, initialState);
        state.mode = currentMode;
        state.characters = currentChars;
        state.players = {
          player1: { secretCharacterId: null, eliminatedCharacterIds: [] },
          player2: { secretCharacterId: null, eliminatedCharacterIds: [] },
        };
        state.questionHistory = [];
        state.gameSessionId = generateGameSessionId();
        state.commitmentStatus = 'none';
        state.onlineGameId = null;
        state.onlineRoomCode = null;
        state.onlinePlayerNum = null;

        // Clear saved session on explicit reset/game over
        localStorage.removeItem('guessnft_online_session');
      }),

    // ─── Online-specific actions ───────────────────────────────────────────────

    recoverOnlineGame: (characters, currentAddress) =>
      set((state) => {
        const saved = localStorage.getItem('guessnft_online_session');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            
            // 1-hour expiration check
            const ONE_HOUR = 60 * 60 * 1000;
            const isExpired = Date.now() - parsed.timestamp > ONE_HOUR;
            
            // Address check (if we have a current wallet connected)
            const addressMatches = !currentAddress || !parsed.playerAddress || parsed.playerAddress === currentAddress;

            if (!isExpired && addressMatches) {
              state.mode = 'online';
              state.characters = characters;
              state.onlineGameId = parsed.gameId;
              state.onlineRoomCode = parsed.roomCode;
              state.onlinePlayerNum = parsed.playerNum;
              state.phase = GamePhase.ONLINE_WAITING;
            } else {
              localStorage.removeItem('guessnft_online_session');
            }
          } catch (e) {
            localStorage.removeItem('guessnft_online_session');
          }
        }
      }),

    setOnlineGame: (gameId, roomCode, playerNum, playerAddress) =>
      set((state) => {
        state.onlineGameId = gameId;
        state.onlineRoomCode = roomCode;
        state.onlinePlayerNum = playerNum;

        // Save session so we can recover on refresh
        localStorage.setItem('guessnft_online_session', JSON.stringify({
          gameId,
          roomCode,
          playerNum,
          playerAddress,
          timestamp: Date.now()
        }));
      }),

    restoreFromEvents: (turnNumber, questionHistory, myEliminatedIds, opponentEliminatedIds, mySecretCharacterId) =>
      set((state) => {
        const myPlayerKey: PlayerId = state.onlinePlayerNum === 1 ? 'player1' : 'player2';
        const opponentKey: PlayerId = state.onlinePlayerNum === 1 ? 'player2' : 'player1';

        state.turnNumber = turnNumber;
        state.questionHistory = questionHistory;
        state.players[myPlayerKey].eliminatedCharacterIds = myEliminatedIds;
        state.players[opponentKey].eliminatedCharacterIds = opponentEliminatedIds;

        // Restore secret character from localStorage commitment if available
        if (mySecretCharacterId) {
          state.players[myPlayerKey].secretCharacterId = mySecretCharacterId;
        }

        state.commitmentStatus = 'both';
        state.activePlayer = myPlayerKey;
        state.boardRotation = state.onlinePlayerNum === 2 ? Math.PI : 0;
        state.currentQuestion = null;
        state.phase = GamePhase.QUESTION_SELECT;
      }),

    advanceToGameStart: () =>
      set((state) => {
        // Called by sync hook when both players have committed — start the game
        state.commitmentStatus = 'both';
        // Simultaneous mode: active player is always the local user
        state.activePlayer = state.onlinePlayerNum === 2 ? 'player2' : 'player1';
        // Rotation is 0 for P1, PI for P2
        state.boardRotation = state.onlinePlayerNum === 2 ? Math.PI : 0;
        state.phase = GamePhase.QUESTION_SELECT;
      }),

    receiveOpponentQuestion: (questionId, answer) =>
      set((state) => {
        const q = QUESTIONS.find((q) => q.id === questionId);
        if (!q) return;

        // Opponent asked a question. In simultaneous play, we record it 
        // to our history logs but DO NOT interrupt the local player's phase.
        const opponent = state.activePlayer === 'player1' ? 'player2' : 'player1';

        const record = {
          questionId,
          questionText: q.text,
          traitKey: q.traitKey,
          traitValue: q.traitValue,
          answer,
          askedBy: opponent as PlayerId,
          turnNumber: state.turnNumber,
        };
        // Add to history so "Enemy Knows" card updates, but don't touch currentQuestion or phase
        state.questionHistory.push(record);
      }),

    applyOpponentAnswer: (answer) =>
      set((state) => {
        // No longer used in decoupled mode, opponent's answer comes immediately
      }),

    receiveOpponentGuess: (characterId, isCorrect, winnerPlayerNum) =>
      set((state) => {
        if (isCorrect && winnerPlayerNum !== null) {
          // If opponent guessed right, game over. Set guessedCharacterId for ResultScreen.
          state.guessedCharacterId = characterId;
          state.winner = winnerPlayerNum === 1 ? 'player1' : 'player2';
          state.phase = GamePhase.GUESS_RESULT;
        }
        // Opponent guessed wrong — don't set guessedCharacterId (would corrupt local state).
      }),

    receiveOpponentElimination: (eliminatedIds) =>
      set((state) => {
        // Opponent broadcasts their eliminatedIds — merge into their player slot
        // In online mode, opponent is derived from onlinePlayerNum, not activePlayer
        const opponent: PlayerId = state.onlinePlayerNum
          ? (state.onlinePlayerNum === 1 ? 'player2' : 'player1')
          : (state.activePlayer === 'player1' ? 'player2' : 'player1');
        const current = state.players[opponent].eliminatedCharacterIds;
        const currentSet = new Set(current);
        for (const id of eliminatedIds) {
          if (!currentSet.has(id)) {
            current.push(id);
          }
        }
      }),

    applyGuessResult: (isCorrect, winner) =>
      set((state) => {
        if (isCorrect && winner !== null) {
          state.winner = winner;
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          state.phase = GamePhase.GUESS_WRONG;
        }
      }),

    syncOnlineTurn: (activePlayerNum, turnNumber) =>
      set((state) => {
        if (state.mode !== 'online') return;
        // Only advance turn if we're not already past this turn number
        if (turnNumber <= state.turnNumber) return;

        const nextPlayer: PlayerId = activePlayerNum === 1 ? 'player1' : 'player2';
        const myPlayerKey: PlayerId = state.onlinePlayerNum === 1 ? 'player1' : 'player2';

        state.turnNumber = turnNumber;
        state.activePlayer = nextPlayer;
        state.boardRotation = nextPlayer === 'player1' ? 0 : Math.PI;

        // Clear current question so the question select screen is unblocked
        state.currentQuestion = null;
        state.guessedCharacterId = null;

        // Only transition to QUESTION_SELECT if we're currently stuck waiting
        const waitingPhases = [
          GamePhase.AUTO_ELIMINATING,
          GamePhase.TURN_TRANSITION,
          GamePhase.ANSWER_REVEALED,
          GamePhase.ANSWER_PENDING,
          GamePhase.GUESS_WRONG,
        ];
        if (waitingPhases.includes(state.phase)) {
          state.phase = GamePhase.QUESTION_SELECT;
        }
      }),

    goBackToSetupP1: () =>
      set((state) => {
        if (state.phase === GamePhase.SETUP_P2) {
          state.phase = GamePhase.SETUP_P1;
          state.players.player2.secretCharacterId = null;
        }
      }),

    enrichNFTCharacters: (traitMap) =>
      set((state) => {
        enrichCharacters(state.characters, traitMap);
      }),

    setSoundEnabled: (enabled) =>
      set((state) => {
        state.soundEnabled = enabled;
      }),

    setDangerZoneEnabled: (enabled) =>
      set((state) => {
        state.dangerZoneEnabled = enabled;
      }),
  }))
);
