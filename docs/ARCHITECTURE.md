# WhoisWho — Technical Architecture

> Complete technical documentation covering the ZK proof pipeline, on-chain game logic, verifier contract, build scripts, and client-side proof generation.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Section 1 — Noir ZK Circuit](#2-section-1--noir-zk-circuit)
3. [Section 2 — Dojo Cairo Contracts](#3-section-2--dojo-cairo-contracts)
4. [Section 3 — Garaga Verifier](#4-section-3--garaga-verifier)
5. [Section 4 — Scripts & Data Pipeline](#5-section-4--scripts--data-pipeline)
6. [Client-Side Proof Generation](#6-client-side-proof-generation)
7. [How Everything Connects](#7-how-everything-connects)

---

## 1. System Overview

WhoisWho is a 1v1 deduction game where two players each secretly pick a character from the SCHIZODIO NFT collection (999 characters), then take turns asking yes/no trait questions to narrow down their opponent's pick. The first player to correctly guess wins.

The critical security challenge: **how does a player answer a question about their character without revealing which character they picked?**

The answer is **Zero-Knowledge Proofs**. When asked "Does your character have green eyes?", the answering player generates a ZK proof that says:

> "I committed to a character. That character exists in the official collection. The answer to question #193 for that character is YES. Here's a cryptographic proof that all of this is true — but I'm not telling you which character it is."

The on-chain contract verifies this proof and records the answer. The character identity stays hidden until the endgame reveal.

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER (React + Three.js)                   │
│                                                                     │
│  ┌──────────┐    ┌───────────────┐    ┌──────────────────────────┐  │
│  │ Game UI  │───▶│ useZKAnswer   │───▶│ prover.worker.ts         │  │
│  │ (React)  │    │ (hook)        │    │                          │  │
│  └──────────┘    └───────┬───────┘    │  1. Noir witness gen     │  │
│                          │            │  2. UltraHonk proof      │  │
│                          │            │  3. Garaga calldata fmt   │  │
│                          │            └──────────┬───────────────┘  │
│                          │                       │                  │
│                          ▼                       ▼                  │
│                 ┌─────────────────────────────────┐                 │
│                 │  Starknet Transaction            │                 │
│                 │  answer_question_with_proof(      │                 │
│                 │    game_id, calldata[...]         │                 │
│                 │  )                                │                 │
│                 └───────────────┬───────────────────┘                │
└─────────────────────────────────┼───────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        STARKNET (Cairo)                              │
│                                                                     │
│  ┌──────────────────────────┐    ┌──────────────────────────────┐   │
│  │  Dojo Game Contract      │───▶│  Garaga Verifier Contract    │   │
│  │  (game_actions.cairo)    │    │  (honk_verifier.cairo)       │   │
│  │                          │    │                              │   │
│  │  - Validates public      │    │  - UltraKeccakZKHonk         │   │
│  │    inputs match game     │    │  - Returns Ok(public_inputs) │   │
│  │    state                 │    │    or Err                    │   │
│  │  - Calls verifier        │    │                              │   │
│  │  - Records answer        │    └──────────────────────────────┘   │
│  │  - Advances turn         │                                       │
│  └──────────────────────────┘                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| ZK Circuit | Noir | 1.0.0-beta.16 |
| Proof System | UltraHonk (Barretenberg) | bb 3.0.0-nightly |
| Proof Format | Garaga | 1.0.1 |
| Hash Function | Poseidon2 (BN254) | via @aztec/bb.js |
| Smart Contracts | Cairo (Dojo Framework) | Cairo 2.13.1, Dojo 1.8.0 |
| Verifier Contract | Cairo (Garaga-generated) | Cairo 2.14.0, Garaga 1.0.1 |
| Frontend | React + TypeScript + Three.js | React 19, Vite 7 |
| Wallet | Cartridge Controller | Latest |
| Indexer | Torii (Dojo) | WASM client |

---

## 2. Section 1 — Noir ZK Circuit

**Location:** `packages/circuits/`

The Noir circuit is the cryptographic heart of WhoisWho. It proves that a player's answer to a yes/no question is correct without revealing which character they chose.

### What the Circuit Proves

Every execution of the circuit enforces four guarantees:

1. **Commitment Binding** — The player committed to *this specific* character and salt before the game started. They can't retroactively change their pick.

2. **Merkle Membership** — The character (with its trait bitmap) exists in the official SCHIZODIO collection. Players can't invent fake characters with convenient trait combinations.

3. **Answer Correctness** — The yes/no answer matches what the bitmap actually says for the question being asked. Players can't lie.

4. **Anti-Replay** — The proof is bound to a specific game, turn, player, and question. A proof from one game can't be reused in another.

### Circuit Inputs

```noir
fn main(
    // PUBLIC INPUTS — visible on-chain, embedded in the transaction
    game_id:      pub Field,   // Which game session
    turn_id:      pub Field,   // Which turn (prevents replay)
    player:       pub Field,   // Starknet address of the answerer
    commitment:   pub Field,   // Poseidon2([game_id, player, character_id, salt])
    question_id:  pub u16,     // Bit index (0-417) in the trait bitmap
    traits_root:  pub Field,   // Merkle root of the official collection

    // PRIVATE INPUTS — never leave the player's device
    character_id: Field,          // Which of the 999 NFTs (0-998)
    salt:         Field,          // Random blinding factor from commit phase
    trait_bitmap: [u128; 4],      // 512-bit packed trait attributes
    merkle_path:  [Field; 10],    // Sibling hashes for Merkle verification
) -> pub u1                        // The answer: 0 = NO, 1 = YES
```

**Public inputs** are visible in the on-chain transaction. The Dojo contract reads them to verify the proof matches the current game state.

**Private inputs** never leave the player's browser. The proof proves statements about them without revealing their values.

### Hash Functions

The circuit uses **Poseidon2** over the **BN254** field. This is critical — Poseidon2 costs ~30 Noir gates per hash, while SHA-256 costs ~30,000. For a depth-10 Merkle tree (10 hashes per verification), this means ~300 gates instead of ~300,000.

Three hash variants are used, all built from the same `poseidon2_permutation` primitive:

```noir
// Hash of 2 elements (Merkle tree internal nodes)
// state = [a, b, 0, 0], permute, return state[0]
fn hash2(a: Field, b: Field) -> Field {
    poseidon2_permutation([a, b, 0, 0], 4)[0]
}

// Hash of 4 elements (commitment)
// Sponge: absorb 3, permute, absorb 1 more, permute, return state[0]
fn hash4(a: Field, b: Field, c: Field, d: Field) -> Field {
    let mid = poseidon2_permutation([a, b, c, 0], 4);
    poseidon2_permutation([mid[0] + d, mid[1], mid[2], mid[3]], 4)[0]
}

// Hash of 5 elements (Merkle leaf)
// Sponge: absorb 3, permute, absorb 2 more, permute, return state[0]
fn hash5(a: Field, b: Field, c: Field, d: Field, e: Field) -> Field {
    let mid = poseidon2_permutation([a, b, c, 0], 4);
    poseidon2_permutation([mid[0] + d, mid[1] + e, mid[2], mid[3]], 4)[0]
}
```

### Constraint 1: Commitment Binding

```noir
let expected_commitment = hash4(game_id, player, character_id, salt);
assert(expected_commitment == commitment);
```

The `commitment` public input was stored on-chain during the commit phase. This constraint proves the player is using the same `character_id` and `salt` they committed to.

### Constraint 2: Merkle Membership

```noir
let leaf = hash5(character_id, trait_bitmap[0] as Field, trait_bitmap[1] as Field,
                 trait_bitmap[2] as Field, trait_bitmap[3] as Field);
let computed_root = merkle::merkle_verify(leaf, character_id, merkle_path);
assert(computed_root == traits_root);
```

The leaf combines the character ID with its 4-limb bitmap. The Merkle path verifies this leaf exists in the official tree (whose root `traits_root` was set at game creation).

**Merkle verification** (`merkle.nr`):

```noir
pub fn merkle_verify(leaf: Field, index: Field, path: [Field; 10]) -> Field {
    let mut current = leaf;
    let index_bits: [u1; 10] = index.to_le_bits();
    for i in 0..10 {
        let sibling = path[i];
        current = if index_bits[i] == 0 {
            hash2(current, sibling)     // current is left child
        } else {
            hash2(sibling, current)     // current is right child
        };
    }
    current
}
```

Depth 10 = 1024 leaves. The real collection has 999 characters; leaves 999-1023 are padding zeros.

### Constraint 3: Answer Correctness

```noir
let limb_idx = (question_id / 128) as u8;
let bit_idx  = (question_id % 128) as u8;
let limb = if limb_idx == 0 { trait_bitmap[0] }
           else if limb_idx == 1 { trait_bitmap[1] }
           else if limb_idx == 2 { trait_bitmap[2] }
           else { trait_bitmap[3] };
let answer_bit = ((limb >> (bit_idx as u128)) & 1) as u1;
```

The trait bitmap is a 512-bit packed bitfield split into 4 `u128` limbs. Each question maps to exactly one bit:
- Question 0 → bit 0 of `limb[0]` (Backwoods Blunt accessory)
- Question 127 → bit 127 of `limb[0]` (Goochi Track Jacket clothing)
- Question 128 → bit 0 of `limb[1]` (Guru Suit clothing)
- Question 417 → bit 33 of `limb[3]` (Why Serious Shooter weapon)

The returned `answer_bit` (0 or 1) becomes a public output of the proof — the on-chain contract reads it to record the answer.

### Trait Bitmap Layout (418 bits)

| Trait Category | Bit Range | Count |
|---------------|-----------|-------|
| Accessories | 0-6 | 7 |
| Background | 7-95 | 89 |
| Body | 96-105 | 10 |
| Clothing | 106-179 | 74 |
| Eyebrows | 180-192 | 13 |
| Eyes | 193-218 | 26 |
| Eyewear | 219-224 | 6 |
| Hair | 225-256 | 32 |
| Headwear | 257-300 | 44 |
| Mask | 301-302 | 2 |
| Mouth | 303-317 | 15 |
| Overlays | 318-350 | 33 |
| Sidekick | 351-395 | 45 |
| Weapons | 396-417 | 22 |
| **Total** | | **418** |

### Tests

```bash
cd packages/circuits
nargo test    # Runs test_permutation_matches_bbjs, test_hash5_deterministic
nargo prove   # Generates proof from Prover.toml witness
```

### Files

| File | Purpose |
|------|---------|
| `src/main.nr` | Circuit entry point — all 3 constraints + hash functions |
| `src/merkle.nr` | `hash2()` and `merkle_verify()` for Merkle path verification |
| `Nargo.toml` | Package manifest (binary type, Noir >=0.1.0) |
| `Prover.toml` | Test witness (generated by `scripts/test-vectors.ts`) |

---

## 3. Section 2 — Dojo Cairo Contracts

**Location:** `packages/contracts/`

The Dojo contracts implement the on-chain game state machine. All game state is stored as Dojo models; all transitions happen through a single system contract (`game_actions`).

### Game Phase Machine

```
WAITING_FOR_PLAYER2 (0)
        │
        │  join_game()
        ▼
   COMMIT_PHASE (1)
        │
        │  commit_character() × 2 (both players)
        ▼
     PLAYING (2)
        │
        │  ┌─── ask_question() ──▶ awaiting_answer = true
        │  │                           │
        │  │    answer_question_with_proof() ──▶ awaiting_answer = false
        │  │                           │              turn flips
        │  └───────────────────────────┘
        │
        │  make_guess()
        ▼
     REVEAL (3)
        │
        │  reveal_character() × 2 (both players)
        ▼
    COMPLETED (4)
```

During `PLAYING`, the `awaiting_answer` flag creates a sub-state machine:
- `false` → active player must `ask_question()` or `make_guess()`
- `true` → other player must `answer_question_with_proof()`

### Data Models

Three Dojo models store all game state:

#### `Game` — Session metadata

```cairo
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: felt252,           // Unique ID (world.uuid())
    pub player1: ContractAddress,   // Creator
    pub player2: ContractAddress,   // Joiner (zero until join_game)
    pub phase: u8,                  // Current phase (0-4)
    pub current_turn: u8,           // 1 = player1's turn, 2 = player2's
    pub turn_count: u16,            // Total turns (also ZK proof nonce)
    pub winner: ContractAddress,    // Zero until game ends
    pub traits_root: u256,          // Poseidon2 BN254 Merkle root
    pub last_question_id: u16,      // For proof validation
    pub awaiting_answer: bool,      // Sub-state during PLAYING
    pub last_action_at: u64,        // For timeout detection
    // ...
}
```

`traits_root` is stored as `u256` (not `felt252`) because Poseidon2 BN254 outputs can exceed the Stark field prime (~16% of the time). The contract never computes hashes — it just stores and compares.

#### `Commitment` — Per-player character commitment

```cairo
#[dojo::model]
pub struct Commitment {
    #[key] pub game_id: felt252,
    #[key] pub player: ContractAddress,
    pub hash: felt252,           // pedersen(character_id, salt) — for reveal phase
    pub zk_commitment: u256,     // Poseidon2 BN254 commitment — for ZK proofs
    pub revealed: bool,
    pub character_id: felt252,   // Filled in after reveal
}
```

Two separate hashes serve different purposes:
- **`hash` (Pedersen, felt252):** Used in the reveal phase. The contract recomputes `pedersen(character_id, salt)` and checks it matches.
- **`zk_commitment` (Poseidon2 BN254, u256):** Used during gameplay. Each ZK proof must reference this exact commitment, binding the proof to the player's character.

#### `Turn` — Immutable action record

```cairo
#[dojo::model]
pub struct Turn {
    #[key] pub game_id: felt252,
    #[key] pub turn_number: u16,
    pub action_type: u8,          // 0 = question, 1 = guess
    pub question_id: u16,
    pub answer: bool,
    pub asked_by: ContractAddress,
    pub answered_by: ContractAddress,
    pub proof_verified: bool,     // true if answered via ZK proof
    // ...
}
```

### Entrypoints (8 total)

| Function | Who calls | Phase | What it does |
|----------|-----------|-------|-------------|
| `create_game(traits_root, question_set_id)` | Player 1 | → WAITING | Creates game, returns `game_id` |
| `join_game(game_id)` | Player 2 | WAITING → COMMIT | Registers P2, advances phase |
| `commit_character(game_id, hash, zk_commitment)` | Both | COMMIT → PLAYING | Stores commitments; auto-advances when both done |
| `ask_question(game_id, question_id)` | Active player | PLAYING | Records question, sets `awaiting_answer` |
| `answer_question_with_proof(game_id, calldata)` | Other player | PLAYING | Verifies ZK proof, records answer, flips turn |
| `make_guess(game_id, character_id)` | Active player | PLAYING → REVEAL | Final guess, triggers reveal phase |
| `reveal_character(game_id, character_id, salt)` | Both | REVEAL → COMPLETED | Verifies commitment, resolves winner |
| `claim_timeout(game_id)` | Non-stalling player | Any → COMPLETED | Wins by timeout (45s inactivity) |

### The `answer_question_with_proof` Flow (Most Complex)

This is where ZK meets the game logic. Here's what happens step by step:

```
1. PARSE calldata
   ├── Extract 7 public inputs from Garaga format:
   │   [count=7, PI0_lo, PI0_hi, PI1_lo, PI1_hi, ..., PI6_lo, PI6_hi, ...proof]
   │   Each PI is a u256 split into two felt252 values (lo + hi * 2^128)
   │
2. ANTI-REPLAY checks
   ├── proof_game_id     == game.game_id
   ├── proof_turn_id     == game.turn_count
   ├── proof_player      == caller address
   ├── proof_question_id == game.last_question_id
   │
3. COLLECTION INTEGRITY
   ├── proof_traits_root == game.traits_root
   │
4. COMMITMENT BINDING
   ├── proof_commitment  == stored commitment.zk_commitment
   │
5. ZK VERIFICATION
   ├── Call Garaga verifier contract
   │   verifier.verify_ultra_keccak_zk_honk_proof(full_proof_with_hints)
   │   └── Returns Ok(public_inputs) or Err
   │
6. STATE UPDATE
   ├── Record answer (PI[6] = answer_bit)
   ├── Flip current_turn (answerer becomes next asker)
   └── Set awaiting_answer = false
```

### Events

Every state change emits a Dojo event that the Torii indexer picks up for real-time UI updates:

| Event | Emitted by | Data |
|-------|-----------|------|
| `GameCreated` | `create_game` | game_id, player1 |
| `PlayerJoined` | `join_game` | game_id, player2 |
| `CharacterCommitted` | `commit_character` | game_id, player |
| `QuestionAsked` | `ask_question` | game_id, turn_number, question_id |
| `QuestionAnsweredVerified` | `answer_question_with_proof` | game_id, computed_answer, proof_verified |
| `GuessMade` | `make_guess` | game_id, character_id |
| `GuessResult` | `reveal_character` | game_id, is_correct |
| `CharacterRevealed` | `reveal_character` | game_id, character_id |
| `GameCompleted` | `reveal_character` / `claim_timeout` | game_id, winner |
| `TimeoutClaimed` | `claim_timeout` | game_id, timed_out_player |

### Error Codes

Every error is a descriptive felt252 constant:

| Code | Meaning |
|------|---------|
| `GAME_NOT_FOUND` | Invalid game_id |
| `INVALID_PHASE` | Action not allowed in current phase |
| `NOT_PLAYER` | Caller is not P1 or P2 |
| `NOT_YOUR_TURN` | Wrong player acting |
| `AWAITING_ANSWER` | Can't ask a new question until current one is answered |
| `PROOF_GAME_ID_MISMATCH` | Proof was generated for a different game |
| `PROOF_TURN_ID_MISMATCH` | Proof was generated for a different turn (replay attack) |
| `ZK_PROOF_FAILED` | Garaga verifier rejected the proof |

### Tests

```bash
cd packages/contracts
sozo test    # Runs 32 tests covering full game flow
```

### Files

| File | Purpose |
|------|---------|
| `src/systems/game_actions.cairo` | All 8 entrypoints + helper functions |
| `src/models/game.cairo` | `Game`, `Commitment`, `Turn` model definitions |
| `src/constants.cairo` | Phase constants, verifier address, timeout config |
| `src/errors.cairo` | All error code constants |
| `src/events.cairo` | All event struct definitions |
| `src/interfaces/game_actions.cairo` | `IGameActions` trait (public ABI) |
| `src/interfaces/verifier.cairo` | `IUltraKeccakZKHonkVerifier` trait (Garaga ABI) |
| `src/lib.cairo` | Module tree |
| `Scarb.toml` | Cairo 2.13.1, Dojo 1.8.0 dependencies |
| `tests/test_game_flow.cairo` | Integration tests |
| `tests/setup.cairo` | Test fixtures |

---

## 4. Section 3 — Garaga Verifier

**Location:** `packages/verifier/`

The Garaga verifier is an **auto-generated Cairo contract** that verifies UltraHonk ZK proofs on Starknet. It's the bridge between the client-side Noir proof and on-chain game logic.

### What is Garaga?

[Garaga](https://github.com/keep-starknet-strange/garaga) is a library for efficient elliptic curve operations in Cairo. Its CLI tool takes a Noir circuit's verification key and generates a complete Cairo verifier contract that can verify proofs for that specific circuit.

### How it was Generated

```bash
# 1. Compile the Noir circuit and generate the verification key
cd packages/circuits
nargo compile
bb write_vk -b target/whoiswho_answer.json -o target/vk.bin

# 2. Generate the Cairo verifier using Garaga
garaga gen \
  --system ultra_keccak_zk_honk \
  --vk target/vk.bin \
  --project-name whoiswho_answer_verifier \
  --output-dir ../verifier
```

This produces a complete Scarb project with three source files.

### Contract Interface

```cairo
#[starknet::interface]
pub trait IUltraKeccakZKHonkVerifier<TContractState> {
    fn verify_ultra_keccak_zk_honk_proof(
        self: @TContractState,
        full_proof_with_hints: Span<felt252>,
    ) -> Result<Span<u256>, felt252>;
}
```

**Input:** A single `Span<felt252>` containing the proof, public inputs, and computation hints (MSM hints, KZG pairing hints). This is the calldata generated by `garaga calldata` or `getZKHonkCallData()` in JavaScript.

**Output:** `Result::Ok(public_inputs)` if the proof is valid, where `public_inputs` is a `Span<u256>` containing the 7 public inputs. `Result::Err('Proof verification failed')` otherwise.

### What the Verifier Checks

The verification process (all auto-generated, not hand-written):

1. **Deserialize** the proof, MSM hints, and KZG pairing hints from the calldata
2. **Reconstruct the transcript** using Keccak (matching the prover's Fiat-Shamir transcript)
3. **Sumcheck verification** — verify the sumcheck polynomial rounds
4. **Evaluation consistency** — verify polynomial evaluations at the challenge point
5. **MSM (Multi-Scalar Multiplication)** — compute the commitment check using 54 scalar multiplications with GLV/fake-GLV optimization
6. **KZG pairing check** — final pairing check using precomputed G2 lines

If all checks pass, the proof is valid and the public inputs are trustworthy.

### Calldata Layout

The Garaga calldata format that the Dojo contract parses:

```
Index 0:     count = 7 (number of public inputs)
Index 1-2:   PI[0] lo/hi  → game_id
Index 3-4:   PI[1] lo/hi  → turn_id
Index 5-6:   PI[2] lo/hi  → player address
Index 7-8:   PI[3] lo/hi  → commitment (u256)
Index 9-10:  PI[4] lo/hi  → question_id
Index 11-12: PI[5] lo/hi  → traits_root (u256)
Index 13-14: PI[6] lo/hi  → answer_bit (0 or 1)
Index 15+:   proof data + MSM hints + KZG hints
```

Each public input is a BN254 field element split into two `felt252` values: `lo = value & ((1<<128)-1)` and `hi = value >> 128`. The contract reconstructs the full value as `lo + hi * 2^128`.

### Verification Key

The verification key (`vk.bin`) is circuit-specific — it encodes the structure of the Noir circuit (number of gates, wire commitments, permutation polynomials). Changing the circuit requires regenerating both the VK and the verifier contract.

The same `vk.bin` is served from the frontend (`public/vk.bin`) for client-side proof generation and is embedded in the verifier contract's constants for on-chain verification.

### Files

| File | Purpose |
|------|---------|
| `src/honk_verifier.cairo` | Main verifier contract (interface + verification logic) |
| `src/honk_verifier_circuits.cairo` | Circuit-specific computation functions (auto-generated) |
| `src/honk_verifier_constants.cairo` | Hardcoded VK data + precomputed pairing lines |
| `src/lib.cairo` | Module exports |
| `Scarb.toml` | Dependencies: Garaga 1.0.1, Cairo 2.14.0, snforge 0.53.0 |
| `tests/test_contract.cairo` | Verifier unit tests |
| `tests/proof_calldata.txt` | Pre-generated proof calldata for testing |

### Build & Test

```bash
cd packages/verifier
scarb build           # Compile the verifier
scarb test            # Run verifier tests (requires snforge)
```

---

## 5. Section 4 — Scripts & Data Pipeline

**Location:** `scripts/`

The scripts form the offline data pipeline that prepares everything the circuit and contracts need. They run on Node.js using the same `@aztec/bb.js` library as the browser, ensuring hash outputs are byte-identical.

### Pipeline Overview

```
                   schizodio-raw.json (999 NFTs with trait attributes)
                          │
                          ▼
               ┌─────────────────────┐
               │ question-schema.ts  │  Maps each trait value to a bit position (0-417)
               │ computeBitmap()     │  Converts attributes → [u128; 4] bitmap
               └──────────┬──────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │ prepare-collection  │  For each of 999 characters:
               │                     │    1. Compute bitmap
               │                     │    2. Compute Merkle leaf = hash5(id, limb0..3)
               │                     │    3. Build Merkle tree (1024 leaves)
               │                     │    4. Extract Merkle paths
               └──────────┬──────────┘
                          │
                          ▼
               ┌─────────────────────┐
               │ schizodio.json      │  999 characters with bitmaps + Merkle proofs
               │ (public/collections)│  Served to the browser for proof generation
               └──────────┬──────────┘
                          │
              ┌───────────┴────────────┐
              ▼                        ▼
    ┌─────────────────┐     ┌─────────────────────┐
    │ test-vectors.ts │     │ Browser Worker       │
    │ → Prover.toml   │     │ (proof generation)   │
    │ (Noir test      │     │                      │
    │  witness)       │     │                      │
    └─────────────────┘     └──────────────────────┘
```

### Script-by-Script Breakdown

#### `config.ts` — Collection Constants

```typescript
export const TOTAL = 999;        // Official SCHIZODIO NFT count
export const TREE_SIZE = 1024;   // Next power of 2 (Merkle tree depth = 10)
```

Changing either value invalidates the deployed `traits_root` and requires regenerating everything.

#### `question-schema.ts` — Bit Index Mapping

Maps each possible trait value to a unique bit position (0-417). This is the **single source of truth** for the question-to-bit mapping.

```typescript
export const QUESTION_SCHEMA: Record<number, { label: string; predicate: (attrs) => boolean }> = {
    0: { label: 'accessories_backwoods_blunt', predicate: (a) => a['Accessories'] === 'Backwoods Blunt' },
    1: { label: 'accessories_god_candle',      predicate: (a) => a['Accessories'] === 'God Candle' },
    // ... 418 entries total
  417: { label: 'weapons_why_serious_shooter', predicate: (a) => a['Weapons'] === 'Why Serious Shooter' },
};
```

The `computeBitmap()` function converts an NFT's attributes into a 4-limb bitmap:

```typescript
export function computeBitmap(attrs: Record<string, string>): [bigint, bigint, bigint, bigint] {
    let bitmap = 0n;
    for (const [bitPos, { predicate }] of Object.entries(QUESTION_SCHEMA)) {
        if (predicate(attrs)) {
            bitmap |= (1n << BigInt(bitPos));
        }
    }
    const MASK = (1n << 128n) - 1n;
    return [
        (bitmap >>   0n) & MASK,   // limb[0]: bits 0-127
        (bitmap >> 128n) & MASK,   // limb[1]: bits 128-255
        (bitmap >> 256n) & MASK,   // limb[2]: bits 256-383
        (bitmap >> 384n) & MASK,   // limb[3]: bits 384-511
    ];
}
```

> **CRITICAL:** Never reorder entries. `question_id` is a direct bit position in the bitmap. Reordering breaks the circuit and invalidates all stored proofs.

#### `merkle.ts` — Poseidon2 Merkle Tree

Implements the same hash functions as the Noir circuit, but in JavaScript using `@aztec/bb.js`:

```typescript
const bb = await BarretenbergSync.new();

function permute(a, b, c, d) {
    const result = bb.poseidon2Permutation({
        inputs: [toBE32(a), toBE32(b), toBE32(c), toBE32(d)],
    });
    return result.outputs.map(v => BigInt('0x' + Buffer.from(v).toString('hex')));
}

function hash2(a, b)          { return permute(a, b, 0n, 0n)[0]; }
function hash4(a, b, c, d)    { /* sponge: absorb 3, perm, absorb 1, perm */ }
function hash5(a, b, c, d, e) { /* sponge: absorb 3, perm, absorb 2, perm */ }
```

**Why `poseidon2Permutation` and not `poseidon2Hash`?** Because `poseidon2Hash` uses a different sponge construction that is NOT accessible in Noir's `std::hash::poseidon2_permutation`. Using the raw permutation ensures byte-identical outputs between JavaScript and Noir.

Exported functions:
- `computeLeaf(characterId, bitmap)` → Merkle leaf hash
- `computeCommitment(gameId, player, characterId, salt)` → ZK commitment
- `buildMerkleTree(leaves, treeSize)` → Complete Merkle tree with path extraction
- `verifyPath(leaf, index, siblings, isLeft, expectedRoot)` → Path verification

#### `prepare-collection.ts` — Build the Dataset

Reads `scripts/data/schizodio-raw.json` (999 NFTs), computes bitmaps and Merkle proofs, and outputs `public/collections/schizodio.json`.

```bash
npx tsx scripts/prepare-collection.ts          # Quick (spot-checks 4 paths)
npx tsx scripts/prepare-collection.ts --verify  # Full (verifies all 999 paths)
```

Output format:
```json
{
  "total": 999,
  "tree_size": 1024,
  "tree_depth": 10,
  "traits_root": "0x296f3664...",
  "characters": [
    {
      "id": 0,
      "name": "Schizodio #1",
      "image_url": "ipfs://...",
      "bitmap": ["0x...", "0x...", "0x...", "0x..."],
      "merkle_path": ["0x...", "0x...", ...],
      "merkle_path_is_left": [true, false, ...]
    }
  ]
}
```

This file is served to the browser and loaded by the Web Worker during proof generation.

#### `test-vectors.ts` — Generate Circuit Test Witness

Creates `packages/circuits/Prover.toml` with reproducible test inputs:

```bash
npx tsx scripts/test-vectors.ts
# Writes Prover.toml with:
#   character_id = 42 (Schizodio #42)
#   question_id = 104 (body_snowflake)
#   game_id, turn_id, player, salt = fixed constants
#   commitment = computed via computeCommitment()
```

After this, `nargo prove` in `packages/circuits/` generates a real proof.

#### `deploy-local.sh` — Local Deployment to Katana

Automated 6-step deployment:

```bash
bash scripts/deploy-local.sh
```

| Step | Action |
|------|--------|
| 1 | Import Katana dev account into sncast |
| 2 | Build verifier with `scarb build` |
| 3 | Declare verifier class on Katana |
| 4 | Deploy verifier via UDC (Universal Deployer Contract) |
| 5 | Update `VERIFIER_ADDRESS_SEPOLIA` in `constants.cairo` |
| 6 | Build & migrate Dojo world with `sozo` |

Outputs `.deploy-local.env` with all deployed addresses.

> **Note:** The script uses direct UDC invocation instead of `sncast deploy` because sncast 0.51 expects a non-standard UDC address that Katana doesn't have.

#### `test-verifier-local.sh` — Standalone Verifier Test

Calls the deployed verifier directly with pre-generated proof calldata:

```bash
bash scripts/test-verifier-local.sh
```

Uses `packages/verifier/tests/proof_calldata.txt` to verify the deployed verifier works before running the full game flow.

### Files

| File | Purpose |
|------|---------|
| `config.ts` | `TOTAL=999`, `TREE_SIZE=1024` |
| `question-schema.ts` | 418-entry bit index mapping + `computeBitmap()` |
| `merkle.ts` | Poseidon2 Merkle tree (hash2/hash4/hash5, build, verify) |
| `prepare-collection.ts` | Build `schizodio.json` from raw NFT data |
| `test-vectors.ts` | Generate `Prover.toml` test witness |
| `deploy-local.sh` | Deploy verifier + Dojo world to local Katana |
| `deploy-sepolia.sh` | Deploy to Starknet Sepolia testnet |
| `test-verifier-local.sh` | Standalone verifier smoke test |
| `data/schizodio-raw.json` | Raw NFT metadata (999 entries) |

---

## 6. Client-Side Proof Generation

**Location:** `src/workers/prover.worker.ts`, `src/hooks/useZKAnswer.ts`, `src/starknet/collectionData.ts`, `src/starknet/commitReveal.ts`

This is where the same proof that exists in the Garaga verifier is **regenerated live in the player's browser**. The client runs the exact same cryptographic pipeline as the scripts — same hashes, same circuit, same proof format — but inside a Web Worker to keep the UI responsive.

### The Key Insight

The proof pipeline exists in three places, and they MUST produce identical results:

| Location | Language | Purpose |
|----------|----------|---------|
| `packages/circuits/` | Noir | Defines the constraints (what is being proved) |
| `scripts/merkle.ts` | TypeScript (Node.js) | Offline data prep (builds Merkle tree, test vectors) |
| `src/workers/prover.worker.ts` | TypeScript (Browser) | Live proof generation during gameplay |

All three use the same hash function (`poseidon2_permutation`) from the same library (`@aztec/bb.js` / Barretenberg). The browser Worker uses the WASM build of Barretenberg, while the scripts use the native build — but the math is identical.

### Proof Generation Pipeline (Browser)

When a player needs to answer a question, the `useZKAnswer` hook triggers this pipeline:

```
┌─────────────────────────────────────────────────────────────────┐
│                    useZKAnswer.ts (React Hook)                   │
│                                                                  │
│  1. Load schizodio.json (cached after first load)                │
│  2. Look up character's bitmap + Merkle path                     │
│  3. Build ProveRequest message                                   │
│  4. Post message to Web Worker                                   │
│  5. Wait for ProveResult                                         │
│  6. Submit on-chain transaction                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │ Worker.postMessage(ProveRequest)
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                  prover.worker.ts (Web Worker)                   │
│                                                                  │
│  Step 1: INIT (one-time, ~2s)                                    │
│  ├── Load Garaga WASM: garagaInit()                              │
│  ├── Create Noir instance: new Noir(circuit)                     │
│  ├── Create backend: new UltraHonkBackend(circuit.bytecode)      │
│  └── Fetch verification key: fetch('/vk.bin')                    │
│                                                                  │
│  Step 2: WITNESS GENERATION (~1s)                                │
│  ├── noir.execute({                                              │
│  │     game_id, turn_id, player, commitment,                     │
│  │     question_id, traits_root,   // public                     │
│  │     character_id, salt,         // private                    │
│  │     trait_bitmap, merkle_path   // private                    │
│  │   })                                                          │
│  └── Returns: witness (serialized constraint assignments)        │
│                                                                  │
│  Step 3: PROOF GENERATION (~5-30s on mobile, ~2-5s desktop)      │
│  ├── backend.generateProof(witness, { keccakZK: true })          │
│  └── Returns: { proof: Uint8Array, publicInputs: string[] }      │
│                                                                  │
│  Step 4: GARAGA CALLDATA FORMATTING (~100ms)                     │
│  ├── Convert publicInputs to flat bytes                          │
│  ├── getZKHonkCallData(proof, piBytes, vk)                       │
│  ├── Strip Garaga's length prefix (Starknet Span has its own)    │
│  └── Returns: string[] (felt252 values for the transaction)      │
│                                                                  │
│  Output: { proofCalldata: string[], answerBit: number }          │
└─────────────────────────────────────────────────────────────────┘
```

### Step-by-Step Code Walkthrough

#### 1. Data Loading (`collectionData.ts`)

Before generating a proof, the hook loads the pre-computed collection data:

```typescript
const dataset = await loadCollectionData();             // Fetches schizodio.json (cached)
const bitmap = getCharacterBitmap(dataset, characterId); // [u128;4] as hex strings
const merkle_path = getCharacterMerklePath(dataset, characterId); // 10 sibling hashes
```

This data was pre-computed by `scripts/prepare-collection.ts`. The browser doesn't rebuild the Merkle tree — it just looks up the pre-computed path.

#### 2. Worker Message (`useZKAnswer.ts`)

The hook constructs a `ProveRequest` and sends it to the Worker:

```typescript
const req: ProveRequest = {
    type: 'prove',
    id: crypto.randomUUID(),
    // Public inputs (will appear in the transaction)
    game_id: toDecimalField(opts.gameId),
    turn_id: toDecimalField(opts.turnId),
    player: toDecimalField(String(account.address)),
    commitment: toDecimalField(opts.commitment),
    question_id: opts.questionId,
    traits_root: toDecimalField(TRAITS_ROOT),
    // Private inputs (never leave the browser)
    character_id: opts.characterId,
    salt: toDecimalField(opts.salt),
    bitmap,
    merkle_path,
};
worker.postMessage(req);
```

#### 3. Witness Generation (`prover.worker.ts`)

The Noir runtime evaluates the circuit with the given inputs, producing a "witness" — the assignment of every internal wire in the circuit:

```typescript
const { witness } = await noir.execute({
    game_id: toDecimalField(e.data.game_id),
    turn_id: toDecimalField(e.data.turn_id),
    // ... all 10 inputs
});
```

If any constraint is violated (wrong commitment, invalid Merkle path, etc.), `execute()` throws an error and no proof is generated.

#### 4. Proof Generation (`prover.worker.ts`)

The UltraHonk backend produces the ZK proof:

```typescript
const proofData = await backend.generateProof(witness, { keccakZK: true });
// proofData.proof: Uint8Array (the cryptographic proof)
// proofData.publicInputs: string[] (the 7 public inputs as decimal strings)
```

The `keccakZK: true` flag selects UltraKeccakZKHonk — the proof system that matches the Garaga verifier contract.

#### 5. Garaga Calldata Formatting (`prover.worker.ts`)

The proof must be formatted for the Garaga verifier's expected calldata layout:

```typescript
// Convert public inputs to flat bytes (32 bytes each)
const piBytes = flattenFieldsAsArray(proofData.publicInputs);

// Generate Garaga calldata (proof + hints + public inputs)
const calldataWithPrefix = getZKHonkCallData(proofData.proof, piBytes, vk);

// Strip Garaga's own length prefix — Starknet Span already carries length
const calldata = calldataWithPrefix.slice(1);
```

The `getZKHonkCallData` function (from the `garaga` npm package) does three things:
1. Serializes the proof into felt252 values
2. Computes MSM (Multi-Scalar Multiplication) hints
3. Computes KZG pairing hints
4. Prepends a count of public inputs followed by their lo/hi pairs

#### 6. On-Chain Submission (`useZKAnswer.ts`)

The calldata is submitted as a Starknet transaction:

```typescript
const tx = await account.execute([{
    contractAddress: GAME_CONTRACT,
    entrypoint: 'answer_question_with_proof',
    calldata: [
        toFeltHex(opts.gameId),
        String(result.proofCalldata.length),    // Span length
        ...result.proofCalldata,                 // Proof + hints
    ],
}]);
await account.waitForTransaction(tx.transaction_hash);
```

### Commitment Generation (`commitReveal.ts`)

During the commit phase, the client generates TWO commitments using the same `@aztec/bb.js` library:

```typescript
// 1. Pedersen commitment (for reveal phase — felt252, matches Cairo's pedersen())
const commitment = hash.computePedersenHash(characterIdFelt, salt);

// 2. Poseidon2 BN254 commitment (for ZK proofs — u256)
// Matches the circuit's hash4(game_id, player, character_id, salt)
const mid = bb.poseidon2Permutation({
    inputs: [toBE32(gameId), toBE32(player), toBE32(characterId), ZERO_32],
});
const result = bb.poseidon2Permutation({
    inputs: [add32(mid.outputs[0], toBE32(salt)), mid.outputs[1], mid.outputs[2], mid.outputs[3]],
});
const zkCommitment = fromBE32(result.outputs[0]);
```

Both are submitted on-chain via `commit_character(game_id, commitment, zkCommitment)`.

### Worker Lifecycle

The Worker is a **singleton** — creating a new one per proof would waste ~2s re-loading the 3.5MB WASM binary:

```typescript
let globalWorker: Worker | null = null;

function getOrCreateWorker(): Worker {
    if (!globalWorker) {
        globalWorker = new Worker(
            new URL('../workers/prover.worker.ts', import.meta.url),
            { type: 'module' },
        );
    }
    return globalWorker;
}

// Pre-warm during character select (before proof is needed)
export function prewarmProver(): void { getOrCreateWorker(); }

// Clean up when leaving the game
export function terminateProver(): void {
    if (globalWorker) { globalWorker.terminate(); globalWorker = null; }
}
```

### UI Phases During Proof Generation

The hook manages three UI phases via Zustand:

```
PROVING      →  Worker is generating the proof (5-30s)
SUBMITTING   →  Transaction sent, waiting for confirmation
VERIFIED     →  Contract accepted the proof, answer recorded
```

If proof generation or submission fails, `setProofError(msg)` stores the error for the UI to display with a retry option.

---

## 7. How Everything Connects

### The Full Lifecycle of a Question

Here's what happens from the moment Player 1 asks "Does your character have a Fedora Hat?" to the answer appearing on both screens:

```
Player 1 (Asker)                    Starknet                     Player 2 (Answerer)
─────────────────                   ────────                     ──────────────────

1. Picks question #263
   (headwear_fedora_hat)
        │
        ▼
2. askQuestionOnChain(gameId, 263)
        │
        ├──────────────────────▶ 3. ask_question()
        │                          - Validates phase & turn
        │                          - Sets awaiting_answer=true
        │                          - Emits QuestionAsked
        │                          - Records Turn
        │                                │
        │                                │ Torii subscription
        │                                ▼
        │                       4. useToriiGameSync detects
        │                          QuestionAsked event
        │                                │
        │                                ├──────────────────▶ 5. UI shows AnswerPanel
        │                                                       "Does your character
        │                                                        have a Fedora Hat?"
        │                                                           │
        │                                                    6. generateAndSubmitProof()
        │                                                       ├── Load schizodio.json
        │                                                       ├── Get bitmap[characterId]
        │                                                       ├── Get merkle_path[characterId]
        │                                                       │
        │                                                    7. Worker: Noir witness gen
        │                                                       ├── hash4(game,player,char,salt)
        │                                                       │   == stored commitment? ✓
        │                                                       ├── hash5(char,limb0..3)
        │                                                       │   → Merkle verify → root? ✓
        │                                                       ├── bitmap[263/128][263%128]
        │                                                       │   → answer_bit = 0 (NO)
        │                                                       │
        │                                                    8. Worker: UltraHonk proof (~5s)
        │                                                       │
        │                                                    9. Worker: Garaga calldata
        │                                                       │
        │                                                   10. Submit tx:
        │                                                       answer_question_with_proof(
        │                       ◀──────────────────────────────   gameId, calldata
        │                                                       )
        │                      11. answer_question_with_proof()
        │                          - Parse 7 public inputs
        │                          - Verify game_id, turn, player
        │                          - Verify commitment matches
        │                          - Verify traits_root matches
        │                          - Call Garaga verifier → Ok ✓
        │                          - Read answer_bit = 0 (NO)
        │                          - Record Turn.answer = false
        │                          - Flip turn → Player 2 asks next
        │                          - Emit QuestionAnsweredVerified
        │                                │
        │                                │ Torii subscription
        │                                ▼
12. useToriiGameSync          13. useToriiGameSync
    detects answer                 detects turn flip
    │                              │
    ▼                              ▼
14. UI shows:                 15. UI shows:
    "NO — does not have           QuestionPanel
     a Fedora Hat"                (Player 2's turn to ask)
```

### Hash Function Consistency Map

The same hash produces the same output across all three environments:

```
              hash2(a, b)              hash4(a, b, c, d)          hash5(a, b, c, d, e)
              ───────────              ─────────────────          ─────────────────────
Noir:         poseidon2_permutation    poseidon2_permutation      poseidon2_permutation
              ([a,b,0,0], 4)[0]       (sponge rate=3)            (sponge rate=3)

scripts/      bb.poseidon2Permutation  bb.poseidon2Permutation    bb.poseidon2Permutation
merkle.ts:    ([a,b,0,0]).outputs[0]   (sponge rate=3)            (sponge rate=3)

browser/      (same as scripts —       (same as scripts —         (same as scripts —
worker:        @aztec/bb.js WASM)       @aztec/bb.js WASM)         @aztec/bb.js WASM)

Garaga:       (verifies proof, does    (verifies proof, does      (verifies proof, does
               not recompute hashes)    not recompute hashes)      not recompute hashes)
```

### Data Flow Map

```
schizodio-raw.json
    │
    │ scripts/prepare-collection.ts
    ▼
schizodio.json ─────────────────────────┬──────────────────────────────────┐
    │                                    │                                  │
    │ scripts/test-vectors.ts            │ src/starknet/collectionData.ts   │
    ▼                                    ▼                                  │
Prover.toml ──▶ nargo prove        Browser Worker                         │
    │              │                    │                                   │
    │              ▼                    ▼                                   │
    │         proof binary         proof binary                            │
    │              │                    │                                   │
    │         bb write_vk          Garaga calldata                         │
    │              │                    │                                   │
    │              ▼                    ▼                                   │
    │           vk.bin ──────▶   Starknet tx ──▶ Dojo contract             │
    │              │                                │                      │
    │         garaga gen                            │                      │
    │              │                                ▼                      │
    │              ▼                          Garaga verifier              │
    │    packages/verifier/                   (honk_verifier.cairo)        │
    │    (auto-generated)                           │                      │
    │                                               ▼                      │
    │                                     Ok(public_inputs)                │
    │                                          or Err                      │
    └──────────────────────────────────────────────────────────────────────┘
```

### BN254 vs Stark Field Compatibility

Poseidon2 operates over the BN254 field (prime ≈ 2^254). The Stark field prime is ≈ 2^252. This means ~16% of hash outputs don't fit in a `felt252`.

**Solution:** Starknet never recomputes hashes. All BN254 values are stored and compared as `u256`. The Garaga verifier extracts public inputs as `Span<u256>`. The Dojo contract compares `u256 == u256`.

| System | Hash Type | Storage Type |
|--------|-----------|-------------|
| ZK commitment (BN254) | Poseidon2 | `u256` in `Commitment.zk_commitment` |
| Merkle root (BN254) | Poseidon2 | `u256` in `Game.traits_root` |
| Commit-reveal (Stark) | Pedersen | `felt252` in `Commitment.hash` |

---

*This document covers the complete technical architecture of WhoisWho's ZK proof pipeline. For setup instructions, see [DEV-GUIDE.md](./DEV-GUIDE.md). For the circuit explanation in Spanish, see [CIRCUITO-NOIR-EXPLICADO.md](./CIRCUITO-NOIR-EXPLICADO.md).*
