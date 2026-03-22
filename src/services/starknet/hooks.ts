/**
 * Wallet connection hooks using starkzap + Cartridge Controller.
 */
import { useCallback } from 'react';
import { useWalletStore } from './walletStore';
import { connectCartridgeWallet, resetSDK } from './sdk';
import { fetchAllOwnedNFTs } from './nftService';

/** Race a promise against a timeout. Rejects if timeout fires first. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

const NFT_FETCH_TIMEOUT_MS = 5_000;

/**
 * Hook for connecting/disconnecting wallet.
 */
export function useWalletConnection() {
  const store = useWalletStore;

  const connectWallet = useCallback(async () => {
    const state = store.getState();
    if (state.status === 'connecting' || state.status === 'ready') return;

    state.setStatus('connecting');
    state.setError(null);

    try {
      const wallet = await connectCartridgeWallet();

      // Extract address from the wallet
      const address = wallet.address;
      if (!address) throw new Error('No address returned from wallet');

      state.setAddress(address);
      state.setStatus('connected');

      // Try to get username
      try {
        if (wallet.username) {
          state.setUsername(typeof wallet.username === 'function'
            ? await wallet.username()
            : wallet.username);
        }
      } catch {
        // Username is optional
      }

      // Fetch NFTs with a short timeout — don't block login
      state.setStatus('loading_nfts');
      try {
        const nfts = await withTimeout(
          fetchAllOwnedNFTs(address),
          NFT_FETCH_TIMEOUT_MS,
          'NFT fetch',
        );
        state.setOwnedNFTs(nfts);
        state.setStatus('ready');
      } catch (err) {
        console.warn('[wallet] NFT fetch failed/timed out, wallet still connected:', err);
        state.setOwnedNFTs([]);
        state.setStatus('ready'); // Wallet is connected even if NFT fetch fails
      }
    } catch (err: any) {
      console.error('[wallet] Connection failed:', err);
      state.setError(err.message || 'Connection failed');
      state.setStatus('error');
    }
  }, [store]);

  const disconnectWallet = useCallback(() => {
    store.getState().reset();
    resetSDK();
  }, [store]);

  /** Re-fetch NFT metadata for the current address without disconnecting. */
  const refreshNFTs = useCallback(async () => {
    const state = store.getState();
    if (!state.address || state.status !== 'ready') return;
    state.setStatus('loading_nfts');
    try {
      const nfts = await fetchAllOwnedNFTs(state.address);
      state.setOwnedNFTs(nfts);
    } catch (err) {
      console.warn('[wallet] NFT refresh failed:', err);
    } finally {
      store.getState().setStatus('ready');
    }
  }, [store]);

  return { connectWallet, disconnectWallet, refreshNFTs };
}
