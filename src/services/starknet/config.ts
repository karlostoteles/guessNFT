/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game Contracts (Mainnet)
export const GAME_CONTRACT_NORMAL = '0x0313d0d5a68e88d1ad2da15f5b7d16551e5686a5a3120691850d94740580ff09'; // Using same for now
export const GAME_CONTRACT_SCHIZO = '0x0313d0d5a68e88d1ad2da15f5b7d16551e5686a5a3120691850d94740580ff09';

// Session policies for Cartridge Controller
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  // Normal Contract
  { target: GAME_CONTRACT_NORMAL, method: 'create_game' },
  { target: GAME_CONTRACT_NORMAL, method: 'join_game' },
  { target: GAME_CONTRACT_NORMAL, method: 'submit_move' },
  { target: GAME_CONTRACT_NORMAL, method: 'claim_timeout_win' },
  { target: GAME_CONTRACT_NORMAL, method: 'cancel_game' },
  // Schizo Contract
  { target: GAME_CONTRACT_SCHIZO, method: 'create_game' },
  { target: GAME_CONTRACT_SCHIZO, method: 'join_game' },
  { target: GAME_CONTRACT_SCHIZO, method: 'submit_move' },
  { target: GAME_CONTRACT_SCHIZO, method: 'claim_timeout_win' },
  { target: GAME_CONTRACT_SCHIZO, method: 'cancel_game' },
  { target: GAME_CONTRACT_SCHIZO, method: 'deposit_wager' },
  { target: GAME_CONTRACT_SCHIZO, method: 'opponent_won' },
];
