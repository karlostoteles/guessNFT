/**
 * StarkZap SDK singleton for wallet connection.
 *
 * Uses starkzap's built-in Cartridge Controller integration
 * for social login, passkeys, and gasless transactions.
 */
import { SESSION_POLICIES } from './config';

// Lazy-loaded to avoid import errors when starkzap is not yet installed
let sdkInstance: any = null;

export async function getStarkzapSDK() {
  if (sdkInstance) return sdkInstance;

  try {
    const { StarkZap } = await import('starkzap');
    sdkInstance = new StarkZap({ network: 'mainnet' });
    return sdkInstance;
  } catch (err) {
    console.warn('[starkzap] SDK not available — starkzap may not be installed yet');
    throw new Error('starkzap not available');
  }
}

/**
 * Connect wallet via Cartridge Controller (social login, passkeys).
 * Returns the connected wallet object with address and methods.
 */
export async function connectCartridgeWallet() {
  const sdk = await getStarkzapSDK();
  const wallet = await sdk.connectCartridge({
    policies: SESSION_POLICIES,
  });
  return wallet;
}

/**
 * Disconnect and clean up SDK state.
 */
export function resetSDK() {
  sdkInstance = null;
}
