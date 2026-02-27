import { useGameStore } from './gameStore';
import { PlayerId } from './types';

export const usePhase = () => useGameStore((s) => s.phase);
export const useGameMode = () => useGameStore((s) => s.mode);
export const useGameCharacters = () => useGameStore((s) => s.characters);
export const useActivePlayer = () => useGameStore((s) => s.activePlayer);
export const useTurnNumber = () => useGameStore((s) => s.turnNumber);
export const useBoardRotation = () => useGameStore((s) => s.boardRotation);
export const useCurrentQuestion = () => useGameStore((s) => s.currentQuestion);
export const useQuestionHistory = () => useGameStore((s) => s.questionHistory);
export const useWinner = () => useGameStore((s) => s.winner);
export const useGuessedCharacterId = () => useGameStore((s) => s.guessedCharacterId);
export const useGameSessionId = () => useGameStore((s) => s.gameSessionId);
export const useCommitmentStatus = () => useGameStore((s) => s.commitmentStatus);
export const useOnlineGameId = () => useGameStore((s) => s.onlineGameId);
export const useOnlineRoomCode = () => useGameStore((s) => s.onlineRoomCode);
export const useOnlinePlayerNum = () => useGameStore((s) => s.onlinePlayerNum);

export const usePlayerState = (player: PlayerId) =>
  useGameStore((s) => s.players[player]);

export const useEliminatedIds = (player: PlayerId) =>
  useGameStore((s) => s.players[player].eliminatedCharacterIds);

// Actions are stable — grab them directly from the store, not via selector
// This avoids creating a new object each render (which causes infinite loops)
const actions = {
  get setGameMode() { return useGameStore.getState().setGameMode; },
  get startSetup() { return useGameStore.getState().startSetup; },
  get selectSecretCharacter() { return useGameStore.getState().selectSecretCharacter; },
  get advancePhase() { return useGameStore.getState().advancePhase; },
  get askQuestion() { return useGameStore.getState().askQuestion; },
  get answerQuestion() { return useGameStore.getState().answerQuestion; },
  get toggleElimination() { return useGameStore.getState().toggleElimination; },
  get finishElimination() { return useGameStore.getState().finishElimination; },
  get startGuess() { return useGameStore.getState().startGuess; },
  get makeGuess() { return useGameStore.getState().makeGuess; },
  get cancelGuess() { return useGameStore.getState().cancelGuess; },
  get resetGame() { return useGameStore.getState().resetGame; },
  get setOnlineGame() { return useGameStore.getState().setOnlineGame; },
  get advanceToGameStart() { return useGameStore.getState().advanceToGameStart; },
  get receiveOpponentQuestion() { return useGameStore.getState().receiveOpponentQuestion; },
  get applyOpponentAnswer() { return useGameStore.getState().applyOpponentAnswer; },
  get receiveOpponentGuess() { return useGameStore.getState().receiveOpponentGuess; },
  get applyGuessResult() { return useGameStore.getState().applyGuessResult; },
};

export const useGameActions = () => actions;
