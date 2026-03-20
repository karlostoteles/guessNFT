# guessNFT — TODO

## Current Priority: Layer 1 — Solid Online Gameplay Loop

---

## Layer 1: Online Gameplay Loop 🔴

### 1.1 Turn Tracking
- [ ] Write `turn_number` to DB on every move
- [ ] Write `active_player_num` to DB on turn switch
- [ ] Lock input during opponent's turn
- [ ] Broadcast turn change events

### 1.2 Event Deduplication
- [ ] Add `idempotency_key` to all event types
- [ ] Generate UUID v4 client-side before sending
- [ ] Server-side: `ON CONFLICT (idempotency_key) DO NOTHING`
- [ ] Client-side: track last processed event ID

### 1.3 Shared Elimination State
- [ ] Broadcast `eliminatedIds` after each question/answer
- [ ] All clients converge to same eliminated set
- [ ] Eliminate animation syncs between players

### 1.4 State Recovery
- [ ] Persist full game state to Supabase
- [ ] Rejoin replays state from DB
- [ ] TTL extended on activity
- [ ] Handle race conditions on reconnect

### 1.5 Turn Sync
- [ ] Simultaneous play works correctly
- [ ] No turn state race conditions
- [ ] Opponent actions reflected immediately

---

## Layer 2: On-Chain Commit-Reveal 🟡

### 2.1 Cairo Contract
- [ ] Deploy game contract to Starknet
- [ ] Implement `submit_commitment` with Pedersen hash
- [ ] Implement `reveal_character` with hash verification
- [ ] Emit events for transparency

### 2.2 Client Integration
- [ ] Wire `submitCommitmentOnChain()` with real call
- [ ] Wire `revealCharacterOnChain()` with real call
- [ ] Handle contract errors gracefully
- [ ] Fallback to client-side if contract unavailable

### 2.3 Security
- [ ] Tighten Supabase RLS
- [ ] Validate commitment before game starts
- [ ] Lock commitment after game begins
- [ ] Reject late reveals

---

## Layer 3: Trait Answer Verification 🟢

### 3.1 Verification Pipeline
- [ ] Fetch all Q&A events from DB after reveal
- [ ] For each question, compute correct answer from revealed character
- [ ] Compare given answer vs correct answer
- [ ] Calculate fair play score (0-100%)

### 3.2 Display
- [ ] Show fair play score in results screen
- [ ] Flag mismatches with warning
- [ ] Optional: replay Q&A animation

### 3.3 On-Chain (Future)
- [ ] Store Q&A on-chain during game
- [ ] Verify on contract after reveal
- [ ] Slashing for detected cheating

---

## Quick Wins (Do First)

1. **Add idempotency_key to game_events table**
   ```sql
   ALTER TABLE game_events ADD COLUMN idempotency_key TEXT UNIQUE;
   ```

2. **Create update_turn RPC function**
   ```sql
   CREATE OR REPLACE FUNCTION update_turn(
     p_room_id UUID,
     p_turn_number INT,
     p_active_player_num INT
   ) RETURNS VOID AS $$
     UPDATE game_state
     SET turn_number = p_turn_number,
         active_player_num = p_active_player_num,
         updated_at = now()
     WHERE room_id = p_room_id;
   $$ LANGUAGE SQL;
   ```

3. **Broadcast elimination state**
   ```typescript
   // In useOnlineGameSync.ts
   supabase.channel('game')
     .on('postgres_changes', {
       event: 'UPDATE',
       schema: 'public',
       table: 'game_state',
       filter: `room_id=eq.${roomId}`
     }, (payload) => {
       // Update local eliminatedIds from payload.new
     })
   ```

---

## Notes

- Layer 1 is prerequisite for everything else
- Don't touch Layer 2/3 until Layer 1 is solid
- Test locally with two browsers before calling done
- Run `npm run build` before every commit

---

*Last updated: 2026-03-20*
