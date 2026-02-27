/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Correct chain ID for Starknet mainnet as used by Cartridge Controller
// "SN_MAIN" in ASCII hex — NOT "SN_MAINNET" (0x534e5f4d41494e4e4554) which is unrecognized
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game contract address — deployed when Phase 2 is ready
// Replace with actual address after deploying src/starknet/contract/WhoisWho.cairo
export const GAME_CONTRACT = '0x0'; // TODO: deploy and set

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  // Phase 2 — uncomment and fill once contract is deployed:
  // { target: GAME_CONTRACT, method: 'commit_character' },
  // { target: GAME_CONTRACT, method: 'ask_question' },
  // { target: GAME_CONTRACT, method: 'answer_question' },
  // { target: GAME_CONTRACT, method: 'make_guess' },
  // { target: GAME_CONTRACT, method: 'reveal_character' },
];
