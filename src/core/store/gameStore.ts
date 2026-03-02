import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GamePhase, GameState, GameActions, PlayerId } from './types';
import { QUESTIONS } from '@/core/data/questions';
import { CHARACTERS } from '@/core/data/characters';
import { evaluateQuestion } from '@/core/rules/evaluateQuestion';
import { createCommitment, generateGameSessionId, clearCommitments } from '@/services/starknet/commitReveal';
import { generateAllCollectionCharacters } from '@/services/starknet/collectionService';
import { enrichCharacters } from '@/core/data/nftCharacterAdapter';

function getOpponent(player: PlayerId): PlayerId {
  return player === 'player1' ? 'player2' : 'player1';
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
  questionHistory: [],
  winner: null,
  guessedCharacterId: null,
  gameSessionId: generateGameSessionId(),
  commitmentStatus: 'none',
  onlineGameId: null,
  onlineRoomCode: null,
  onlinePlayerNum: null,
};

export const useGameStore = create<GameState & GameActions>()(
  immer((set) => ({
    ...initialState,

    setGameMode: (mode, characters) =>
      set((state) => {
        state.mode = mode;
        if (characters) {
          state.characters = characters;
        } else if (mode === 'nft' || mode === 'online') {
          // Full 999-token SCHIZODIO collection — adaptive board uses all tokens
          state.characters = generateAllCollectionCharacters();
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
          // Online mode: after selecting, wait for opponent to also commit
          state.commitmentStatus = state.commitmentStatus === 'partial' ? 'both' : 'partial';
          state.phase = GamePhase.ONLINE_WAITING;
          return;
        }

        if (player === 'player1') {
          if (state.mode === 'free') {
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
            const q = state.currentQuestion;
            if (q) {
              const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
              const fullQuestion = QUESTIONS.find((qn) => qn.id === q.questionId);
              if (fullQuestion) {
                for (const char of state.characters) {
                  if (eliminated.includes(char.id)) continue;
                  const matchesQuestion = evaluateQuestion(fullQuestion, char);
                  const shouldEliminate = q.answer ? !matchesQuestion : matchesQuestion;
                  if (shouldEliminate) {
                    eliminated.push(char.id);
                  }
                }
              }
            }
            state.phase = GamePhase.AUTO_ELIMINATING;
            break;
          }
          case GamePhase.AUTO_ELIMINATING: {
            const next = getOpponent(state.activePlayer);
            state.activePlayer = next;
            state.boardRotation = next === 'player1' ? 0 : Math.PI;
            state.turnNumber += 1;
            state.currentQuestion = null;
            state.phase = GamePhase.TURN_TRANSITION;
            break;
          }
          case GamePhase.TURN_TRANSITION:
            state.phase = GamePhase.QUESTION_SELECT;
            break;
          case GamePhase.GUESS_WRONG: {
            const next = getOpponent(state.activePlayer);
            state.activePlayer = next;
            state.boardRotation = next === 'player1' ? 0 : Math.PI;
            state.turnNumber += 1;
            state.currentQuestion = null;
            state.guessedCharacterId = null;
            state.phase = GamePhase.TURN_TRANSITION;
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

        if (state.mode === 'online') {
          // Online mode: set question, go to ANSWER_PENDING, sync hook sends event
          const record = {
            questionId,
            questionText: q.text,
            traitKey: q.traitKey,
            traitValue: q.traitValue,
            answer: null,
            askedBy: state.activePlayer,
            turnNumber: state.turnNumber,
          };
          state.currentQuestion = record;
          state.questionHistory.push(record);
          state.phase = GamePhase.ANSWER_PENDING;
          return;
        }

        // Local/free mode: auto-evaluate immediately
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
        if (state.currentQuestion) {
          const next = getOpponent(state.activePlayer);
          state.activePlayer = next;
          state.boardRotation = next === 'player1' ? 0 : Math.PI;
          state.turnNumber += 1;
          state.currentQuestion = null;
          state.phase = GamePhase.TURN_TRANSITION;
        } else {
          state.phase = GamePhase.QUESTION_SELECT;
        }
      }),

    makeGuess: (characterId) =>
      set((state) => {
        state.guessedCharacterId = characterId;

        if (state.mode === 'online') {
          // Online: send guess event, wait for GUESS_RESULT from opponent
          state.phase = GamePhase.ANSWER_PENDING;
          return;
        }

        // Local/free: evaluate immediately
        const opponent = getOpponent(state.activePlayer);
        const secretId = state.players[opponent].secretCharacterId;
        if (characterId === secretId) {
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
      }),

    // ─── Online-specific actions ───────────────────────────────────────────────

    setOnlineGame: (gameId, roomCode, playerNum) =>
      set((state) => {
        state.onlineGameId = gameId;
        state.onlineRoomCode = roomCode;
        state.onlinePlayerNum = playerNum;
      }),

    advanceToGameStart: () =>
      set((state) => {
        // Called by sync hook when both players have committed — start the game
        state.commitmentStatus = 'both';
        state.activePlayer = 'player1';
        state.boardRotation = 0;
        state.phase = GamePhase.HANDOFF_START;
      }),

    receiveOpponentQuestion: (questionId, answer) =>
      set((state) => {
        const q = QUESTIONS.find((q) => q.id === questionId);
        if (!q) return;

        const record = {
          questionId,
          questionText: q.text,
          traitKey: q.traitKey,
          traitValue: q.traitValue,
          answer,
          askedBy: state.activePlayer, // opponent is currently the active player
          turnNumber: state.turnNumber,
        };
        state.currentQuestion = record;
        state.questionHistory.push(record);
        // Skip ANSWER_PENDING — I already answered, jump to reveal
        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    applyOpponentAnswer: (answer) =>
      set((state) => {
        if (!state.currentQuestion) return;
        state.currentQuestion.answer = answer;
        state.phase = GamePhase.ANSWER_REVEALED;
      }),

    receiveOpponentGuess: (characterId, isCorrect, winnerPlayerNum) =>
      set((state) => {
        state.guessedCharacterId = characterId;
        if (isCorrect && winnerPlayerNum !== null) {
          state.winner = winnerPlayerNum === 1 ? 'player1' : 'player2';
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          // Opponent guessed wrong — their turn ends, I stay in a consistent state
          state.phase = GamePhase.GUESS_WRONG;
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

    enrichNFTCharacters: (traitMap) =>
      set((state) => {
        enrichCharacters(state.characters, traitMap);
      }),
  }))
);
