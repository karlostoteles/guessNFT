import type { Character } from '../data/characters';

export type GameMode = 'free' | 'nft' | 'online';

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
  // ZK proof phases (nft/online mode only)
  PROVING = 'PROVING',       // Web Worker generating ZK proof
  SUBMITTING = 'SUBMITTING', // Submitting proof tx to Starknet
  VERIFIED = 'VERIFIED',     // On-chain verification confirmed
  REVEAL_WAITING = 'REVEAL_WAITING', // Waiting for both players to reveal characters
}

export type PlayerId = 'player1' | 'player2';

export interface QuestionRecord {
  questionId: number;
  questionText: string;
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
  // Commit-reveal: unique ID per game session for commitment storage
  gameSessionId: string;
  // Whether both players have valid on-chain (or local) commitments
  commitmentStatus: 'none' | 'partial' | 'both';
  // Online multiplayer metadata (null in free/nft mode)
  onlinePlayerNum: 1 | 2 | null;
  // On-chain Dojo game ID (felt252 as hex string)
  starknetGameId: string | null;
  // ZK proof error message (null when no error). Separate from phase — a player in PROOF_ERROR
  // is still logically in ANSWER_PENDING and can retry.
  proofError: string | null;
  // Synchronous dedup: turn numbers for which we've already started proof generation.
  // Prevents double proof gen from duplicate Torii entity update callbacks.
  processedTurnIds: Set<number>;
}

export interface GameActions {
  setGameMode: (mode: GameMode, characters?: Character[]) => void;
  startSetup: () => void;
  selectSecretCharacter: (player: PlayerId, characterId: string) => void;
  advancePhase: () => void;
  askQuestion: (questionId: number) => void;
  answerQuestion: (answer: boolean) => void;
  // ZK-specific actions (nft/online mode)
  setPhase: (phase: GamePhase) => void;
  setVerifiedAnswer: (answer: boolean) => void;
  setProofError: (message: string) => void;
  clearProofError: () => void;
  toggleElimination: (characterId: string) => void;
  finishElimination: () => void;
  startGuess: () => void;
  makeGuess: (characterId: string) => void;
  cancelGuess: () => void;
  resetGame: () => void;
  // Online-specific actions (called by useToriiGameSync hook)
  setOnlineGame: (gameId: string, playerNum: 1 | 2) => void;
  advanceToGameStart: () => void;
  receiveOpponentQuestion: (questionId: number, turnNumber: number) => void;
  applyOpponentAnswer: (answer: boolean) => void;
  receiveOpponentGuess: (characterId: string, isCorrect: boolean, winnerPlayerNum: 1 | 2 | null) => void;
  applyGuessResult: (isCorrect: boolean, winner: PlayerId | null) => void;
}
