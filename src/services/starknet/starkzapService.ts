/**
 * StarkZap-based wallet connection for guessNFT.
 *
 * This replaces the direct @cartridge/controller usage with starkzap SDK,
 * providing a cleaner API and support for sponsored transactions.
 */
import { StarkZap } from 'starkzap';
import type { WalletInterface } from 'starkzap';
import { GAME_CONTRACT } from './config';

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
      network: 'mainnet', // Uses built-in mainnet preset
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

  // Default policies for CommitReveal contract
  const defaultPolicies = policies || [
    { target: GAME_CONTRACT, method: 'commit' },
    { target: GAME_CONTRACT, method: 'reveal' },
  ];

  wallet = await starkzap.connectCartridge({
    policies: defaultPolicies,
    // Use sponsored transactions when available
    feeMode: 'sponsored',
  });

  // Ensure account is ready (deploy if needed)
  await wallet.ensureReady({ deploy: 'if_needed' });

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
  /** Commit character choice: pedersen(char_id, salt) */
  commit: (gameId: string, commitment: string) => Promise<string>;

  /** Reveal character + salt — contract verifies hash on-chain */
  reveal: (gameId: string, characterIdFelt: string, salt: string) => Promise<string>;

  /** Read a player's stored commitment */
  getCommitment: (gameId: string, playerAddress: string) => Promise<string>;
}

/**
 * Create game contract call functions using the connected wallet.
 */
export function getGameContract(): GameContractCalls {
  return {
    async commit(gameId: string, commitment: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'commit',
          calldata: [gameId, commitment],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async reveal(gameId: string, characterIdFelt: string, salt: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'reveal',
          calldata: [gameId, characterIdFelt, salt],
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
  };
}
