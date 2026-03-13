/**
 * StarkZap-based wallet connection for guessNFT.
 *
 * This replaces the direct @cartridge/controller usage with starkzap SDK,
 * providing a cleaner API and support for sponsored transactions.
 */
import { StarkZap, Tx, ChainId } from 'starkzap';
import type { WalletInterface } from 'starkzap';
import { connect, disconnect, type StarknetWindowObject } from 'get-starknet';
import { Account, RpcProvider, type Call } from 'starknet';
import { GAME_CONTRACT_NORMAL, GAME_CONTRACT_SCHIZO, SESSION_POLICIES, RPC_URL } from './config';
import { useGameStore } from '@/core/store/gameStore';
import { useToastStore } from '@/core/store/toastStore';

// Expose for user debugging as requested
(window as any).GAME_CONTRACT = GAME_CONTRACT_NORMAL;
console.log('[StarkZap] Environment - isSecureContext:', window.isSecureContext);
console.log('[StarkZap] Environment - protocol:', window.location.protocol);

// Singleton instances
let sdk: StarkZap | null = null;
let wallet: WalletInterface | null = null;

export interface ConnectedWalletInfo {
  address: string;
  username?: string;
  type: 'cartridge' | 'argent' | 'braavos' | 'discovery';
}

/**
 * Get or create the StarkZap SDK instance.
 */
function getSDK(): StarkZap {
  if (!sdk) {
    sdk = new StarkZap({
      network: 'mainnet',
      rpcUrl: RPC_URL,
      chainId: ChainId.MAINNET,
    });
  }
  return sdk;
}

/**
 * A shim that wraps a standard Starknet extension account (Argent/Braavos)
 * into the WalletInterface expected by StarkZap-based code.
 */
class DiscoveryWalletShim implements WalletInterface {
  readonly address: any;
  private account: Account;
  private provider: RpcProvider;
  private windowObject: StarknetWindowObject;

  constructor(windowObject: StarknetWindowObject) {
    this.windowObject = windowObject;
    this.account = windowObject.account as Account;
    this.address = this.account.address;
    this.provider = new RpcProvider({ nodeUrl: RPC_URL });
  }

  async isDeployed(): Promise<boolean> {
    const classHash = await this.provider.getClassHashAt(this.address);
    return !!classHash;
  }

  async ensureReady(): Promise<void> {
    // Discovery wallets are usually already deployed or handle it themselves
    return;
  }

  async deploy(): Promise<Tx> {
    throw new Error('Deployment via discovery wallet shim not implemented. Use extension UI.');
  }

  async execute(calls: Call[]): Promise<Tx> {
    const response = await this.account.execute(calls);
    return new Tx(response.transaction_hash, this.provider, ChainId.MAINNET);
  }

  async callContract(call: Call): Promise<any> {
    return await this.account.callContract(call);
  }

  tx(): any {
    throw new Error('TxBuilder not implemented for discovery shim');
  }

  async signMessage(typedData: any): Promise<any> {
    return await this.account.signMessage(typedData);
  }

  async preflight(): Promise<any> {
    return { ok: true };
  }

  getAccount(): Account {
    return this.account;
  }

  getProvider(): RpcProvider {
    return this.provider;
  }

  getChainId(): ChainId {
    return ChainId.MAINNET;
  }

  getFeeMode(): any {
    return 'user_pays';
  }

  getClassHash(): string {
    return '';
  }

  async estimateFee(calls: Call[]): Promise<any> {
    return await (this.account as any).estimateFee(calls);
  }

  async disconnect(): Promise<void> {
    await disconnect();
  }

  // Erc20 and Staking methods are handled by BaseWallet, 
  // but since we are a shim we'd need to delegate or implement.
  // For guessNFT, we primarily use execute() and address.
  erc20(): any { throw new Error('Not implemented'); }
  transfer(): any { throw new Error('Not implemented'); }
  balanceOf(): any { throw new Error('Not implemented'); }
  staking(): any { throw new Error('Not implemented'); }
  stakingInStaker(): any { throw new Error('Not implemented'); }
  enterPool(): any { throw new Error('Not implemented'); }
  addToPool(): any { throw new Error('Not implemented'); }
  stake(): any { throw new Error('Not implemented'); }
  claimPoolRewards(): any { throw new Error('Not implemented'); }
  exitPoolIntent(): any { throw new Error('Not implemented'); }
  exitPool(): any { throw new Error('Not implemented'); }
  isPoolMember(): any { throw new Error('Not implemented'); }
  getPoolPosition(): any { throw new Error('Not implemented'); }
  getPoolCommission(): any { throw new Error('Not implemented'); }
}

