import type { Character } from '../data/characters';

export type GameMode = 'free' | 'nft';

export enum GamePhase {
  MENU = 'MENU',
  SETUP_P1 = 'SETUP_P1',
  HANDOFF_P1_TO_P2 = 'HANDOFF_P1_TO_P2',
  SETUP_P2 = 'SETUP_P2',
  HANDOFF_START = 'HANDOFF_START',
  QUESTION_SELECT = 'QUESTION_SELECT',
  HANDOFF_TO_OPPONENT = 'HANDOFF_TO_OPPONENT',
  ANSWER_PENDING = 'ANSWER_PENDING',
  ANSWER_REVEALED = 'ANSWER_REVEALED',
  AUTO_ELIMINATING = 'AUTO_ELIMINATING', // tiles flipping down automatically
  ELIMINATION = 'ELIMINATION',
  TURN_TRANSITION = 'TURN_TRANSITION',
  GUESS_SELECT = 'GUESS_SELECT',
  GUESS_RESULT = 'GUESS_RESULT',
  GAME_OVER = 'GAME_OVER',
}

export type PlayerId = 'player1' | 'player2';

export interface QuestionRecord {
  questionId: string;
  questionText: string;
  traitKey: string;
  traitValue: string | boolean;
  answer: boolean | null;
  askedBy: PlayerId;
  turnNumber: number;
}

export interface PlayerState {
  secretCharacterId: string | null;
  eliminatedCharacterIds: string[];
}

export interface GameState {
  phase: GamePhase;
  mode: GameMode;
  characters: Character[];
  activePlayer: PlayerId;
  turnNumber: number;
  boardRotation: number; // Y-axis rotation in radians, 0 or PI
  players: Record<PlayerId, PlayerState>;
  currentQuestion: QuestionRecord | null;
  questionHistory: QuestionRecord[];
  winner: PlayerId | null;
  guessedCharacterId: string | null;
}

export interface GameActions {
  setGameMode: (mode: GameMode, characters?: Character[]) => void;
  startSetup: () => void;
  selectSecretCharacter: (player: PlayerId, characterId: string) => void;
  advancePhase: () => void;
  askQuestion: (questionId: string) => void;
  answerQuestion: (answer: boolean) => void;
  toggleElimination: (characterId: string) => void;
  finishElimination: () => void;
  startGuess: () => void;
  makeGuess: (characterId: string) => void;
  cancelGuess: () => void;
  resetGame: () => void;
}
