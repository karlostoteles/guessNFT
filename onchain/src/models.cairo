use starknet::ContractAddress;

// ─── Phase constants ───────────────────────────────────────────────────────────
// 0 = WAITING_FOR_PLAYER2   creator deployed, waiting for opponent
// 1 = COMMIT                both players selecting their secret character
// 2 = ACTIVE                game running (Q&A via Supabase)
// 3 = COMPLETED             winner recorded on-chain
pub const PHASE_WAITING: u8 = 0;
pub const PHASE_COMMIT: u8  = 1;
pub const PHASE_ACTIVE: u8  = 2;
pub const PHASE_COMPLETED: u8 = 3;

// ─── Game ──────────────────────────────────────────────────────────────────────
// Core session entity. Created by player1, joined by player2.
// Advances WAITING → COMMIT → ACTIVE (auto, when both commit) → COMPLETED.
#[derive(Drop, Serde)]
#[dojo::model]
pub struct Game {
    #[key]
    pub game_id: felt252,
    pub player1: ContractAddress,
    pub player2: ContractAddress,   // zero until joined
    pub phase: u8,
    pub winner: ContractAddress,    // zero until completed
    pub created_at: u64,
    pub updated_at: u64,
}

// ─── Commitment ────────────────────────────────────────────────────────────────
// One record per player per game.
// hash = Pedersen(character_id, salt) — proves player chose a character before
// the game started without revealing which one.
// Stored immediately on commit; character_id revealed only after game ends.
#[derive(Drop, Serde)]
#[dojo::model]
pub struct Commitment {
    #[key]
    pub game_id: felt252,
    #[key]
    pub player: ContractAddress,
    pub hash: felt252,              // Pedersen(character_id, salt)
    pub character_id: felt252,      // zero until revealed
    pub salt: felt252,              // zero until revealed
    pub revealed: bool,
}
