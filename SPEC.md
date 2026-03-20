# guessNFT — Technical Specification

> Last updated: 2026-03-20  
> Branch: `ui-ux-vibe-fresh`  
> Stack: React 19 + TypeScript + Three.js + Supabase + Starknet

---

## What Is This?

A browser-based 1v1 deduction game — "Guess Who?" for Starknet NFT collections. Players secretly pick a character from a shared board, ask yes/no questions to eliminate options, and race to guess the opponent's pick first.

**Three modes:**
- **Local** — Pass-and-play (same device)
- **vs CPU** — AI opponent with binary-search strategy
- **Online** — Real-time multiplayer via Supabase Realtime

**Anti-cheat:** Pedersen hash commit-reveal ensures neither player can switch their character mid-game.

---

## Current State

### ✅ Working

| Feature | Status | Notes |
|---------|--------|-------|
| Controller login | ✅ Done | Cartridge Controller |
| NFT ownership verification | ✅ Done | ERC-721 + metadata fetch |
| NFT art on boards | ✅ Done | 999 MinimalGrid tokens with atlas |
| Client-side commit | ✅ Done | Pedersen hash in localStorage + Supabase |
| Game state machine | ✅ Done | Full GamePhase enum wired |
| 3D board (Three.js) | ✅ Done | CharacterGrid with LOD |
| Procedural portraits | ✅ Done | Canvas 2D generation |
| Pass-and-play mode | ✅ Done | Local hot-seat |
| CPU opponent | ✅ Done | Binary search strategy |
| Audio SFX | ✅ Done | Web Audio API |

### ⚠️ Partial / Broken

| Feature | Status | Notes |
|---------|--------|-------|
| Room persistence | ⚠️ Partial | Session recovery (1hr TTL), but no full game state replay |
| Turn sync | ❌ Broken | `turn_number` and `active_player_num` never written to DB |
| Event deduplication | ❌ None | No idempotency keys, duplicates possible |
| On-chain commit | ⚠️ Stub | `submitCommitmentOnChain()` calls contract that exists but has unverified hash logic |
| On-chain reveal | ⚠️ Stub | `revealCharacterOnChain()` same — Cairo contract has TODO |
| Answer verification | ⚠️ None | Opponent evaluates questions client-side — can lie freely |
| Replay state on rejoin | ❌ Missing | Can't resume full game state from DB |
| Simultaneous play | ❌ Broken | Design intent but never implemented |

---

## Architecture

### Game Phase State Machine

```
┌─────────────────────────────────────────────────────────────┐
│                        MENU                                   │
│              (Local | vs CPU | Online)                       │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   SETUP_P1 / SETUP_P2                       │
│            (Character selection for each player)            │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                      HANDOFF_START                           │
│           (Both committed — game begins)                     │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   QUESTION_SELECT                            │
│           (Active player picks a question)                   │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   ANSWER_PENDING                             │
│           (Waiting for opponent to answer)                   │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   ANSWER_REVEALED                            │
│              (Answer shown, chars eliminated)                │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   AUTO_ELIMINATING                          │
│            (Board updates with animation)                     │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   TURN_TRANSITION                            │
│              (Switch active player)                          │
└─────────────────────────┬───────────────────────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                   GUESS_SELECT                               │
│        (Player can guess or keep asking)                     │
└─────────────────────────┬───────────────────────────────────┘
              ┌───────────┴───────────┐
              ▼                       ▼
┌─────────────────────┐   ┌─────────────────────┐
│    GUESS_WRONG      │   │   GUESS_RESULT      │
│ (Lose turn, loop)   │   │  (WINNER declared) │
└─────────────────────┘   └─────────────────────┘
```

**Online adds:** `ONLINE_WAITING`, `HANDOFF_TO_OPPONENT`

---

## The Three-Layer Roadmap

### Layer 1: Solid Online Gameplay Loop 🔴 PRIORITY

> *Making turns sync correctly, events are idempotent, state persists and recovers.*

#### Problems

1. **Turn tracking never written to DB**
   - `turn_number` and `active_player_num` are in DB schema but never updated
   - Client-side only — no server authority

2. **No event deduplication**
   - Supabase events can fire multiple times
   - No idempotency keys
   - Events processed twice, corrupting state

3. **No shared elimination state**
   - Each client tracks their own eliminated chars
   - No sync of what the other player eliminated

4. **No full game state recovery on rejoin**
   - Session recovers but not full board state
   - Can't resume mid-game properly

5. **No timeouts**
   - Idle players can block forever
   - No turn timer

#### Fixes Required

