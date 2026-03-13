/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Phase 2 Game Contract (Mainnet)
export const GAME_CONTRACT = '0x0313d0d5a68e88d1ad2da15f5b7d16551e5686a5a3120691850d94740580ff09';

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'join_game' },
  { target: GAME_CONTRACT, method: 'submit_move' },
  { target: GAME_CONTRACT, method: 'claim_timeout_win' },
  { target: GAME_CONTRACT, method: 'cancel_game' },
  { target: GAME_CONTRACT, method: 'deposit_wager' },
  { target: GAME_CONTRACT, method: 'opponent_won' },
];
