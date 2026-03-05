# guessNFT — SCHIZODIO Premiere

> The classic family guessing game, rebuilt for crypto. Play with your SCHIZODIO NFTs on Starknet.

![guessNFT](https://img.shields.io/badge/Starknet-Mainnet-7C3AED?style=flat-square) ![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square) ![Three.js](https://img.shields.io/badge/Three.js-3D-black?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## What is this?

guessNFT is a **1v1 deduction game** where players secretly pick a character, then take turns asking yes/no questions about the opponent's pick. First to correctly guess wins.

This version is built for the **SCHIZODIO NFT collection** on Starknet — holders can play using their actual NFTs as characters, with cryptographic commit-reveal ensuring neither player can cheat by changing their character mid-game.

---

## Game Modes

### Play Free (vs CPU)
No wallet required. Play against an AI opponent using 24 crypto meme characters (Vitalik, Satoshi, CZ, SBF, Do Kwon, and 19 others). The CPU uses a binary-search strategy — it picks questions that split the remaining characters closest to 50/50.

### Play for Real (NFT mode)
Connect your Starknet wallet via [Cartridge Controller](https://cartridge.gg). If you hold SCHIZODIO NFTs, they populate the board as your characters. Your NFT's on-chain traits drive the questions — hair color, eyes, skin tone, accessories, etc.

---

## Architecture

```
src/
├── ai/               CPU opponent (binary search strategy)
├── audio/            Web Audio API SFX engine (zero dependencies)
├── canvas/           Procedural portrait renderer (Canvas 2D)
├── data/             Character definitions, traits, questions, NFT adapter
├── hooks/            useCPUPlayer, useCharacterPreviews
├── scene/            Three.js / React Three Fiber 3D board
├── starknet/
│   ├── config.ts       Contract addresses, RPC URL, chain ID
│   ├── sdk.ts          Cartridge Controller wallet connection
│   ├── hooks.ts        useWalletConnection React hook
│   ├── walletStore.ts  Zustand wallet state
│   ├── nftService.ts   ERC-721 ownership + metadata fetching
│   ├── commitReveal.ts Commit-reveal scheme (Phase 1 local, Phase 2 on-chain stubs)
│   └── types.ts        Shared types (NFT, wallet state)
├── store/            Zustand + Immer game state machine
└── ui/               All React components (Framer Motion animations)
```

### Game Phase State Machine

```
MENU → SETUP_P1 → [HANDOFF_P1_TO_P2 → SETUP_P2] → HANDOFF_START
     → QUESTION_SELECT → HANDOFF_TO_OPPONENT → ANSWER_PENDING
     → ANSWER_REVEALED → AUTO_ELIMINATING → TURN_TRANSITION → (repeat)
     → GUESS_SELECT → GUESS_WRONG (lose turn) | GUESS_RESULT → GAME_OVER
```

In free mode (vs CPU), handoff phases are skipped/auto-advanced. The CPU acts during `QUESTION_SELECT` using `useCPUPlayer` hook.

### Commit-Reveal (Anti-Cheat)

When playing in NFT mode, both players commit to their chosen character before the game starts:

```
commitment = pedersen_hash(character_id_felt, random_salt)
```

- **Phase 1 (current):** commitments stored in `localStorage`. At game end, both commitments are verified — a ✅ badge confirms fair play.
- **Phase 2 (pending contract):** commitments submitted on-chain. The Cairo contract verifies reveals and determines the winner trustlessly.

The Pedersen hash used is compatible with Cairo's native hash, so Phase 1 commitments are contract-ready.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 18 + TypeScript + Vite |
| 3D Board | Three.js + @react-three/fiber |
| Animations | Framer Motion |
| State | Zustand + Immer |
| Wallet | Cartridge Controller (@cartridge/controller) |
| Chain | Starknet Mainnet |
| Starknet SDK | starknet.js v9 + starkzap |
| Portraits | Canvas 2D API (procedural, no images) |
| SFX | Web Audio API (no dependencies) |
| Deployment | Netlify / Vercel (config included) |

---

## Getting Started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # production build → dist/
```

---

## Deployment

### Netlify (recommended)
Connect this repo in the Netlify dashboard — `netlify.toml` handles everything.

### Vercel
Connect this repo in Vercel — `vercel.json` handles SPA routing and caching.

### Manual
```bash
npm run build
# Deploy the dist/ folder to any static host
```

---

## Configuration

`src/starknet/config.ts`:

```ts
export const SCHIZODIO_CONTRACT = '0x077485a949c130...'; // ERC-721 contract
export const RPC_URL = 'https://api.cartridge.gg/x/starknet/mainnet';
export const SN_MAIN_CHAIN_ID = '0x534e5f4d41494e'; // Cartridge uses SN_MAIN not SN_MAINNET
export const GAME_CONTRACT = '0x0'; // TODO: deploy guessNFT Cairo contract and set here
```

---

---

## 🤖 Collaborating with AI Agents

This project follows an **Agent-First Workflow**. If you are an AI assistant (Antigravity, Claude, etc.) working on this codebase, follow these rules to ensure high-quality, verifiable progress:

### 1. The "Brain" Artifacts
All strategic work is recorded in the `brain/` directory:
- **`task.md`**: Your live checklist. Mark items as `[/]` (in-progress) or `[x]` (complete).
- **`implementation_plan.md`**: Propose your technical design here **before** writing code. Seek human approval for breaking changes.
- **`walkthrough.md`**: Document your results, performance gains, and provide proof-of-work (screenshots/recordings).

### 2. Standard Workflow
1. **Research**: Use `grep` and `find` to understand the data flow.
2. **Plan**: Update the `implementation_plan.md`.
3. **Build**: Keep changes atomic. Wrap components in `React.memo` where appropriate.
4. **Verify**: Run `npm run build` and `npm run lint` before notifying the human.

### 3. Performance Standards
- Minimize `useFrame` calls on large boards.
- Use **LOD Gating** (InstancedMesh vs. Individual Tiles).
- Batch state updates to prevent UI churn.

---

## Roadmap — v1.0 Production Ready

### ✅ Done (Milestones Met)
- [x] **Rebranding**: Migrated from WhoisWho to **guessNFT**.
- [x] **Premium NFT Assets**: Direct-to-contract metadata pipeline + composited real art on the board.
- [x] **Mobile UI**: Fully responsive layouts for phones and tablets.
- [x] **999-Character Board**: Support for the full Schizodio collection in "vs AI" mode.
- [x] **Performance Optimization**: Throttled loading, low-res textures, and CPU sampling for massive boards.
- [x] **Commit-Reveal (Phase 1)**: Local Pedersen hash commitments to prevent mid-game cheating.
- [x] **SFX Engine**: Custom Web Audio implementation for immersive gameplay.
- [x] **CPU AI**: Smart binary-search strategy for free-play mode.

### 🔴 Next Steps
#### 1. Matchmaking / Game Lobby
Currently there's no way for two players to find each other online. Needs either:
- A simple backend (Supabase, Firebase) for game room creation + WebSocket signaling.
- Or a fully on-chain lobby where players post game invitations as contract events.

#### 2. Leaderboard
On-chain leaderboard tracking wins/losses per wallet address. Feasible once the game contract is deployed (read contract events).

#### 3. Wager Mode
Players stake tokens (LORDS, ETH, or a game token) before committing. Contract holds escrow, winner takes all.

---

## Technical Appendix
For a detailed breakdown of the recent production refactor, see the [Technical Walkthrough](docs/walkthrough.md).

## License
MIT — build on it.
