export type GameStatus = 'waiting' | 'ready' | 'in_progress' | 'finished';

export type OnlineEventType =
  | 'CHARACTER_COMMITTED'
  | 'QUESTION_ASKED'
  | 'ANSWER_GIVEN'
  | 'ELIMINATION_UPDATE'
  | 'GUESS_MADE'
  | 'GUESS_RESULT'
  | 'CHARACTER_REVEALED';

export interface SupabaseGame {
  id: string;
  room_code: string;
  status: GameStatus;
  player1_address: string;
  player2_address: string | null;
  player1_commitment: string | null;
  player2_commitment: string | null;
  player1_char_id: string | null;
  player2_char_id: string | null;
  player1_salt: string | null;
  player2_salt: string | null;
  active_player_num: number;
  winner_player_num: number | null;
  turn_number: number;
  characters: any[] | null;
  // Server-authoritative state machine columns
  current_phase: string | null;
  current_question: Record<string, any> | null;
  current_answer: boolean | null;
  eliminated_p1: string[] | null;
  eliminated_p2: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SupabaseGameEvent {
  id: string;
  game_id: string;
  event_type: OnlineEventType;
  player_num: number;
  player_address: string;
  turn_number: number;
  payload: Record<string, any>;
  idempotency_key?: string;
  created_at: string;
}
