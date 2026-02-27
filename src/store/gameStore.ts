import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { GamePhase, GameState, GameActions, PlayerId } from './types';
import { QUESTIONS } from '../data/questions';
import { CHARACTERS } from '../data/characters';
import { evaluateQuestion } from '../utils/evaluateQuestion';

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
          state.characters = CHARACTERS; // Default to mock characters
        }
      }),

    startSetup: () =>
      set((state) => {
        state.phase = GamePhase.SETUP_P1;
      }),

    selectSecretCharacter: (player, characterId) =>
      set((state) => {
        state.players[player].secretCharacterId = characterId;
        if (player === 'player1') {
          if (state.mode === 'free') {
            // CPU (player2) picks a random character automatically
            const pool = state.characters.filter((c) => c.id !== characterId);
            const cpuPick = pool[Math.floor(Math.random() * pool.length)];
            if (cpuPick) state.players.player2.secretCharacterId = cpuPick.id;
            state.phase = GamePhase.HANDOFF_START;
          } else {
            state.phase = GamePhase.HANDOFF_P1_TO_P2;
          }
        } else {
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
            // Auto-eliminate: compute which characters don't match the answer
            const q = state.currentQuestion;
            if (q) {
              const eliminated = state.players[state.activePlayer].eliminatedCharacterIds;
              const fullQuestion = QUESTIONS.find((qn) => qn.id === q.questionId);
              if (fullQuestion) {
                for (const char of state.characters) {
                  if (eliminated.includes(char.id)) continue; // already eliminated
                  const matchesQuestion = evaluateQuestion(fullQuestion, char);
                  // If answer is YES → eliminate those who DON'T match
                  // If answer is NO  → eliminate those who DO match
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
            // Auto-advance: switch turns
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
            // Wrong Risk It — end the guesser's turn, opponent continues
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

        // Auto-evaluate the answer based on the opponent's secret character
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
        // Go directly to ANSWER_REVEALED (auto-answered for local play)
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
          // Already asked a question this turn — advance to next player
          const next = getOpponent(state.activePlayer);
          state.activePlayer = next;
          state.boardRotation = next === 'player1' ? 0 : Math.PI;
          state.turnNumber += 1;
          state.currentQuestion = null;
          state.phase = GamePhase.TURN_TRANSITION;
        } else {
          // Hadn't asked a question yet — go back to question select
          state.phase = GamePhase.QUESTION_SELECT;
        }
      }),

    makeGuess: (characterId) =>
      set((state) => {
        state.guessedCharacterId = characterId;
        const opponent = getOpponent(state.activePlayer);
        const secretId = state.players[opponent].secretCharacterId;
        if (characterId === secretId) {
          // Correct! Declare winner
          state.winner = state.activePlayer;
          state.phase = GamePhase.GUESS_RESULT;
        } else {
          // Wrong — show reveal briefly, then turn passes
          state.phase = GamePhase.GUESS_WRONG;
        }
      }),

    resetGame: () =>
      set((state) => {
        // Preserve mode and characters across game resets
        const currentMode = state.mode;
        const currentChars = state.characters;
        Object.assign(state, initialState);
        state.mode = currentMode;
        state.characters = currentChars;
        // Reset nested objects explicitly since immer uses proxies
        state.players = {
          player1: { secretCharacterId: null, eliminatedCharacterIds: [] },
          player2: { secretCharacterId: null, eliminatedCharacterIds: [] },
        };
        state.questionHistory = [];
      }),
  }))
);
