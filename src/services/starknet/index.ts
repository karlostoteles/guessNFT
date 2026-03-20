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
} from './commitReveal';
export type { Commitment } from './commitReveal';
export { SCHIZODIO_CONTRACT, RPC_URL, SN_MAIN_CHAIN_ID, GAME_CONTRACT, SESSION_POLICIES } from './config';
export { useWalletConnection } from './hooks';
export { connectCartridgeWallet, resetSDK } from './sdk';
export type { ConnectedWallet } from './sdk';
export { IPFS_GATEWAYS, resolveUrl, fetchOwnedTokenIds, fetchTokenMetadata, fetchAllOwnedNFTs } from './nftService';
export type { NFTAttribute, SchizodioNFT, WalletConnectionStatus, WalletState, WalletActions } from './types';
export { useWalletStore, useWalletStatus, useWalletAddress, useWalletUsername, useOwnedNFTs, useWalletError, useIsWalletReady } from './walletStore';

// ─── New starkzap exports (opt-in, for future use) ─────────────────────────────
export {
  connectWallet as connectWalletStarkzap,
  disconnectWallet as disconnectWalletStarkzap,
  getWallet,
  isWalletConnected,
  getWalletAddress,
  getGameContract,
} from './starkzapService';
export type { ConnectedWalletInfo, GameContractCalls } from './starkzapService';
