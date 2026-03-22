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
| Room persistence | ✅ Done (Beta) | Session recovery (1hr TTL) + full game state replay |
| Turn sync | ✅ Done (Beta) | `turn_number` and `active_player_num` written to DB on every turn |
| Event deduplication | ✅ Done (Beta) | Idempotency keys on all events, client-side dedup Set |
| Shared elimination state | ✅ Done (Beta) | ELIMINATION_UPDATE broadcast after each question |
| On-chain commit | ✅ Done (Beta) | CommitReveal contract deployed on mainnet, auto-commit on select |
| On-chain reveal | ✅ Done (Beta) | Auto-reveal on result screen, Pedersen verification on-chain |
| Answer verification | ⚠️ None | Opponent evaluates questions client-side — can lie freely |
| Full state recovery | ✅ Done (Beta) | Replay past events to rebuild board state on rejoin |
| Simultaneous play | ⚠️ Partial | Each player runs independently, no round gate yet |

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

### Layer 1: Solid Online Gameplay Loop ✅ COMPLETE

> *Turns sync correctly, events are idempotent, state persists and recovers.*

#### Delivered (commits ae32993, 4080016)

1. **Turn tracking wired to DB** — `turn_number` and `active_player_num` written via `updateTurn()` on every turn switch
2. **Event deduplication** — `idempotency_key` on all events, `processedEventIds` Set on client, `ON CONFLICT DO NOTHING` on server
3. **Shared elimination state** — `ELIMINATION_UPDATE` broadcast after each question answer, opponent merges into their board
4. **Full state recovery on rejoin** — `getPastEvents()` replays question history, elimination state, and turn number
5. **Disconnect detection** — Supabase Presence heartbeat with 45s timeout, "Opponent disconnected" overlay
6. **Simultaneous guess tiebreaker** — Timestamp comparison prevents inconsistent winners

#### Remaining (Layer 1 stretch)

- [ ] Turn timeout / auto-forfeit (nice-to-have)
- [ ] Round-based gating (currently free-form simultaneous play)

---

### Layer 2: On-Chain Commit-Reveal ✅ COMPLETE

> *Minimal CommitReveal contract deployed on Starknet Mainnet.*

#### Delivered (commit 529ba6a)

1. **CommitReveal contract deployed** — `0x077cbfa4dab07b9bd3e167b37ec2066683caeb9a267f72ec744f73b3c8d48b21`
2. **`commit(game_id, commitment)`** — Stores Pedersen hash on-chain at game start
3. **`reveal(game_id, character_id, salt)`** — Verifies hash on-chain at game end, reverts if tampered
4. **Frontend wired** — Auto-commit on character select, auto-reveal on result screen
5. **Session policies updated** — Cartridge Controller policies match commit/reveal entrypoints

#### Remaining

- [ ] Supabase RLS tightening (currently wide open)
- [ ] Wager/deposit contract (Phase 3, separate contract)

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

### Critical (Block L1) — ✅ DONE
- [x] Fix turn_number/active_player_num DB writes
- [x] Add idempotency keys to events
- [x] Implement server-side dedup
- [x] Broadcast shared elimination state
- [x] Full state recovery on rejoin

### High (Block L2) — ✅ DONE
- [x] Deploy Cairo contract
- [x] Wire real commit/reveal calls
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
