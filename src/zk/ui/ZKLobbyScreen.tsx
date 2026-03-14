/**
 * ZKLobbyScreen — On-chain game create/join UI.
 *
 * Contains the contract interaction logic (createGameOnChain, joinGameOnChain)
 * and the DEV mode P1/P2 account selection buttons.
 *
 * Post-merge, integrate into src/ui/screens/OnlineLobbyScreen.tsx.
 * The key imports from src/zk/:
 *   - createGameOnChain, joinGameOnChain from useZKAnswer
 *   - GamePhase extensions (ONLINE_WAITING)
 */
export { createGameOnChain, joinGameOnChain } from '../useZKAnswer';

// The OnlineLobbyScreen component itself is in src/ui/OnlineLobbyScreen.tsx.
// Post-merge, it will import createGameOnChain/joinGameOnChain from src/zk/.
// No standalone component needed here — this file re-exports for clean imports.