/**
 * Connect wallet using either Cartridge or Discovery (Argent/Braavos).
 */
export async function connectWallet(
  type: 'cartridge' | 'discovery' = 'cartridge',
  policies?: Array<{ target: string; method: string }>
): Promise<ConnectedWalletInfo> {
  // Always disconnect previous before starting a new connection flow to avoid singletons clobbering each other
  if (wallet) {
    try { 
      // Add a 3s timeout to disconnect to prevent hanging the whole flow if the iframe is dead
      await Promise.race([
        wallet.disconnect(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 3000))
      ]);
    } catch (e) { 
      console.warn('[Wallet] Disconnect failed or timed out:', e); 
    }
    wallet = null;
  }

  if (type === 'discovery') {
    const windowObject = await connect({
      modalMode: 'alwaysAsk',
      modalTheme: 'dark',
    });

    if (!windowObject) {
      throw new Error('No wallet selected');
    }

    wallet = new DiscoveryWalletShim(windowObject) as any;
    const finalType = (windowObject.id as any) === 'argentX' ? 'argent' : 
                      (windowObject.id as any) === 'braavos' ? 'braavos' : 'discovery';

    return {
      address: wallet!.address.toString(),
      type: finalType as any,
    };
  }

  // Cartridge Flow
  const starkzap = getSDK();

  // Check if user wants to bypass sessions as a test
  const useSessions = !window.location.search.includes('no_sessions');
  // New flag: ?user_pays=true to force standard execution (bypass SNIP-9)
  const forceUserPays = window.location.search.includes('user_pays');

  // Default policies for game contract (both modes)
  const defaultPolicies = policies || SESSION_POLICIES;

  console.log('[StarkZap] Connecting. Use Sessions:', useSessions, 'Force User Pays:', forceUserPays);

  const getWalletWithMode = async (mode: 'sponsored' | 'user_pays') => {
    return await starkzap.connectCartridge({
      policies: useSessions ? defaultPolicies : undefined,
      feeMode: mode,
    });
  };

  try {
    const initialMode = (useSessions && !forceUserPays) ? 'sponsored' : 'user_pays';
    console.log('[StarkZap] Attempting initial connection...', { initialMode, useSessions });
    wallet = await getWalletWithMode(initialMode);

    // Ensure account is ready (deploy if needed)
    console.log('[StarkZap] Ensuring account is ready...');
    await wallet.ensureReady({ deploy: 'if_needed' });
  } catch (err: any) {
    console.error('[StarkZap] connectWallet initial attempt failed:', err);
    // Normalize: starkzap WASM may reject with a plain string, not an Error object
    const errMsg: string = typeof err === 'string' ? err : (err?.message ?? '');

    const isSnip9Error = errMsg.includes('SNIP-9') || errMsg.includes('ISRC9');
    if (isSnip9Error && !forceUserPays) {
      console.warn('[StarkZap] SNIP-9 error detected. Falling back to user_pays mode...');
      wallet = await getWalletWithMode('user_pays');
      try {
        await wallet.ensureReady({ deploy: 'if_needed' });
      } catch (readyErr: any) {
        sdk = null;
        throw readyErr;
      }
    } else if (errMsg.includes('failed to initialize') && useSessions) {
      console.warn('[StarkZap] Controller failed to initialize with policies. Retrying WITHOUT policies...');
      // Note: We don't reset sdk = null here unless the fallback also fails, 
      // as the SDK instance might still be valid for non-policy connection.
      try {
        wallet = await starkzap.connectCartridge({
          policies: undefined,
          feeMode: 'user_pays',
        });
        await wallet.ensureReady({ deploy: 'if_needed' });
      } catch (retryErr: any) {
        sdk = null;
        const retryMsg = typeof retryErr === 'string' ? retryErr : (retryErr?.message ?? '');
        throw new Error(`Fallback failed: ${retryMsg}`);
      }
    } else {
      const isSecurityError = errMsg.includes('NotAllowedError') || errMsg.includes('WebAuthn') || errMsg.includes('TLS');
      if (isSecurityError) {
        // DO NOT reset sdk = null here if it's just a browser security block;
        // resetting the SDK causes the entire iframe/session to be lost on retry.
        const contextMsg = window.isSecureContext ? "Secure Context: YES" : "Secure Context: NO";
        throw new Error(`Controller blocked by browser (WebAuthn/TLS error). ${contextMsg}. Protocol: ${window.location.protocol}. Dev: run on http://localhost:5173 (plain HTTP). Production: ensure valid HTTPS cert.`);
      }

      if (errMsg.includes('failed to initialize')) {
        console.error('[StarkZap] Controller initialization failed. Full Error:', err);
        sdk = null; // This IS a fatal initialization error, so we reset.
      }
      throw err;
    }
  }

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
    type: 'cartridge',
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
  commitAndWagerMulticall: (gameId: string, commitment: string, tokenId?: string) => Promise<string>;
}

