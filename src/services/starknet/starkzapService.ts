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
if (typeof window !== 'undefined') {
  (window as any).GAME_CONTRACT = GAME_CONTRACT;
}

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
      // Removing explicit RPC to see if built-in defaults handle version 0.10.x better
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

  // Check if user wants to bypass sessions as a test
  const useSessions = !window.location.search.includes('no_sessions');
  // New flag: ?user_pays=true to force standard execution (bypass SNIP-9)
  const forceUserPays = window.location.search.includes('user_pays');

  // Default policies for game contract
  const defaultPolicies = policies || [
    { target: GAME_CONTRACT, method: 'create_game' },
    { target: GAME_CONTRACT, method: 'commit_character' },
    { target: GAME_CONTRACT, method: 'reveal_character' },
    { target: GAME_CONTRACT, method: 'deposit_wager' },
    { target: GAME_CONTRACT, method: 'opponent_won' },
  ];

  console.log('[StarkZap] Connecting. Use Sessions:', useSessions, 'Force User Pays:', forceUserPays);
  console.log('[StarkZap] Policies contract target:', GAME_CONTRACT);

  wallet = await starkzap.connectCartridge({
    // If sessions fail with SNIP-9, we pass undefined to force manual approval mode
    policies: useSessions ? defaultPolicies : undefined,
    // Fix: "user_pays" is the correct type from StarkZap. "standard" was wrong.
    feeMode: (useSessions && !forceUserPays) ? 'sponsored' : 'user_pays',
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
  createGame: (gameId: string, player2Address?: string) => Promise<string>;
  joinGame: (gameId: string) => Promise<string>;
  commitCharacter: (gameId: string, commitment: string) => Promise<string>;
  revealCharacter: (gameId: string, characterId: string, salt: string) => Promise<string>;
  submitMove: (gameId: string) => Promise<string>;
  claimTimeoutWin: (gameId: string) => Promise<string>;
  cancelGame: (gameId: string) => Promise<string>;
  depositWager: (gameId: string, tokenId: string) => Promise<string>;
  opponentWon: (gameId: string) => Promise<string>;
  getGame: (gameId: string) => Promise<any>;
}

/**
 * Create game contract call functions using the connected wallet.
 */
export function getGameContract(): GameContractCalls {
  const _getWallet = () => {
    return getWallet(); // This already handles connection check and returns WalletInterface
  };

  return {
    async createGame(gameId: string, player2Address?: string): Promise<string> {
      const w = _getWallet();
      const p2 = player2Address || '0x0';
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'create_game',
          calldata: [gameId, p2],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async joinGame(gameId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'join_game',
          calldata: [gameId],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async commitCharacter(game_id: string, commitment: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'commit_character',
          calldata: [game_id, commitment],
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

    async submitMove(gameId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'submit_move',
          calldata: [gameId],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async claimTimeoutWin(gameId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'claim_timeout_win',
          calldata: [gameId],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async cancelGame(gameId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'cancel_game',
          calldata: [gameId],
        },
      ]);
      await tx.wait();
      return tx.hash;
    },

    async getGame(gameId: string) {
      const w = getWallet();
      const result = await w.callContract({
        contractAddress: GAME_CONTRACT,
        entrypoint: 'get_game',
        calldata: [gameId],
      });

      // Parse the response - Game struct fields (14 felts total)
      // Index mapping:
      // 0: player1, 1: player2
      // 2: p1_commitment, 3: p2_commitment
      // 4: p1_revealed_char, 5: p2_revealed_char
      // 6,7: p1_wager (u256), 8,9: p2_wager (u256)
      // 10: winner, 11: last_move_timestamp, 12: active_player, 13: status
      return {
        player1: result[0],
        player2: result[1],
        p1Commitment: result[2],
        p2Commitment: result[3],
        p1RevealedChar: result[4],
        p2RevealedChar: result[5],
        p1Wager: result[6], 
        p2Wager: result[8],
        winner: result[10],
        lastMoveTimestamp: result[11] ? Number(BigInt(result[11])) : 0,
        activePlayer: result[12] ? Number(BigInt(result[12])) : 1,
        status: result[13],
      };
    },

    async depositWager(gameId: string, tokenId: string): Promise<string> {
      const w = getWallet();
      const tx = await w.execute([
        {
          contractAddress: GAME_CONTRACT,
          entrypoint: 'deposit_wager',
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
