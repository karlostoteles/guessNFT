/**
 * StarkZap-based wallet connection for guessNFT.
 *
 * This replaces the direct @cartridge/controller usage with starkzap SDK,
 * providing a cleaner API and support for sponsored transactions.
 */
import { StarkZap } from 'starkzap';
import type { WalletInterface } from 'starkzap';
import { GAME_CONTRACT } from './config';

// Immediate log to catch the contract address on load
console.log('[DEBUG] StarkNet Config Loaded. GAME_CONTRACT:', GAME_CONTRACT);

// Singleton instances
let sdk: StarkZap | null = null;
let wallet: WalletInterface | null = null;

export interface ConnectedWalletInfo {
  address: string;
  username?: string;
}

/**
 * Get or create the StarkZap SDK instance.
 */
function getSDK(): StarkZap {
  if (!sdk) {
    sdk = new StarkZap({
      network: 'mainnet',
      // Explicitly providing RPC and chainId avoids auto-detection issues which cause SNIP-9 errors
      rpcUrl: 'https://api.cartridge.gg/x/starknet/mainnet',
    });
  }
  return sdk;
}

/**
 * Connect wallet using Cartridge Controller via starkzap.
 * This is the primary wallet connection method.
 */
export async function connectWallet(policies?: Array<{ target: string; method: string }>): Promise<ConnectedWalletInfo> {
  const starkzap = getSDK();

  // Default policies for game contract
  const defaultPolicies = policies || [
    { target: GAME_CONTRACT, method: 'create_game' },
    { target: GAME_CONTRACT, method: 'commit_character' },
    { target: GAME_CONTRACT, method: 'reveal_character' },
    { target: GAME_CONTRACT, method: 'deposit_wager' },
    { target: GAME_CONTRACT, method: 'opponent_won' },
  ];

  console.log('[StarkZap] Connecting with policies for contract:', GAME_CONTRACT);

  wallet = await starkzap.connectCartridge({
    policies: defaultPolicies,
    feeMode: 'sponsored',
  });

  // Ensure account is ready (deploy if needed)
  console.log('[StarkZap] Ensuring account is ready...');
  await wallet.ensureReady({ deploy: 'if_needed' });

  // Debug deployment status
  try {
    const isDeployed = await wallet.isDeployed();
    console.log('[StarkZap] Account address:', wallet.address.toString());
    console.log('[StarkZap] Account deployed:', isDeployed);
  } catch (e) {
    console.warn('[StarkZap] Could not check deployment status:', e);
  }

  return {
    address: wallet.address.toString(),
  };
}

/**
 * Get the current connected wallet.
 * Throws if not connected.
 */
export function getWallet(): WalletInterface {
  if (!wallet) {
    throw new Error('Wallet not connected. Call connectWallet first.');
  }
  return wallet;
}

/**
 * Check if wallet is connected.
 */
export function isWalletConnected(): boolean {
  return wallet !== null;
}

/**
 * Disconnect wallet.
 */
export async function disconnectWallet(): Promise<void> {
  if (wallet) {
    await wallet.disconnect();
    wallet = null;
  }
}

/**
 * Get wallet address (convenience function).
 */
export function getWalletAddress(): string | null {
  return wallet?.address.toString() ?? null;
}

// ============================================================
// Game Contract Interactions
// ============================================================

export interface GameContractCalls {
  /**
   * Create a new game on-chain.
   */
  createGame: (gameId: string, player2Address: string) => Promise<string>;

  /**
   * Commit a character choice (commitment = pedersen(char, salt)).
   */
  commitCharacter: (gameId: string, commitment: string) => Promise<string>;

  /**
   * Reveal the character choice.
   */
  revealCharacter: (gameId: string, characterId: string, salt: string) => Promise<string>;

  /**
   * Get a player's commitment.
   */
  getCommitment: (gameId: string, playerAddress: string) => Promise<string>;

  /**
   * Get game state.
   */
  getGame: (gameId: string) => Promise<{
    player1: string;
    player2: string;
    p1_commitment: string;
    p2_commitment: string;
    p1_revealed_char: string;
    p2_revealed_char: string;
    winner: string;
  }>;

  /**
   * Deposit wager NFT on-chain.
   */
  depositWager: (gameId: string, tokenId: string) => Promise<string>;

  /**
   * Concede game on-chain (sends both wagers to opponent).
   */
  opponentWon: (gameId: string) => Promise<string>;
}

/**
 * Create game contract call functions using the connected wallet.
 */
export function getGameContract(): GameContractCalls {
  return {
    async createGame(gameId: string, player2Address: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'create_game',
          calldata: [gameId, player2Address],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async commitCharacter(gameId: string, commitment: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'commit_character',
          calldata: [gameId, commitment],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async revealCharacter(gameId: string, characterId: string, salt: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'reveal_character',
          calldata: [gameId, characterId, salt],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async getCommitment(gameId: string, playerAddress: string): Promise<string> {
      const w = getWallet();
      const result = await w.callContract({
        contractAddress: GAME_CONTRACT,
        entrypoint: 'get_commitment',
        calldata: [gameId, playerAddress],
      });
      return result[0];
    },

    async getGame(gameId: string) {
      const w = getWallet();
      const result = await w.callContract({
        contractAddress: GAME_CONTRACT,
        entrypoint: 'get_game',
        calldata: [gameId],
      });

      // Parse the response - Game struct fields
      return {
        player1: result[0],
        player2: result[1],
        p1_commitment: result[2],
        p2_commitment: result[3],
        p1_revealed_char: result[4],
        p2_revealed_char: result[5],
        winner: result[8], // After p1_wager (u256 = 2 slots) and p2_wager (u256 = 2 slots)
      };
    },

    async depositWager(gameId: string, tokenId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'deposit_wager',
          // Uint256 is split into low and high segments (tokenId, 0)
          calldata: [gameId, tokenId, '0'],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async opponentWon(gameId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'opponent_won',
          calldata: [gameId],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },
  };
}
