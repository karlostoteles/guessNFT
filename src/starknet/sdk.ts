/**
 * Cartridge Controller integration.
 *
 * Uses @cartridge/controller directly and calls connect() immediately,
 * bypassing the isReady() wait that starkzap imposes (which times out
 * before the popup can open).
 */
import { RPC_URL, SESSION_POLICIES, SN_MAIN_CHAIN_ID } from './config';

export interface ConnectedWallet {
  address: string;
  username?: () => Promise<string>;
}

let controllerInstance: any = null;

async function getController(): Promise<any> {
  if (controllerInstance) return controllerInstance;

  const mod = await import('@cartridge/controller');
  const CtrlClass = (mod as any).default ?? (mod as any).Controller ?? (mod as any).ControllerProvider;
  if (!CtrlClass) throw new Error('Cartridge Controller not found');

  const policies = SESSION_POLICIES.length > 0
    ? SESSION_POLICIES.map(p => ({ target: p.target, method: p.method }))
    : undefined;

  controllerInstance = new CtrlClass({
    defaultChainId: SN_MAIN_CHAIN_ID,
    chains: [{ rpcUrl: RPC_URL }],
    ...(policies ? { policies } : {}),
  });

  return controllerInstance;
}

/**
 * Connect via Cartridge Controller.
 * Opens the Cartridge auth popup directly — no isReady() wait.
 */
export async function connectCartridgeWallet(): Promise<ConnectedWallet> {
  const ctrl = await getController();

  // Try to reuse an existing session first (silent)
  try {
    const existing = await ctrl.probe?.();
    if (existing?.address) {
      console.log('[cartridge] Reusing session:', existing.address);
      return {
        address: String(existing.address),
        username: ctrl.username ? async () => String(await ctrl.username()) : undefined,
      };
    }
  } catch {
    // No existing session — open popup
  }

  // Open Cartridge auth UI directly
  const account = await ctrl.connect();
  if (!account?.address) throw new Error('Cartridge login cancelled or failed');

  console.log('[cartridge] Connected:', account.address);
  return {
    address: String(account.address),
    username: ctrl.username ? async () => String(await ctrl.username()) : undefined,
  };
}

export function resetSDK() {
  try { controllerInstance?.disconnect?.(); } catch { /* ignore */ }
  controllerInstance = null;
}
