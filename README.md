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

## Roadmap — What's Missing Until Full Vision

### ✅ Done (v0.2)
- [x] 3D board with procedurally generated character portraits
- [x] Local 2-player pass-and-play mode
- [x] vs CPU mode with binary-search AI strategy
- [x] SCHIZODIO NFT integration — fetches owned NFTs, maps traits to game characters
- [x] Cartridge Controller login (chain ID bug fixed — was `SN_MAINNET`, needs `SN_MAIN`)
- [x] Auto-elimination after each answer
- [x] Risk It button (guess before turn ends, lose turn if wrong)
- [x] Wrong-guess penalty (costs a turn, not the game)
- [x] SFX engine (Web Audio API, zero deps)
- [x] CPU thinking indicator + auto-advance for CPU turns
- [x] Asked-question tracking (grayed out with ✓ badge)
- [x] Commit-reveal Phase 1 (local Pedersen hash commitments, verified at game end)
- [x] Netlify + Vercel deployment config

---

### 🔴 Critical — Needed for Real Play

#### 1. Cairo Game Contract (Phase 2 commit-reveal)
The biggest missing piece. For truly trustless 1v1 play, we need an on-chain contract.

**What the contract needs to do:**
```cairo
// Players commit before seeing opponent's choice
fn commit_character(game_id: felt252, commitment: felt252)

// Questions submitted as signed transactions (prevents retroactive manipulation)
fn ask_question(game_id: felt252, question_id: felt252)

// Opponent answers (their answer is verified against their committed character at reveal)
fn answer_question(game_id: felt252, answer: bool)

// Guess — contract checks if guesser wins
fn make_guess(game_id: felt252, character_id: felt252)

// Both players reveal their characters — contract verifies pedersen(char, salt) === commitment
fn reveal_character(game_id: felt252, character_id: felt252, salt: felt252)
```

**Frontend stubs are in** `src/starknet/commitReveal.ts` — `submitCommitmentOnChain()` and `revealCharacterOnChain()`. Once the contract is deployed, set `GAME_CONTRACT` in `config.ts` and uncomment `SESSION_POLICIES`.

#### 2. Matchmaking / Game Lobby
Currently there's no way for two players to find each other online. Needs either:
- A simple backend (Supabase, Firebase) for game room creation + WebSocket signaling
- Or a fully on-chain lobby where players post game invitations as contract events

#### 3. Online Game Flow (P1/P2 on separate devices)
The current handoff phases assume one shared device. Online play needs:
- P1 creates a game → generates a room code / shares a link
- P2 joins via the link
- Both connect wallets and commit characters
- Questions/answers happen as signed Starknet transactions
- Real-time updates (poll contract events or WebSocket relay)

---

### 🟡 Important — Polish & UX

#### 4. SCHIZODIO Trait Verification
The NFT adapter (`nftCharacterAdapter.ts`) uses guessed trait_type names. After testing with a real SCHIZODIO NFT, check the DEV console logs for `[nftAdapter] Token #X traits: ...` and update the `findAttribute()` calls to match the actual trait names the contract returns.

#### 5. NFT Image Display in Game Board
NFT mode currently uses procedurally generated portraits even when NFT images are available. In `CharacterSelectScreen.tsx` and the 3D board, NFT characters with a valid `imageUrl` should show their actual NFT image instead of the generated portrait.

#### 6. Portrait Renderer for NFT Characters
The portrait renderer (`PortraitRenderer.ts`) doesn't yet handle `source: 'nft'` characters — it always generates a procedural face. For NFT mode, it should fall back to fetching the NFT's `imageUrl`.

#### 7. Game History / Replay
No persistence of game results. Players can't review their game history or share a notable game.

#### 8. Mobile Layout
The 3D board and panels are desktop-first. The responsive layout needs work for phones — the question panel overlaps the board badly on small screens.

---

### 🟢 Nice to Have

#### 9. Leaderboard
On-chain leaderboard tracking wins/losses per wallet address. Feasible once the game contract is deployed (read contract events).

#### 10. Wager Mode
Players stake tokens (LORDS, ETH, or a game token) before committing. Contract holds escrow, winner takes all. The commit-reveal contract already lends itself to this — add a `wager` field and an escrow release on `reveal_character`.

#### 11. Spectator Mode
Allow spectators to watch an ongoing game. Since questions/answers would be on-chain in Phase 2, a read-only spectator view is just a contract event listener.

#### 12. Tournament Mode
Bracket-based tournaments using Starknet for trustless bracket progression. Multiple games per player, automated elimination.

#### 13. Custom Character Sets
Allow communities to create their own character sets (any NFT collection, not just SCHIZODIO). The adapter pattern in `nftCharacterAdapter.ts` already supports this — it just needs a collection selector UI.

#### 14. Bundle Size Optimization
The Three.js chunk is ~1.6MB. Code-split the 3D scene with `React.lazy` + dynamic imports to improve initial load time.

---

## Contract Deployment Guide (Phase 2)

Once the Cairo contract is written:

```bash
# 1. Deploy to Starknet mainnet
starkli deploy guessNFT.contract_class.json --account myaccount

# 2. Update config.ts
# GAME_CONTRACT = '0x<deployed_address>'

# 3. Uncomment SESSION_POLICIES in config.ts
# { target: GAME_CONTRACT, method: 'commit_character' },
# { target: GAME_CONTRACT, method: 'ask_question' },
# ...

# 4. Implement submitCommitmentOnChain() and revealCharacterOnChain()
#    in src/starknet/commitReveal.ts
```

---

## License

MIT — build on it.
