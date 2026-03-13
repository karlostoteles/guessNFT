// ─── Existing exports (keep these for backward compatibility) ─────────────────
export { COLLECTION_SIZE, generateAllCollectionCharacters, clearCollectionCache } from './collectionService';
export {
  createCommitment,
  verifyReveal,
  getCommitment,
  clearCommitments,
  generateGameSessionId,
  submitCommitmentOnChain,
  revealCharacterOnChain,
  depositWagerOnChain,
  opponentWonOnChain,
} from './commitReveal';
export type { Commitment } from './commitReveal';
export { SCHIZODIO_CONTRACT, RPC_URL, SN_MAIN_CHAIN_ID, SESSION_POLICIES, GAME_CONTRACT_NORMAL, GAME_CONTRACT_SCHIZO } from './config';
export { useWalletConnection } from './starkzapHooks';
export { 
  connectWallet as connectCartridgeWallet, 
  disconnectWallet as disconnectWalletLegacy,
  isWalletConnected 
} from './starkzapService';
export function resetSDK() {
  // StarkZap handles its own singleton state, but we can reset the store
}
export { IPFS_GATEWAYS, resolveUrl, fetchOwnedTokenIds, fetchTokenMetadata, fetchAllOwnedNFTs } from './nftService';
export type { NFTAttribute, SchizodioNFT, WalletConnectionStatus, WalletState, WalletActions } from './types';
export { useWalletStore, useWalletStatus, useWalletAddress, useWalletUsername, useOwnedNFTs, useWalletError, useIsWalletReady } from './walletStore';

// ─── New starkzap exports (opt-in, for future use) ─────────────────────────────
export {
  connectWallet as connectWalletStarkzap,
  disconnectWallet as disconnectWalletStarkzap,
  getWallet,
  getWalletAddress,
  getGameContract,
} from './starkzapService';
export type { ConnectedWalletInfo, GameContractCalls } from './starkzapService';

