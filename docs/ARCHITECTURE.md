# guessNFT — Architecture

## System Overview

guessNFT is a single-page application with a 3D game board rendered via Three.js and a 2D UI overlay for menus, panels, and HUD elements. Game state lives in a single Zustand store. Online multiplayer uses Supabase Realtime for event sync and Starknet for cryptographic commit-reveal of secret characters.

```
┌─────────────────────────────────────────────────┐
│  Browser                                         │
│  ┌───────────────┐  ┌────────────────────────┐  │
│  │  UIOverlay     │  │  GameScene (R3F Canvas)│  │
│  │  (React DOM)   │  │  Board, CharacterGrid, │  │
│  │  screens/      │  │  CharacterTile,        │  │
│  │  panels/       │  │  MysteryCard,          │  │
│  │  overlays/     │  │  Environment,          │  │
│  │  widgets/      │  │  CameraController      │  │
│  └───────┬───────┘  └──────────┬─────────────┘  │
│          │                      │                 │
│          └──────────┬───────────┘                 │
│                     ▼                             │
│            ┌─────────────────┐                    │
│            │  Zustand Store  │                    │
│            │  (GamePhase     │                    │
│            │   state machine)│                    │
│            └────────┬────────┘                    │
│                     │                             │
│       ┌─────────────┼─────────────┐               │
│       ▼             ▼             ▼               │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Starknet│  │ Supabase │  │ CPU Agent│        │
│  │ Wallet  │  │ Realtime │  │ (AI)     │        │
│  │ NFT     │  │ Postgres │  │          │        │
│  │ Commit  │  │          │  │          │        │
│  └─────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────┘
```

## Module Boundaries

### store/ — Game State (Single Source of Truth)
The entire game state lives in one Zustand store (`gameStore.ts`). It uses immer for immutable updates. The `GamePhase` enum acts as a state machine — all UI rendering and game logic keys off the current phase.

**Selectors** (`selectors.ts`) provide granular subscriptions to avoid unnecessary re-renders. Always use selectors, never raw `useGameStore(state => ...)`.

### scene/ — 3D Rendering Layer
React Three Fiber components. `GameScene` is the root, containing `Board`, `CharacterGrid` (which renders `CharacterTile` instances), `MysteryCard`, `Environment`, and `CameraController`.

The LOD system in `CharacterTile` switches between three rendering tiers based on tile size: minimal (colored plane), flat (portrait texture), full (portrait + border + glow effects).

### ui/ — 2D Overlay Layer
Rendered as regular React DOM positioned absolutely over the R3F canvas. `UIOverlay.tsx` is the root, using `AnimatePresence` to animate phase transitions.

Organized into four categories:
- **screens/** — Full-page takeovers (menu, character select, lobby, results)
- **panels/** — Docked gameplay panels (questions, answers, guessing, elimination)
- **overlays/** — Brief auto-dismiss notifications (wrong guess, auto-eliminating, phase transition)
- **widgets/** — Small persistent HUD elements (turn indicator, risk-it button, CPU thinking, wallet)

### data/ — Game Content
Static game data: character definitions, trait types, questions, and the NFT-to-character adapter. `nftCharacterAdapter.ts` converts on-chain NFT metadata into the internal `Character` interface used throughout the game.

### starknet/ — Blockchain Layer
Isolated from game logic. Provides:
- **Wallet connection** via Cartridge Controller (`sdk.ts`, `walletStore.ts`, `hooks.ts`)
- **NFT fetching** from Schizodio contract (`nftService.ts`, `collectionService.ts`)
- **Commit-reveal** cryptographic protocol (`commitReveal.ts`) — currently client-side only

### supabase/ — Online Multiplayer Backend
- **client.ts** — Supabase client initialization
- **gameService.ts** — CRUD for games + realtime event pub/sub
- **types.ts** — Database row types

### hooks/ — Shared React Hooks
Cross-cutting hooks that bridge multiple modules:
- `useOnlineGameSync` — The central online multiplayer hook (bridges store ↔ supabase ↔ starknet)
- `useCharacterTextures` — Generates Three.js textures from character data via canvas/
- `useCPUPlayer` — Drives CPU turn logic using ai/
- `useAdaptiveGrid` — Computes grid layout based on character count

### canvas/ — Portrait Generation
Procedural 2D rendering system. `PortraitRenderer.ts` creates Canvas2D portraits from `CharacterTraits`, then converts to `THREE.CanvasTexture`. Sub-modules handle face, hair, and accessories separately.

### ai/ — CPU Opponent
`cpuAgent.ts` implements the CPU player's decision-making: question selection, answer evaluation, character elimination, and guessing strategy.

## Data Flow

### Local Game (vs CPU)
```
User action → UIOverlay panel → store action → phase transition →
  → scene re-renders (board updates) + UI re-renders (new panel)
  → CPU hook fires → executeCPUTurn() → store action → ...
```

### Online Game (vs Player)
```
User action → UIOverlay panel → store action →
  → useOnlineGameSync detects change → sendEvent() to Supabase →
  → Supabase Realtime broadcasts to opponent →
  → opponent's useOnlineGameSync receives → store action → UI updates
```

### Commit-Reveal Flow
```
Character select → createCommitment(charId, salt) → hash stored locally →
  → submitCommitmentOnChain(hash) [stubbed] →
  → game plays out →
  → revealCharacterOnChain(charId, salt) → verifyReveal() confirms match
```

## Performance Considerations

- **LOD system** prevents rendering 999 full portraits simultaneously
- **InstancedMesh** used for large tile counts
- **Adaptive grid** (`computeAdaptiveGrid`) scales layout from 1 to 999 tiles
- **Manual chunk splitting** in vite.config.ts for three.js, starknet, cartridge, react
- **Known issue:** Portrait generation blocks main thread (500-2000ms on LOD transitions)
