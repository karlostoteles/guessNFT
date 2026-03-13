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

/**
 * Hook for connecting/disconnecting wallet via starkzap.
 */
export function useWalletConnection() {
  const store = useWalletStore;

  const connect = useCallback(async (type?: 'cartridge' | 'discovery') => {
    const state = store.getState();
    if (state.status === 'connecting' || state.status === 'ready') return;

    state.setStatus('connecting');
    state.setError(null);

    try {
      const walletInfo = await connectWallet(type);

      state.setAddress(walletInfo.address);
      state.setStatus('connected');

      if (walletInfo.username) {
        state.setUsername(walletInfo.username);
      }

      // Fetch NFTs
      state.setStatus('loading_nfts');
      try {
        const nfts = await fetchAllOwnedNFTs(walletInfo.address);
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
      const nfts = await fetchAllOwnedNFTs(address);
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