/**
 * Trigger Account Settings / Upgrade UI for Cartridge Controller.
 */
export async function upgradeWallet(): Promise<void> {
  const starkzap = getSDK();
  // Cartridge Controller typically handles this inside the settings/auth UI
  // which we trigger by reconnecting with policies (or using a specific starkzap call if available)
  await starkzap.connectCartridge({
    // Passing no policies + user_pays often triggers the upgrade flow or shows current status
    feeMode: 'user_pays',
  });
}

/**
 * Create game contract call functions using the connected wallet.
 */
export function getGameContract(): GameContractCalls {
  const _getWallet = () => {
    return getWallet();
  };

  const getTargetContract = () => {
    const subMode = useGameStore.getState().onlineSubMode;
    return subMode === 'betting' ? GAME_CONTRACT_SCHIZO : GAME_CONTRACT_NORMAL;
  };

  const wrapExecute = async (fn: (target: string) => Promise<any>, actionLabel = 'Transaction') => {
    const target = getTargetContract();
    const { addToast, removeToast } = useToastStore.getState();
    const toastId = addToast({ message: `${actionLabel} in progress...`, type: 'loading', duration: Infinity });

    try {
      const result = await fn(target);
      const txHash = typeof result === 'string' ? result : (result?.hash || result?.transaction_hash);
      
      removeToast(toastId);
      addToast({ 
        message: `${actionLabel} successful!`, 
        type: 'success', 
        txHash: txHash 
      });
      
      return result;
    } catch (err: any) {
      removeToast(toastId);
      const isSnip9Error = err.message?.includes('SNIP-9') || err.message?.includes('ISRC9');
      
      if (isSnip9Error) {
        throw new Error('YOUR_ACCOUNT_UPGRADE_REQUIRED');
      }

      addToast({ 
        message: `${actionLabel} failed: ${err.message || 'Unknown error'}`, 
        type: 'error' 
      });
      throw err;
    }
  };

  return {
    async createGame(gameId: string, player2Address?: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const p2 = player2Address || '0x0';
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'create_game',
            calldata: [gameId, p2],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Create Game');
    },

    async joinGame(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'join_game',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Join Game');
    },

    async commitCharacter(game_id: string, commitment: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'commit_character',
            calldata: [game_id, commitment],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Commit Character');
    },

    async revealCharacter(gameId: string, characterId: string, salt: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'reveal_character',
            calldata: [gameId, characterId, salt],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Reveal Character');
    },

    async submitMove(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'submit_move',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Submit Move');
    },

    async claimTimeoutWin(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'claim_timeout_win',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Claim Timeout Win');
    },

    async cancelGame(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'cancel_game',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Cancel Game');
    },

    async getGame(gameId: string) {
      const target = getTargetContract();
      const w = getWallet();
      const result = await w.callContract({
        contractAddress: target,
        entrypoint: 'get_game',
        calldata: [gameId],
      });

      // Parse the response - Game struct fields (14 felts total)
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
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'deposit_wager',
            calldata: [gameId, tokenId, '0'],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Wager NFT');
    },

    async opponentWon(gameId: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const tx = await w.execute([
          {
            contractAddress: target,
            entrypoint: 'opponent_won',
            calldata: [gameId],
          },
        ]);
        await tx.wait();
        return tx.hash;
      }, 'Confirm Win');
    },

    async commitAndWagerMulticall(gameId: string, commitment: string, tokenId?: string): Promise<string> {
      return await wrapExecute(async (target) => {
        const w = getWallet();
        const calls = [
          {
            contractAddress: target,
            entrypoint: 'commit_character',
            calldata: [gameId, commitment],
          },
        ];

        if (tokenId) {
          calls.push({
            contractAddress: target,
            entrypoint: 'deposit_wager',
            calldata: [gameId, tokenId, '0'],
          });
        }

        const tx = await w.execute(calls);
        await tx.wait();
        return tx.hash;
    }, tokenId ? 'Lock In & Wager' : 'Commit Character');
    },
  };
}
