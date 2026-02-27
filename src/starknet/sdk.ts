/**
 * Cartridge Controller integration — direct @cartridge/controller usage.
 *
 * Uses the Cartridge Controller class directly for reliable connection,
 * session reuse (probe), and proper mainnet chain configuration.
 */
import { RPC_URL, SESSION_POLICIES } from './config';

// Mainnet Chain ID (hex)
const SN_MAINNET_CHAIN_ID = '0x534e5f4d41494e4e4554';

// Controller singleton — typed as any since @cartridge/controller is dynamic
let controllerInstance: any = null;

/** Return type for wallet connection */
export interface ConnectedWallet {
  address: string;
  username?: () => Promise<string>;
}

async function loadControllerClass(): Promise<any | null> {
  try {
    const mod = await import('@cartridge/controller');
    // The default export is the ControllerProvider class
    return (mod as any).default ?? (mod as any).ControllerProvider ?? (mod as any).Controller;
  } catch {
    return null;
  }
}

/**
 * Connect wallet via Cartridge Controller.
 * Returns an object with address and username getter.
 */
export async function connectCartridgeWallet(): Promise<ConnectedWallet> {
  // Lazy-load the Controller class if not yet initialized
  if (!controllerInstance) {
    const CtrlClass = await loadControllerClass();

    if (!CtrlClass) {
      // Fallback: try starkzap's connectCartridge
      return connectViaStarkzap();
    }

    controllerInstance = new CtrlClass({
      defaultChainId: SN_MAINNET_CHAIN_ID,
      chains: [{ rpcUrl: RPC_URL }],
      policies: SESSION_POLICIES,
      slot: 'whoiswho',
      signupOptions: ['webauthn', 'google', 'discord'],
    });

    console.log('[cartridge] Controller initialized');
  }

  const ctrl = controllerInstance;

  // Try to reuse an existing session first (probe)
  try {
    const existingAccount = await ctrl.probe?.();
    if (existingAccount?.address) {
      console.log('[cartridge] Reusing existing session:', existingAccount.address);
      return {
        address: String(existingAccount.address),
        username: ctrl.username ? async () => String(await ctrl.username()) : undefined,
      };
    }
  } catch {
    console.log('[cartridge] No existing session, opening connect UI...');
  }

  // Open Cartridge Controller auth UI
  const account = await ctrl.connect?.();

  if (!account) {
    throw new Error('Cartridge connection cancelled or failed — no account returned');
  }

  console.log('[cartridge] Connected:', account.address);

  return {
    address: String(account.address),
    username: ctrl.username ? async () => String(await ctrl.username()) : undefined,
  };
}

/**
 * Fallback: use starkzap's built-in connectCartridge.
 */
async function connectViaStarkzap(): Promise<ConnectedWallet> {
  console.warn('[cartridge] Falling back to starkzap connectCartridge');
  const { StarkSDK } = await import('starkzap');
  const sdk = new StarkSDK({ network: 'mainnet', rpcUrl: RPC_URL });
  const wallet: any = await sdk.connectCartridge({ policies: SESSION_POLICIES });

  const address = String(wallet.address ?? '');
  if (!address) throw new Error('No address from starkzap wallet');

  const usernameGetter = wallet.username
    ? async () => String(typeof wallet.username === 'function' ? await wallet.username() : wallet.username)
    : undefined;

  return { address, username: usernameGetter };
}

/**
 * Disconnect wallet and clear controller instance.
 */
export function resetSDK() {
  try {
    controllerInstance?.disconnect?.();
  } catch {
    // ignore
  }
  controllerInstance = null;
}
