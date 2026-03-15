/**
 * Torii WASM client — singleton instance for real-time Dojo entity sync.
 *
 * Replaces Supabase realtime. Uses @dojoengine/torii-client (WASM) directly
 * to subscribe to on-chain Game/Commitment/Board/Turn model updates.
 */
import { ToriiClient, type ClientConfig, type Subscription } from '@dojoengine/torii-client';

// World address from manifest_mainnet.json (Starknet Mainnet)
// World address from onchain/manifest_mainnet.json (deployed 2026-03-15)
export const WORLD_ADDRESS =
  import.meta.env.VITE_WORLD_ADDRESS ?? '0x06c320e0058a34ee61ca91e1731388f4554d77ecfbd3a7d6a651c6f5e5f73b53';

// Torii indexer URL — in dev, use same-origin (Vite proxies /world.World/* to Torii).
// In production, falls back to the deployed Cartridge Torii endpoint.
// Override via VITE_TORII_URL env var if needed.
export const TORII_URL = import.meta.env.VITE_TORII_URL
  ?? 'https://api.cartridge.gg/x/guessnft-zk/torii';

let clientInstance: ToriiClient | null = null;
let clientPromise: Promise<ToriiClient> | null = null;

export async function getToriiClient(): Promise<ToriiClient> {
  if (clientInstance) return clientInstance;
  if (clientPromise) return clientPromise;

  clientPromise = (async () => {
    const config: ClientConfig = {
      toriiUrl: TORII_URL,
      worldAddress: WORLD_ADDRESS,
    };
    // WASM constructor returns a Promise — must be awaited
    const client = await new ToriiClient(config);
    clientInstance = client;
    return client;
  })();

  return clientPromise;
}

export function resetToriiClient(): void {
  if (clientInstance) {
    clientInstance.free();
    clientInstance = null;
  }
}

// Re-export types used by consumers
export type { Subscription, Entity, Clause, Query, Ty, Model } from '@dojoengine/torii-client';
