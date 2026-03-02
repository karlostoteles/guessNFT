/**
 * Enriches stub NFT characters with real trait attributes.
 *
 * When the user is in nft/online mode and has owned NFTs in their wallet,
 * fetches real traits for those token IDs via the serverless proxy and
 * applies them to the matching stub characters in the game store.
 *
 * This bridges the gap between the 999 hash-derived stubs (no nft_* traits)
 * and the real SCHIZODIO attribute data (nft_hair, nft_has_mask, etc.)
 * that NFT questions (questions.ts zone:'nft') require for correct evaluation.
 *
 * Fires once per unique set of owned token IDs — safe to call on every render.
 */
import { useEffect } from 'react';
import { useGameMode } from '@/core/store/selectors';
import { useGameStore } from '@/core/store/gameStore';
import { useOwnedNFTs } from '@/services/starknet/walletStore';
import { fetchTraitsBatch } from '@/services/starknet/nftService';

export function useNFTTraitLoader(): void {
  const mode       = useGameMode();
  const ownedNFTs  = useOwnedNFTs();

  // Build a stable key from sorted token IDs so the effect only re-runs
  // when the wallet's NFT set actually changes, not on every render.
  const tokenKey = ownedNFTs.map((n) => n.tokenId).sort().join(',');

  useEffect(() => {
    if (mode !== 'nft' && mode !== 'online') return;
    if (!tokenKey) return;

    const tokenIds = tokenKey.split(',');

    fetchTraitsBatch(tokenIds)
      .then((traitMap) => {
        useGameStore.getState().enrichNFTCharacters(traitMap);
        if (import.meta.env.DEV) {
          console.log(`[useNFTTraitLoader] Enriched ${traitMap.size} characters with real traits`);
        }
      })
      .catch((err) => {
        console.warn('[useNFTTraitLoader] Trait fetch failed:', err);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, tokenKey]);
}
