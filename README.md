# WhoisWho

**The classic guessing game, rebuilt with Zero-Knowledge Proofs on Starknet.**

Pick an NFT. Ask questions. Never reveal your choice — until you win.

[![Starknet](https://img.shields.io/badge/Starknet-7C3AED?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHZpZXdCb3g9IjAgMCAyMCAyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTAgMkwyIDE4aDE2TDEwIDJ6IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==&logoColor=white)](https://starknet.io)
[![Noir](https://img.shields.io/badge/Noir_ZK-1.0.0--beta.16-black?style=flat-square)](https://noir-lang.org)
[![Dojo](https://img.shields.io/badge/Dojo-1.8.0-orange?style=flat-square)](https://dojoengine.org)
[![Garaga](https://img.shields.io/badge/Garaga-1.0.1-blue?style=flat-square)](https://github.com/keep-starknet-strange/garaga)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

---

## The Problem

In the classic "Guess Who?" board game, players trust each other to answer honestly. Online, that trust doesn't exist. A player could lie about their character's traits, or secretly switch characters mid-game.

## The Solution

WhoisWho uses **Zero-Knowledge Proofs** to make cheating cryptographically impossible:

1. **Commit** — Each player picks a character and commits a hash on-chain. They can't change it later.
2. **Play** — When asked "Does your character have green eyes?", the answering player generates a ZK proof that says *"the answer is YES, and here's a proof that I'm not lying — but I'm not telling you which character I picked."*
3. **Verify** — The Starknet contract verifies the proof on-chain. The answer is trustworthy without revealing the character.
4. **Reveal** — At game end, both players reveal their picks. The contract verifies the reveals match the original commits.

No player can cheat. No server is trusted. The blockchain is the referee.

---

## How It Works

```
  Player's Browser                    Starknet
  ─────────────────                   ────────

  "Does your character
   have a Fedora Hat?"
        │
        ▼
  Load character bitmap               ask_question(game_id, 263)
  + Merkle proof from                       │
  schizodio.json                            ▼
        │                             Game.awaiting_answer = true
        ▼
  ┌─ Web Worker ───────┐
  │ 1. Noir witness    │
  │ 2. UltraHonk proof │
  │ 3. Garaga calldata │
  └────────┬───────────┘
           │
           ▼
  Submit proof tx ──────────────▶ answer_question_with_proof()
                                       │
                                  Garaga verifier ✓
                                       │
                                  answer = NO
                                  Turn flips
```

### The ZK Circuit Proves Three Things

1. **You committed to this character** — your commitment hash matches
2. **This character exists** — it's in the official Merkle tree of 999 NFTs
3. **The answer is correct** — the trait bitmap says what you claim

All without revealing *which* character you picked.

---

## Architecture

```
packages/
  circuits/    Noir ZK circuit (answer correctness proof)
  contracts/   Dojo Cairo smart contracts (game state machine)
  verifier/    Garaga-generated on-chain proof verifier

scripts/       Data pipeline (Merkle tree, bitmaps, deployment)
src/           React frontend (Three.js 3D board, Web Worker prover)
```

### Stack

| Layer | Tech | What it does |
|-------|------|-------------|
| **ZK Circuit** | [Noir](https://noir-lang.org) 1.0.0-beta.16 | Defines what the proof proves |
| **Proof System** | [Barretenberg](https://github.com/AztecProtocol/barretenberg) (UltraHonk) | Generates the proof in-browser via WASM |
| **Verifier** | [Garaga](https://github.com/keep-starknet-strange/garaga) 1.0.1 | Verifies proofs on-chain in Cairo |
| **Contracts** | [Dojo](https://dojoengine.org) 1.8.0 (Cairo 2.13.1) | Game logic, commit-reveal, state machine |
| **Hash** | Poseidon2 (BN254) | Same hash in Noir, JavaScript, and Cairo |
| **Frontend** | React 19 + Three.js + Zustand | 3D board, wallet integration, proof UX |
| **Wallet** | [Cartridge Controller](https://cartridge.gg) | Account abstraction + session keys |
| **Indexer** | [Torii](https://dojoengine.org) (WASM client) | Real-time game state sync |

### Game Phases

```
WAITING  →  COMMIT  →  PLAYING  →  REVEAL  →  COMPLETED
  P2 joins    Both       Q&A loop     Both       Winner
              commit     with ZK      reveal     declared
              chars      proofs       chars
```

---

## Game Modes

### Free Mode (vs CPU)
No wallet needed. Play against a binary-search AI using 24 meme characters.

### Online Mode (NFT)
Connect your Starknet wallet. If you hold [SCHIZODIO](https://unframed.co/collection/0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa) NFTs, the board populates with your actual NFTs. 418 yes/no questions derived from 14 trait categories (Background, Body, Clothing, Eyes, Hair, Headwear, Weapons, etc.).

---

## Quick Start

### Prerequisites

- Node.js 20+
- [Noir](https://noir-lang.org/docs/getting_started/installation/) 1.0.0-beta.16 (`nargo`)
- [Barretenberg](https://github.com/AztecProtocol/barretenberg) 3.0.0-nightly (`bb`)
- [Scarb](https://docs.swmansion.com/scarb/) 2.13.1 / 2.14.0
- [Dojo](https://dojoengine.org) 1.8.0 (`sozo`, `katana`, `torii`)
- [Garaga](https://github.com/keep-starknet-strange/garaga) 1.0.1 (`pip install garaga`)

### Install & Run

```bash
# Install frontend dependencies
npm install

# Start local Starknet node
katana --dev --dev.no-fee

# Deploy contracts (verifier + game logic)
bash scripts/deploy-local.sh

# Start Torii indexer
torii --world <WORLD_ADDRESS> --rpc http://localhost:5050

# Start frontend dev server
npm run dev
```

### Build the Collection Data

```bash
# Generate bitmaps + Merkle tree for all 999 NFTs
npx tsx scripts/prepare-collection.ts

# Generate test witness for the Noir circuit
npx tsx scripts/test-vectors.ts

# Compile and test the circuit
cd packages/circuits && nargo test && nargo prove
```

### Test Contracts

```bash
cd packages/contracts
sozo test              # 32 tests covering full game flow
```

### Test Verifier Standalone

```bash
bash scripts/test-verifier-local.sh
```

---

## Project Structure

### `packages/circuits/` — Noir ZK Circuit

The circuit proves answer correctness without revealing the character. It takes 6 public inputs (game_id, turn_id, player, commitment, question_id, traits_root) and 4 private inputs (character_id, salt, trait_bitmap, merkle_path), and returns a single bit: the answer.

Three constraints:
1. Commitment binding — `hash4(game_id, player, char_id, salt) == commitment`
2. Merkle membership — character exists in the official collection
3. Answer correctness — bit extraction from the trait bitmap

### `packages/contracts/` — Dojo Game Contracts

8 entrypoints managing the full game lifecycle:

| Function | What it does |
|----------|-------------|
| `create_game` | Creates a game session, sets Merkle root |
| `join_game` | Second player joins |
| `commit_character` | Submit Pedersen + Poseidon2 commitment |
| `ask_question` | Active player asks a yes/no question |
| `answer_question_with_proof` | Other player submits ZK proof with answer |
| `make_guess` | Final character guess |
| `reveal_character` | Verify commitment, determine winner |
| `claim_timeout` | Win by opponent inactivity (45s) |

### `packages/verifier/` — Garaga Verifier

Auto-generated Cairo contract that verifies UltraKeccakZKHonk proofs. Generated from the circuit's verification key using `garaga gen`. The Dojo game contract calls this to verify each proof.

### `scripts/` — Data Pipeline

| Script | Purpose |
|--------|---------|
| `prepare-collection.ts` | Build `schizodio.json` (bitmaps + Merkle proofs for 999 NFTs) |
| `merkle.ts` | Poseidon2 Merkle tree implementation (matches Noir exactly) |
| `question-schema.ts` | Maps 418 trait values to bit positions |
| `test-vectors.ts` | Generate circuit test witness (`Prover.toml`) |
| `deploy-local.sh` | Deploy verifier + Dojo world to local Katana |
| `test-verifier-local.sh` | Smoke-test the deployed verifier |

### `src/` — React Frontend

| Directory | Purpose |
|-----------|---------|
| `workers/prover.worker.ts` | Web Worker: Noir → UltraHonk → Garaga calldata |
| `hooks/useZKAnswer.ts` | Proof generation + on-chain submission |
| `hooks/useToriiGameSync.ts` | Real-time game state via Torii |
| `starknet/` | Wallet, config, NFT service, commit-reveal, collection data |
| `store/` | Zustand game state (27 phases) |
| `scene/` | Three.js 3D game board |
| `ui/` | 24 React components |

---

## Client-Side Proof Generation

The browser generates the exact same proof that the on-chain verifier checks. The pipeline runs in a Web Worker to keep the UI responsive:

1. **Noir witness generation** — evaluate the circuit constraints with the player's private inputs
2. **UltraHonk proof** — generate a cryptographic proof (~5-30s depending on device)
3. **Garaga calldata** — format the proof for the Starknet verifier contract

The same `@aztec/bb.js` library (Barretenberg WASM) is used in both `scripts/merkle.ts` (offline) and `src/workers/prover.worker.ts` (browser), ensuring identical Poseidon2 hash outputs.

---

## Key Design Decisions

**Poseidon2 over SHA-256** — ~30 Noir gates vs ~30,000. Makes the circuit practical for in-browser proving.

**BN254 values stored as u256** — Poseidon2 BN254 outputs can exceed the Stark field prime (~16%). The contract stores and compares as `u256`, never recomputing hashes on-chain.

**Two commitment hashes** — Pedersen (felt252) for the reveal phase (native Cairo verification), Poseidon2 BN254 (u256) for ZK proofs (circuit compatibility).

**Singleton Web Worker** — WASM init is expensive (~3.5MB). One worker is reused across all proof requests.

**Pre-computed Merkle paths** — The browser doesn't rebuild the tree. `schizodio.json` includes pre-computed paths for all 999 characters.

**Contract-first state** — Starknet is the source of truth. The frontend derives UI state from Torii model subscriptions.

---

## Documentation

| Document | Description |
|----------|-------------|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Deep technical documentation (circuit, contracts, verifier, scripts, client proof gen) |
| [docs/DEV-GUIDE.md](docs/DEV-GUIDE.md) | Developer setup, local deployment, troubleshooting |
| [docs/CIRCUITO-NOIR-EXPLICADO.md](docs/CIRCUITO-NOIR-EXPLICADO.md) | Circuit explanation (Spanish) |

---

## Built With

- [SCHIZODIO](https://unframed.co/collection/0x077485a949c130cf0d98819d2b0749f5860b0734ea28cb678dd3f39379131bfa) — The NFT collection
- [Noir](https://noir-lang.org) — ZK circuit language by Aztec
- [Barretenberg](https://github.com/AztecProtocol/barretenberg) — UltraHonk proof system
- [Garaga](https://github.com/keep-starknet-strange/garaga) — On-chain proof verification for Starknet
- [Dojo](https://dojoengine.org) — On-chain game framework
- [Cartridge](https://cartridge.gg) — Wallet & account abstraction

---

## License

MIT