```typescript
// 1. Write turn_number on every move
supabase.rpc('update_turn', {
  p_room_id: roomId,
  p_turn_number: currentTurn + 1,
  p_active_player: nextPlayer
});

// 2. Add idempotency keys
interface GameEvent {
  id: string;           // UUID v4
  idempotency_key: string;  // Client generates this
  event_type: string;
  payload: object;
}

// 3. Server-side dedup
ON CONFLICT (idempotency_key) DO NOTHING;

// 4. Shared elimination state
// Each question answer broadcasts new eliminatedIds
// All clients converge to same state

// 5. Turn timeout (optional for v1)
p_turn_deadline: timestamp;  // Auto-forfeit if exceeded
```

#### Deliverables

- [ ] Turn tracking fully wired to Supabase
- [ ] Event idempotency keys implemented
- [ ] Shared elimination state broadcasts
- [ ] Full game state recovery on rejoin
- [ ] Event deduplication on server-side

---

### Layer 2: On-Chain Commit-Reveal 🟡 SECOND

> *Deploy Cairo contract, wire up real commit/reveal, post-game verification.*

#### Problems

1. **Cairo contract has TODO stubs**
   - Hash verification logic not implemented
   - `GAME_CONTRACT = '0x0'` placeholder

2. **Answer verification is client-side**
   - Opponent can lie about answers
   - No on-chain verification

3. **RLS is wide open**
   - Supabase RLS: `for all using (true)`
   - Anyone can read/write any game row

#### Fixes Required

```cairo
// contracts/src/game.cairo

// Submit commitment before game starts
@external
func submit_commitment{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr,
}(character_id: felt, commitment_hash: felt) {
    // Store pedersen(character_id, salt) on-chain
    // Emit commitment event
}

// Reveal after game ends
@external
func reveal_character{
    syscall_ptr: felt*,
    pedersen_ptr: HashBuiltin*,
    range_check_ptr,
}(character_id: felt, salt: felt) {
    // Verify pedersen(character_id, salt) == commitment_hash
    // Store revealed character
}
```

#### Deliverables

- [ ] Deploy Cairo game contract
- [ ] Wire `submitCommitmentOnChain()` with real hash
- [ ] Wire `revealCharacterOnChain()` with verification
- [ ] Lock commitment after game starts
- [ ] Supabase RLS rules tightened

---

### Layer 3: Trait Answer Verification 🟢 FINAL

> *After reveal, replay all questions against revealed character on-chain or client-side.*

#### Problems

1. **Players can lie about answers**
   - No verification that questions were answered truthfully
   - Game integrity relies on trust

2. **No audit trail**
   - Can't replay game history
   - Disputes can't be resolved

#### Fixes Required

```typescript
// After both characters revealed:
// 1. Fetch all Q&A events from DB
// 2. For each question, verify answer matches revealed character
// 3. If mismatch → flag potential cheating

interface QuestionAnswer {
  question_id: string;
  asked_by: 'player1' | 'player2';
  character_revealed: string;
  answer_given: boolean;  // true/false
  answer_correct: boolean; // computed from revealed char
}

// Verification result
interface VerificationResult {
  fair_play_score: number; // 0-100%
  mismatches: QuestionAnswer[];
}
```

#### Deliverables

- [ ] Fetch full Q&A history on reveal
- [ ] Replay against revealed character
- [ ] Display fair play score in results
- [ ] Flag mismatches as potential cheating
- [ ] On-chain verification (if Layer 2 contract supports)

---

## Database Schema (Supabase)

```sql
-- Rooms
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  player1_wallet TEXT,
  player2_wallet TEXT,
  status TEXT DEFAULT 'waiting', -- waiting | playing | finished
  winner TEXT,
  game_data JSONB DEFAULT '{}'
);

-- Game state (single row per room)
CREATE TABLE game_state (
  room_id UUID PRIMARY KEY REFERENCES rooms(id),
  turn_number INT DEFAULT 0,
  active_player_num INT DEFAULT 1, -- 1 or 2
  player1_character_id TEXT,
  player2_character_id TEXT,
  player1_commitment TEXT,
  player2_commitment TEXT,
  player1_eliminated_ids TEXT[], -- shared elimination state
  player2_eliminated_ids TEXT[],
  turn_deadline TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Events (append-only)
CREATE TABLE game_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id),
  idempotency_key TEXT UNIQUE, -- Client-generated, prevents dupes
  event_type TEXT NOT NULL,
  payload JSONB,
  player_num INT, -- 1 or 2, who sent it
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for dedup
CREATE UNIQUE INDEX idx_events_idempotency ON game_events(room_id, idempotency_key);

-- RLS (TODO: tighten before mainnet)
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can manage their games" ON rooms
  FOR ALL USING (
    player1_wallet = auth.uid() OR
    player2_wallet = auth.uid()
  );
```

---

## Online Multiplayer Flow

