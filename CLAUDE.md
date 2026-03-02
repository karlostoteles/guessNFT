# WhoisWho — AI Agent Guide

## What Is This?

WhoisWho is a browser-based 1v1 deduction game — "Guess Who?" for Starknet NFT collections. Each player secretly picks a character from a shared board of NFT portraits. On your turn you ask a yes/no question about a trait (e.g. "Does your character have a hat?"); the answer lets you eliminate characters who don't match. First player to correctly guess their opponent's secret character wins.

Supports three modes: **local pass-and-play**, **vs CPU**, and **online multiplayer** via Supabase Realtime. Starknet wallet + commit-reveal provides a tamper-evident hidden choice (on-chain enforcement is Phase 2).

## Tech Stack

| Layer | Technology |
|---|---|
| UI framework | React 19 + TypeScript 5.9, Vite 7 |
| 3D board | Three.js 0.183 via @react-three/fiber 9 + Drei 10 |
| State management | Zustand 5 with Immer middleware |
| UI animations | Framer Motion 12 |
| Online multiplayer | Supabase (Postgres + Realtime channels) |
| Wallet + NFT | Starknet.js 6, Cartridge Controller, starkzap |
| Crypto primitives | Pedersen hash (starknet.js) for commit-reveal |

## Project Structure

```
src/
  core/         ← game brain
    store/      → Zustand store, selectors, types, GamePhase enum
    data/       → characters, traits, questions, NFT adapter
    ai/         → CPU opponent logic
    rules/      → evaluateQuestion, game constants
  services/     ← external integrations (no game logic here)
    starknet/   → wallet, NFT fetching, commit-reveal, collection service
    supabase/   → client, game service, realtime subscriptions, types
  rendering/    ← visuals only
    scene/      → Three.js: Board, CharacterGrid, CharacterTile, Camera
    canvas/     → 2D portrait generation (PortraitRenderer, drawFace/Hair/Accessories)
  shared/       ← cross-cutting concerns
    audio/      → procedural SFX engine
    hooks/      → useAdaptiveGrid, useCPUPlayer, useOnlineGameSync, useCharacterTextures
  ui/           ← React UI components (no game logic)
    screens/    → full-page views: Menu, CharacterSelect, OnlineLobby, Result, etc.
    panels/     → docked gameplay panels: Question, Answer, Guess, SecretCard, etc.
    overlays/   → transient auto-dismiss overlays: GuessWrong, AutoEliminating, etc.
    widgets/    → small persistent HUD elements: TurnIndicator, RiskIt, CPUThinking
    common/     → shared primitives: Button, Card
    UIOverlay.tsx → root UI, mounts screens/panels/overlays based on GamePhase
  App.tsx       → mounts GameScene (3D) + UIOverlay (2D)
  main.tsx      → entry point
```

## Import Conventions

- **Cross-module:** Always use `@/` alias (e.g. `import { usePhase } from '@/core/store/selectors'`)
- **Intra-module:** Use relative `./` (e.g. `import { drawFace } from './drawFace'`)
- **Never** use `../` to cross module boundaries — that breaks the layering
- **Barrel exports:** Every module directory has an `index.ts`. Import from the barrel when adding new consumers

The `@/` alias maps to `src/` and is configured in both `tsconfig.json` and `vite.config.ts`.

## State Machine (GamePhase)

All game flow is driven by the `GamePhase` enum in `src/core/store/types.ts`.

```
MENU → SETUP_P1 → SETUP_P2 → HANDOFF_START
  → QUESTION_SELECT → ANSWER_PENDING → ANSWER_REVEALED
  → AUTO_ELIMINATING → TURN_TRANSITION → (back to QUESTION_SELECT)
  → GUESS_SELECT → GUESS_WRONG (loops) | GUESS_RESULT → GAME_OVER
```

Online mode adds: `ONLINE_WAITING`, `HANDOFF_TO_OPPONENT`

Rules:
- All phase transitions go through `useGameStore` actions in `src/core/store/gameStore.ts`
- Never set `phase` directly on the store
- `UIOverlay.tsx` reads the current phase and mounts the right screen/panel/overlay

## Key Patterns

**Selectors** — Read state via pre-built hooks from `src/core/store/selectors.ts` (`usePhase()`, `useGameCharacters()`, `useActivePlayer()`, etc.). UI components must never access the raw Zustand store.

**LOD system** — `CharacterTile` in `rendering/scene/` renders at three tiers (minimal / flat / full) based on tile pixel width. The tier is decided by `getTileLOD()` in `core/rules/`.

