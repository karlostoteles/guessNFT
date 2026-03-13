/** Starknet configuration constants */

export const SCHIZODIO_CONTRACT =
  '0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa';

export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';

// Starknet Mainnet chain ID
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e';

// Game Contracts (Mainnet)
export const GAME_CONTRACT_NORMAL = '0x0313d0d5a68e88d1ad2da15f5b7d16551e5686a5a3120691850d94740580ff09'; // Using same for now
export const GAME_CONTRACT_SCHIZO = '0x0313d0d5a68e88d1ad2da15f5b7d16551e5686a5a3120691850d94740580ff09';

// Methods required for game interaction
const GAME_METHODS = [
  'create_game',
  'join_game',
  'submit_move',
  'claim_timeout_win',
  'cancel_game',
  'commit_character',
  'reveal_character',
  // 'commit_and_wager' - DOES NOT EXIST ON CONTRACT, use multicall
];

// Deduplicate targets and methods for session policies
const buildPolicies = () => {
  const policies: Array<{ target: string; method: string }> = [];
  const targets = Array.from(new Set([GAME_CONTRACT_NORMAL, GAME_CONTRACT_SCHIZO])) as string[];
  
  for (const target of targets) {
    if (!target || target === '0x0') continue;
    for (const method of GAME_METHODS) {
      policies.push({ target, method });
    }
  }
  
  // Add Schizo-specific methods
  if (GAME_CONTRACT_SCHIZO && (GAME_CONTRACT_SCHIZO as string) !== '0x0') {
    policies.push({ target: GAME_CONTRACT_SCHIZO, method: 'deposit_wager' });
    policies.push({ target: GAME_CONTRACT_SCHIZO, method: 'opponent_won' });
  }
  
  return policies;
};

export const SESSION_POLICIES = buildPolicies();
