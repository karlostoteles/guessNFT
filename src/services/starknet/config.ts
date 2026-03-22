/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// CommitReveal contract — deployed on Starknet Mainnet
export const GAME_CONTRACT = '0x077cbfa4dab07b9bd3e167b37ec2066683caeb9a267f72ec744f73b3c8d48b21';

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'commit' },
  { target: GAME_CONTRACT, method: 'reveal' },
];
