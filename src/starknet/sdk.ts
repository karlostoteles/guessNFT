/**
 * Cartridge Controller integration — via starkzap's standard onboarding API.
 *
 * Uses StarkSDK.connectCartridge() which handles the Cartridge auth popup
 * correctly across localhost and deployed domains.
 */
import { StarkSDK } from 'starkzap';
import { RPC_URL, SESSION_POLICIES } from './config';

/** Return type for wallet connection */
export interface ConnectedWallet {
  address: string;
  username?: () => Promise<string>;
}

// Singleton SDK instance
let sdkInstance: StarkSDK | null = null;

function getSDK(): StarkSDK {
  if (!sdkInstance) {
    sdkInstance = new StarkSDK({ rpcUrl: RPC_URL });
  }
  return sdkInstance;
}

/**
 * Connect wallet via Cartridge Controller using starkzap's standard flow.
 * Opens the Cartridge authentication popup for social login or passkeys.
 */
export async function connectCartridgeWallet(): Promise<ConnectedWallet> {
  const sdk = getSDK();

  const wallet = await sdk.connectCartridge({
    policies: SESSION_POLICIES,
  });

  const address = String(wallet.address);
  if (!address) throw new Error('No address returned from Cartridge Controller');

  console.log('[cartridge] Connected:', address);

  return {
    address,
    username: async () => {
      const name = await wallet.username();
      return name ?? address.slice(0, 6) + '...' + address.slice(-4);
    },
  };
}

/**
 * Disconnect wallet and reset SDK instance.
 */
export function resetSDK() {
  sdkInstance = null;
}
