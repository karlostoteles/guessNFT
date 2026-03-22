/**
 * Wallet connection hooks using starkzap.
 */
import { useCallback } from 'react';
import { useWalletStore } from './walletStore';
import {
  connectWallet,
  disconnectWallet,
  isWalletConnected,
  getWalletAddress,
} from './starkzapService';
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

const NFT_FETCH_TIMEOUT_MS = 8_000;

/**
 * Hook for connecting/disconnecting wallet via starkzap.
 */
export function useWalletConnection() {
  const store = useWalletStore;

  const connect = useCallback(async () => {
    const state = store.getState();
    if (state.status === 'connecting' || state.status === 'ready') return;

    state.setStatus('connecting');
    state.setError(null);

    try {
      const walletInfo = await connectWallet();

      state.setAddress(walletInfo.address);
      state.setStatus('connected');

      if (walletInfo.username) {
        state.setUsername(walletInfo.username);
      }

      // Fetch NFTs — timeout after 8s so login isn't blocked by slow RPC
      state.setStatus('loading_nfts');
      try {
        const nfts = await withTimeout(
          fetchAllOwnedNFTs(walletInfo.address),
          NFT_FETCH_TIMEOUT_MS,
          'NFT fetch',
        );
        state.setOwnedNFTs(nfts);
        state.setStatus('ready');
      } catch (err) {
        console.warn('[wallet] NFT fetch failed, wallet still connected:', err);
        state.setOwnedNFTs([]);
        state.setStatus('ready');
      }
    } catch (err: any) {
      console.error('[wallet] Connection failed:', err);
      state.setError(err.message || 'Connection failed');
      state.setStatus('error');
    }
  }, [store]);

  const disconnect = useCallback(async () => {
    await disconnectWallet();
    store.getState().reset();
  }, [store]);

  const refreshNFTs = useCallback(async () => {
    const state = store.getState();
    const address = getWalletAddress();
    if (!address || state.status !== 'ready') return;

    state.setStatus('loading_nfts');
    try {
      const nfts = await withTimeout(
        fetchAllOwnedNFTs(address),
        NFT_FETCH_TIMEOUT_MS,
        'NFT refresh',
      );
      state.setOwnedNFTs(nfts);
    } catch (err) {
      console.warn('[wallet] NFT refresh failed:', err);
    } finally {
      store.getState().setStatus('ready');
    }
  }, [store]);

  return {
    connectWallet: connect,
    disconnectWallet: disconnect,
    refreshNFTs,
    isConnected: isWalletConnected,
  };
}
