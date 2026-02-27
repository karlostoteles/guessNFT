/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Session policies for Cartridge Controller
// Phase 1: empty — read-only operations don't need sessions
// Phase 2: will include game contract methods (commit, reveal, ask, guess)
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [];
