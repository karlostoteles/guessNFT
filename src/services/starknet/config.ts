/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/sepolia';

// "SN_SEPOLIA" in ASCII hex
export const SN_MAIN_CHAIN_ID = '0x534e5f5345504f4c4941';

// Game contract address — deployed when Phase 2 is ready
// Replace with actual address after deploying the Cairo/Dojo contract (Phase 2)
export const GAME_CONTRACT = '0x03b713795ebb479acd01fb4043ff2c365f97bd9ef5b54b764f41d2dad3dcf98f';

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'commit_character' },
  { target: GAME_CONTRACT, method: 'deposit_wager' },
  { target: GAME_CONTRACT, method: 'opponent_won' },
];
