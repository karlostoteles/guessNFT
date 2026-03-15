/** guessNFT on-chain configuration */

// Schizodio Merkle tree root (all 999 characters, 418-bit bitmap schema)
export const TRAITS_ROOT = '0x296f3664665c3719c1498bd6642ed0e91d527b8d1e058fb6de45aaa5b88f9897';

// game_actions contract — deployed via: cd onchain && sozo migrate --profile mainnet
// Source: onchain/manifest_mainnet.json → contracts[0].address
export const GAME_CONTRACT = '0x4d5c92ee4168c532d756e5e4f13a89990e94eb400d6a38108e64ebb5a1487fc';

// Starknet Mainnet RPC (Cartridge)
export const STARKNET_RPC = 'https://api.cartridge.gg/x/starknet/mainnet';

// Dojo namespace — matches [namespace] default in dojo_mainnet.toml
export const DOJO_NAMESPACE = 'guessnft';

// Torii model tags — used for indexer queries
export const TORII_GAME_MODEL       = `${DOJO_NAMESPACE}-Game`;
export const TORII_COMMITMENT_MODEL = `${DOJO_NAMESPACE}-Commitment`;

// Session policies for Cartridge Controller
// Only the 4 entrypoints we actually call from the frontend
export const SESSION_POLICIES: Array<{ target: string; method: string }> = [
  { target: GAME_CONTRACT, method: 'create_game' },
  { target: GAME_CONTRACT, method: 'join_game' },
  { target: GAME_CONTRACT, method: 'commit_character' },
  { target: GAME_CONTRACT, method: 'record_result' },
  { target: GAME_CONTRACT, method: 'reveal_character' },
];
