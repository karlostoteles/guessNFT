use starknet::ContractAddress;

#[starknet::interface]
pub trait IGameActions<T> {
    // Create a new game session. Returns the game_id.
    fn create_game(ref self: T) -> felt252;

    // Second player joins. Advances to COMMIT phase.
    fn join_game(ref self: T, game_id: felt252);

    // Each player submits their commitment hash.
    // hash = Pedersen(character_id, salt)
    // When both have committed the game auto-advances to ACTIVE.
    fn commit_character(ref self: T, game_id: felt252, hash: felt252);

    // Called by winner after the off-chain Q&A game concludes.
    // Records the winner on-chain and advances to COMPLETED.
    fn record_result(ref self: T, game_id: felt252, winner: ContractAddress);

    // Either player reveals their secret character after game is COMPLETED.
    // Verifies Pedersen(character_id, salt) == stored hash.
    fn reveal_character(ref self: T, game_id: felt252, character_id: felt252, salt: felt252);
}