```
┌─────────────────────────────────────────────────────────────┐
│                       JOIN FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Player A creates room                                       │
│      ↓                                                      │
│  Supabase: insert room (player1_wallet = A)                 │
│      ↓                                                      │
│  Player B joins room                                        │
│      ↓                                                      │
│  Supabase: update room (player2_wallet = B)                │
│      ↓                                                      │
│  Both players subscribe to room channel                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       GAME FLOW                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  P1 selects character                                        │
│      ↓                                                      │
│  P1 commits (pedersen hash)                                 │
│      ↓                                                      │
│  P2 selects character                                        │
│      ↓                                                      │
│  P2 commits                                                 │
│      ↓                                                      │
│  Supabase: both commitments stored                          │
│      ↓                                                      │
│  Game begins — first question                               │
│      ↓                                                      │
│  P1 sends question event                                    │
│  Supabase: INSERT game_event (idempotency_key = uuid)      │
│      ↓                                                      │
│  P2 receives event, sends answer event                      │
│  Supabase: INSERT game_event                                │
│      ↓                                                      │
│  P1 receives event, board updates, turn switches             │
│  Supabase: UPDATE game_state (turn_number++, active_player_num = 2)│
│      ↓                                                      │
│  Repeat until guess                                         │
│      ↓                                                      │
│  Both reveal on-chain or client-side                        │
│      ↓                                                      │
│  Winner declared                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Commit-Reveal Protocol

```
PHASE 1: Commit (Before Game Starts)
─────────────────────────────────────
1. Player selects character ID (e.g., "vitalik_001")
2. Generate random salt (e.g., "0x4a5b6c...")
3. Compute: commitment = PedersenHash(character_id, salt)
4. Store commitment in Supabase + localStorage
5. Both players must commit before game starts

PHASE 2: Play (During Game)
─────────────────────────────────────
- Game plays out with questions/answers
- No reveal yet — character stays hidden

PHASE 3: Reveal (After Game Ends)
─────────────────────────────────────
1. Winner reveals: send character_id + salt to contract
2. Contract verifies: PedersenHash(character_id, salt) == commitment
3. If valid → winner confirmed
4. If invalid → dispute (player cheated)

CAIRO CONTRACT INTERFACE
─────────────────────────────────────
submit_commitment(commitment_hash: felt)
  → Stores hash, emits event

reveal_character(character_id: felt, salt: felt)
  → Verifies hash matches stored commitment
  → Returns true/false
```

---

## Environment Variables

```bash
# Supabase
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Starknet
VITE_STARKNET_RPC_URL=https://api.cartridge.gg/goerli/rpc/v0_7
VITE_GAME_CONTRACT=0x0  # TODO: deploy
```

---

## Key Files

| File | Purpose |
|------|---------|
| `src/core/store/gameStore.ts` | Zustand store, all state mutations |
| `src/core/store/types.ts` | GamePhase enum, type definitions |
| `src/services/supabase/client.ts` | Supabase client setup |
| `src/services/supabase/gameService.ts` | Room CRUD, event persistence |
| `src/shared/hooks/useOnlineGameSync.ts` | Realtime → Store bridge |
| `src/services/starknet/commitReveal.ts` | Pedersen commit/reveal logic |
| `src/services/starknet/config.ts` | Contract addresses, RPC |

---

## Dependencies

```json
{
  "react": "^19.0.0",
  "@react-three/fiber": "^9.0.0",
  "@react-three/drei": "^10.0.0",
  "three": "^0.183.0",
  "zustand": "^5.0.0",
  "framer-motion": "^12.0.0",
  "@supabase/supabase-js": "^2.0.0",
  "starknet": "^6.0.0",
  "typescript": "^5.9.0",
  "vite": "^7.0.0"
}
```

---

## Testing Checklist

### Layer 1 Tests
- [ ] Two players can join same room
- [ ] Turn switches correctly after each action
- [ ] Events don't duplicate on reconnect
- [ ] Game state recovers on page refresh
- [ ] Eliminated characters sync between players
- [ ] Rejoin replays full game state

### Layer 2 Tests
- [ ] Commitment stored on-chain
- [ ] Reveal verifies hash correctly
- [ ] Wrong salt → reveal fails
- [ ] Late reveal → rejected

### Layer 3 Tests
- [ ] Q&A history fetches correctly
- [ ] Answers verified against revealed character
- [ ] Fair play score displays
- [ ] Mismatches flagged

---

## TODO by Priority

### Critical (Block L1)
- [ ] Fix turn_number/active_player_num DB writes
- [ ] Add idempotency keys to events
- [ ] Implement server-side dedup
- [ ] Broadcast shared elimination state
- [ ] Full state recovery on rejoin

### High (Block L2)
- [ ] Deploy Cairo contract
- [ ] Wire real commit/reveal calls
- [ ] Tighten Supabase RLS

### Medium (Block L3)
- [ ] Fetch Q&A history
- [ ] Replay verification
- [ ] Display fair play score

### Nice to Have
- [ ] Turn timeout system
- [ ] Spectator mode
- [ ] Matchmaking queue
- [ ] Leaderboard

---

*This spec is the source of truth. Update before making significant changes.*
