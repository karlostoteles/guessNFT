import { useToriiGameSync } from './useToriiGameSync';

/**
 * Headless component that activates the Torii synchronization hook.
 * Mount this at the top level (App or UIOverlay).
 */
export function OnlineGameManager() {
  useToriiGameSync();
  return null;
}
