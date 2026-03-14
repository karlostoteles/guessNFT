/**
 * Torii WASM client — singleton instance for real-time Dojo entity sync.
 *
 * Replaces Supabase realtime. Uses @dojoengine/torii-client (WASM) directly
 * to subscribe to on-chain Game/Commitment/Board/Turn model updates.
 */
import { ToriiClient, type ClientConfig, type Subscription } from '@dojoengine/torii-client';
import { KATANA_RPC } from './config';

// World address from manifest_mainnet.json (Starknet Mainnet)
export const WORLD_ADDRESS =
  import.meta.env.VITE_WORLD_ADDRESS ?? '0x052ea305f2bd6fe7340fe08ef9664cd72596024bf0bb6d44761bc0e6731cc428';

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