**Procedural portraits** — `rendering/canvas/PortraitRenderer.ts` generates character face textures from trait data using Canvas 2D and returns a `THREE.CanvasTexture`. Call `.dispose()` when tiles unmount to avoid memory leaks.

**Commit-reveal** — `services/starknet/commitReveal.ts` computes `Pedersen(characterId, salt)` client-side. `submitCommitmentOnChain()` and `revealCharacterOnChain()` are Phase 2 stubs — not yet live.

**Online sync** — `shared/hooks/useOnlineGameSync.ts` is the single hook bridging Supabase Realtime events to Zustand store actions. All online state flows through it.

## How to Add Things

### New yes/no question
Edit `src/core/data/questions.ts` and add the question object. If it tests a new trait, also update `src/core/rules/evaluateQuestion.ts`.

### New character trait
1. Add the type to `src/core/data/traits.ts`
2. Update character entries in `src/core/data/characters.ts`
3. Add a question in `src/core/data/questions.ts`
4. Update `src/core/rules/evaluateQuestion.ts` matcher
5. Add rendering in `src/rendering/canvas/drawFace.ts`, `drawHair.ts`, or `drawAccessories.ts`

### New UI screen
1. Create component in `src/ui/screens/`
2. Export from `src/ui/screens/index.ts`
3. Mount in `src/ui/UIOverlay.tsx` under the appropriate `GamePhase` condition

### New game phase
1. Add value to `GamePhase` enum in `src/core/store/types.ts`
2. Add transition action(s) in `src/core/store/gameStore.ts`
3. Add selector in `src/core/store/selectors.ts` if needed
4. Mount UI in `src/ui/UIOverlay.tsx`

### New Starknet feature
1. Add to appropriate file in `src/services/starknet/`
2. Export from `src/services/starknet/index.ts`
3. Reference deployed contract addresses in `src/services/starknet/config.ts`
4. Use `mcp__cairo-coder__assist_with_cairo` for Cairo contract work

### New online multiplayer event
1. Add the event type to `src/services/supabase/types.ts`
2. Send it via the Supabase client in `src/shared/hooks/useOnlineGameSync.ts`
3. Handle it in the `handleEvent()` function in the same file

## Build & Dev Commands

```bash
npm run dev      # start Vite dev server
npm run build    # TypeScript check + production build
npm run preview  # preview the production build locally
```

## Rules for AI Agents

- **State reads:** Always go through selectors in `src/core/store/selectors.ts`. Never destructure from `useGameStore` directly in UI components.
- **State writes:** Only through store actions. Never mutate store state outside of `gameStore.ts`.
- **Separation of concerns:** `ui/` components contain no game logic. `services/` modules contain no game rules. Logic lives in `core/`.
- **Three.js:** Scene components stay in `rendering/scene/`. Do not import Three.js or R3F in `ui/` components.
- **Texture cleanup:** Always call `.dispose()` on `THREE.CanvasTexture` and `THREE.Texture` instances when components unmount.
- **Elimination performance:** Use `Set<string>` for `eliminatedIds` lookups, not `Array.includes()`.

## Starknet Phase 2 — What's Not Done Yet

- `GAME_CONTRACT = '0x0'` in `src/services/starknet/config.ts` — Cairo contract not deployed
- `submitCommitmentOnChain()` and `revealCharacterOnChain()` in `src/services/starknet/commitReveal.ts` are stubs
- Answer evaluation currently happens on the receiver's client (no on-chain verification)
- Supabase `game_events` has no event authorization — RLS is wide open

Cairo tools: `mcp__cairo-coder__assist_with_cairo`
Reference contracts: `/projects/beefchain-zypherpunk/starknet/src/`, `/projects/tu-vaca/packages/snfoundry/`

## Known Issues (Prioritized)

**Critical**
- Hardcoded bypass secret `'starknethas8users'` in `OnlineLobbyScreen.tsx:39` — remove before production
- Supabase RLS is `for all using (true)` — anyone can read/write any game row
- Three.js textures are never `.dispose()`'d — memory leaks over long sessions
- `eliminatedIds.includes()` is O(n) inside loops — switch to `Set`

**High**
- Commit-reveal is client-side only — anti-cheat requires Phase 2 contracts
- No Supabase event authorization — opponent can send any event type

**Dead code (preserved intentionally — do not delete without discussion)**
- `useNFTTextures.ts`, `SchizodioPickerScreen.tsx`, `NoNFTScreen.tsx` — not yet wired in
- `HANDOFF_TO_OPPONENT` and `ELIMINATION` phases — reserved for future game modes
- Phase 2 stubs in `commitReveal.ts` and several unused Supabase functions
