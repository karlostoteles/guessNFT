/**
 * ZKWaitingScreen — Waiting screen with ZK phase awareness.
 *
 * The OnlineWaitingScreen already handles REVEAL_WAITING phase.
 * This file documents the ZK-specific phases it must handle:
 *   - ONLINE_WAITING: waiting for opponent to commit/join
 *   - REVEAL_WAITING: both players revealing characters on-chain
 *
 * Post-merge, the existing OnlineWaitingScreen at
 * src/ui/screens/OnlineWaitingScreen.tsx already supports these
 * phases — no new component needed, just ensure the imports
 * reference the correct GamePhase values.
 */

export const ZK_WAITING_PHASES = ['ONLINE_WAITING', 'REVEAL_WAITING'] as const;
