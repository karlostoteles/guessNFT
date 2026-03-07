/**
 * Wallet connection hooks using starkzap + Cartridge Controller.
 * In DEV mode, connects directly to Katana predeployed accounts.
 */
import { useCallback } from 'react';
import { useWalletStore } from './walletStore';
import { connectCartridgeWallet, resetSDK } from './sdk';
import { fetchAllOwnedNFTs } from './nftService';
import { KATANA_ACCOUNT_1, KATANA_ACCOUNT_2 } from './config';

/**
 * DEV mode: connect directly to a Katana predeployed account.
 * Skips Cartridge Controller, NFT checks, and all gating.
 */
function connectDevAccount(playerNum: 1 | 2) {
  const state = useWalletStore.getState();
  const address = playerNum === 1 ? KATANA_ACCOUNT_1 : KATANA_ACCOUNT_2;
  state.setAddress(address);
  state.setUsername(`Katana P${playerNum}`);
  state.setOwnedNFTs([{ tokenId: '1' } as any]); // fake NFT to bypass gate
  state.setStatus('ready');
  console.log(`[wallet] DEV connect → P${playerNum} (${address.slice(0, 18)}...)`);
}

/**
 * Hook for connecting/disconnecting wallet.
 */
export function useWalletConnection() {
  const store = useWalletStore;

  const connectWallet = useCallback(async (devPlayerNum?: 1 | 2) => {
    const state = store.getState();
    if (state.status === 'connecting' || state.status === 'ready') return;

    // DEV mode: skip Cartridge Controller entirely
    if (import.meta.env.DEV && devPlayerNum) {
      connectDevAccount(devPlayerNum);
      return;
    }

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

      // Fetch NFTs
      state.setStatus('loading_nfts');
      try {
        const nfts = await fetchAllOwnedNFTs(address);
        state.setOwnedNFTs(nfts);
        state.setStatus('ready');
      } catch (err) {
        console.warn('[wallet] NFT fetch failed, wallet still connected:', err);
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
