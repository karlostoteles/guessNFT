import type { Character } from '@/core/data/characters';
import type { NFTAttribute } from '@/services/starknet/types';

export type GameMode = 'free' | 'nft' | 'online' | 'nft-free';

export enum GamePhase {
  MENU = 'MENU',
  SETUP_P1 = 'SETUP_P1',
  HANDOFF_P1_TO_P2 = 'HANDOFF_P1_TO_P2',
  SETUP_P2 = 'SETUP_P2',
  ONLINE_WAITING = 'ONLINE_WAITING', // waiting for opponent to commit (online mode)
  HANDOFF_START = 'HANDOFF_START',
  QUESTION_SELECT = 'QUESTION_SELECT',
  HANDOFF_TO_OPPONENT = 'HANDOFF_TO_OPPONENT',
  ANSWER_PENDING = 'ANSWER_PENDING',
  ANSWER_REVEALED = 'ANSWER_REVEALED',
  AUTO_ELIMINATING = 'AUTO_ELIMINATING', // tiles flipping down automatically
  ELIMINATION = 'ELIMINATION',
  TURN_TRANSITION = 'TURN_TRANSITION',
  GUESS_SELECT = 'GUESS_SELECT',
  GUESS_WRONG = 'GUESS_WRONG',   // Wrong Risk It — brief reveal, turn ends, game continues
  GUESS_RESULT = 'GUESS_RESULT', // Correct guess — winner declared
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
  /** CPU's question for the current simultaneous round (free mode only). */
  cpuQuestion: QuestionRecord | null;
  questionHistory: QuestionRecord[];
  winner: PlayerId | null;
  guessedCharacterId: string | null;
  // Commit-reveal: unique ID per game session for commitment storage
  gameSessionId: string;
  // Whether both players have valid on-chain (or local) commitments
  commitmentStatus: 'none' | 'partial' | 'both';
  // Online multiplayer metadata (null in free/nft mode)
  onlineGameId: string | null;
  onlineRoomCode: string | null;
  onlinePlayerNum: 1 | 2 | null;
  // Global client settings
  soundEnabled: boolean;
  dangerZoneEnabled: boolean;
}

export interface GameActions {
  setGameMode: (mode: GameMode, characters?: Character[]) => void;
  startSetup: () => void;
  selectSecretCharacter: (player: PlayerId, characterId: string) => void;
  assignRandomSecretCharacter: (player: PlayerId) => void;
  advancePhase: () => void;
  askQuestion: (questionId: string) => void;
  answerQuestion: (answer: boolean) => void;
  toggleElimination: (characterId: string) => void;
  finishElimination: () => void;
  startGuess: () => void;
  makeGuess: (characterId: string) => void;
  cancelGuess: () => void;
  resetGame: () => void;
  goBackToSetupP1: () => void;
  // Online-specific actions (called by useOnlineGameSync hook)
  setOnlineGame: (gameId: string, roomCode: string, playerNum: 1 | 2, playerAddress: string) => void;
  recoverOnlineGame: (characters: Character[], currentAddress?: string) => void;
  restoreFromEvents: (
    turnNumber: number,
    questionHistory: QuestionRecord[],
    myEliminatedIds: string[],
    opponentEliminatedIds: string[],
    mySecretCharacterId: string | null,
  ) => void;
  advanceToGameStart: () => void;
  receiveOpponentQuestion: (questionId: string, answer: boolean) => void;
  applyOpponentAnswer: (answer: boolean) => void;
  receiveOpponentGuess: (characterId: string, isCorrect: boolean, winnerPlayerNum: 1 | 2 | null) => void;
  receiveOpponentElimination: (eliminatedIds: string[]) => void;
  applyGuessResult: (isCorrect: boolean, winner: PlayerId | null) => void;
  /** Enrich stub NFT characters with real trait attributes from fetchTraitsBatch(). */
  enrichNFTCharacters: (traitMap: Map<string, NFTAttribute[]>) => void;
  // Settings toggle
  setSoundEnabled: (enabled: boolean) => void;
  setDangerZoneEnabled: (enabled: boolean) => void;
}
