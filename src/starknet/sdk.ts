/**
 * Cartridge Controller integration.
 * Static import — no dynamic import delay before connect() is called.
 */
import Controller from '@cartridge/controller';
import { Account, RpcProvider } from 'starknet';
import type { AccountInterface } from 'starknet';
import {
  RPC_URL,
  SN_MAIN_CHAIN_ID,
  KATANA_RPC,
  KATANA_ACCOUNT_1,
  KATANA_PRIVATE_KEY_1,
  KATANA_ACCOUNT_2,
  KATANA_PRIVATE_KEY_2,
} from './config';

export interface ConnectedWallet {
  address: string;
  username?: () => Promise<string>;
}

let ctrl: InstanceType<typeof Controller> | null = null;

function getController() {
  if (!ctrl) {
    ctrl = new Controller({
      defaultChainId: SN_MAIN_CHAIN_ID,
      chains: [{ rpcUrl: RPC_URL }],
    });
    console.log('[cartridge] Controller created');
  }
  return ctrl;
}

/**
 * Open Cartridge login UI and return the connected wallet.
 */
export async function connectCartridgeWallet(): Promise<ConnectedWallet> {
  const controller = getController();

  console.log('[cartridge] calling connect()...');
  const account = await controller.connect();
  console.log('[cartridge] connect() returned:', account);

  if (!account?.address) {
    throw new Error('Login cancelled or failed — no account returned');
  }

  console.log('[cartridge] connected:', account.address);

  return {
    address: String(account.address),
    username: async () => {
      try {
        const name = await controller.username();
        return name ?? String(account.address).slice(0, 8);
      } catch {
        return String(account.address).slice(0, 8);
      }
    },
  };
}

/**
 * Return a Starknet AccountInterface for submitting on-chain transactions.
 * - DEV (Katana): raw Account with katana0 private key
 * - PROD: Cartridge Controller's connected account
 */
export function getStarknetAccount(playerNum?: 1 | 2): AccountInterface | null {
  if (import.meta.env.DEV) {
    const provider = new RpcProvider({ nodeUrl: KATANA_RPC });
    const address = playerNum === 2 ? KATANA_ACCOUNT_2 : KATANA_ACCOUNT_1;
    const signer = playerNum === 2 ? KATANA_PRIVATE_KEY_2 : KATANA_PRIVATE_KEY_1;
    return new Account({ provider, address, signer });
  }
  // Cartridge Controller's account — cast to satisfy AccountInterface
  // (WalletAccount from @cartridge/controller may use a slightly different starknet.js version)
  return (ctrl?.account as AccountInterface | undefined) ?? null;
}

export function resetSDK() {
  try { ctrl?.disconnect?.(); } catch { /* ignore */ }
  ctrl = null;
}
