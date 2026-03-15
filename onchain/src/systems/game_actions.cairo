// guessNFT — Game Actions System
//
// Phase flow:
//   create_game()          → WAITING_FOR_PLAYER2
//   join_game()            → COMMIT
//   commit_character() ×2  → ACTIVE  (auto-transitions when both committed)
//   record_result()        → COMPLETED
//   reveal_character() ×2  → integrity proof (optional post-game)
//
// Q&A gameplay runs off-chain via Supabase. Only the commitment and result
// are recorded on Starknet, giving the game a tamper-evident audit trail.

#[dojo::contract]
pub mod game_actions {
    use starknet::{ContractAddress, get_caller_address, get_block_timestamp};
    use dojo::model::ModelStorage;
    use dojo::event::EventStorage;
    use dojo::world::IWorldDispatcherTrait;

    use guessnft::models::{
        Game, Commitment,
        PHASE_WAITING, PHASE_COMMIT, PHASE_ACTIVE, PHASE_COMPLETED,
    };
    use guessnft::events::{
        GameCreated, PlayerJoined, CharacterCommitted,
        GameStarted, CharacterRevealed, GameCompleted,
    };
    use guessnft::errors;
    use guessnft::interfaces::IGameActions;

    // ─── Internal helpers ──────────────────────────────────────────────────────

    #[generate_trait]
    impl InternalImpl of InternalTrait {
        fn world_default(self: @ContractState) -> dojo::world::WorldStorage {
            self.world(@"guessnft")
        }

        // Simple Pedersen hash: hash(a, b)
        fn pedersen(a: felt252, b: felt252) -> felt252 {
            core::pedersen::pedersen(a, b)
        }
    }

    // ─── Public interface ──────────────────────────────────────────────────────

    #[abi(embed_v0)]
    impl GameActionsImpl of IGameActions<ContractState> {

        // Create a new game. Caller becomes player1.
        // Returns the unique game_id for sharing with the opponent.
        fn create_game(ref self: ContractState) -> felt252 {
            let mut world = self.world_default();
            let player1 = get_caller_address();
            let now = get_block_timestamp();

            let game_id: felt252 = world.dispatcher.uuid().into();

            world.write_model(@Game {
                game_id,
                player1,
                player2: 0_felt252.try_into().unwrap(),
                phase: PHASE_WAITING,
                winner: 0_felt252.try_into().unwrap(),
                created_at: now,
                updated_at: now,
            });

            world.emit_event(@GameCreated { game_id, player1, created_at: now });

            game_id
        }

        // Second player joins. Game advances to COMMIT phase.
        fn join_game(ref self: ContractState, game_id: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let mut game: Game = world.read_model(game_id);
            let zero: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero, errors::ERR_GAME_NOT_FOUND);
            assert(game.phase == PHASE_WAITING, errors::ERR_WRONG_PHASE);
            assert(game.player2 == zero, errors::ERR_ALREADY_JOINED);
            assert(caller != game.player1, errors::ERR_SELF_JOIN);

            game.player2 = caller;
            game.phase = PHASE_COMMIT;
            game.updated_at = get_block_timestamp();

            world.write_model(@game);
            world.emit_event(@PlayerJoined { game_id, player2: caller });
        }

        // Player commits their secret character hash.
        // hash = Pedersen(character_id, salt) — computed client-side.
        // When both players have committed, game automatically starts.
        fn commit_character(ref self: ContractState, game_id: felt252, hash: felt252) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();

            let mut game: Game = world.read_model(game_id);
            let zero: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero, errors::ERR_GAME_NOT_FOUND);
            assert(game.phase == PHASE_COMMIT, errors::ERR_WRONG_PHASE);
            assert(
                caller == game.player1 || caller == game.player2,
                errors::ERR_NOT_A_PLAYER
            );
            assert(hash != 0, errors::ERR_INVALID_COMMITMENT);

            // Check caller hasn't already committed
            let existing: Commitment = world.read_model((game_id, caller));
            assert(existing.hash == 0, errors::ERR_ALREADY_COMMITTED);

            world.write_model(@Commitment {
                game_id,
                player: caller,
                hash,
                character_id: 0,
                salt: 0,
                revealed: false,
            });

            world.emit_event(@CharacterCommitted {
                game_id, player: caller, committed_at: now,
            });

            // Auto-advance to ACTIVE when both players have committed
            let p1_commitment: Commitment = world.read_model((game_id, game.player1));
            let p2_commitment: Commitment = world.read_model((game_id, game.player2));

            if p1_commitment.hash != 0 && p2_commitment.hash != 0 {
                game.phase = PHASE_ACTIVE;
                game.updated_at = now;
                world.write_model(@game);
                world.emit_event(@GameStarted { game_id, started_at: now });
            }
        }

        // Record the winner of the off-chain game.
        // Can be called by either player. The winner address must be one of the two players.
        // This is intentionally permissive — we're not enforcing ZK on-chain proof in Phase 1.
        // Phase 2 will add ZK verification here.
        fn record_result(ref self: ContractState, game_id: felt252, winner: ContractAddress) {
            let mut world = self.world_default();
            let caller = get_caller_address();
            let now = get_block_timestamp();

            let mut game: Game = world.read_model(game_id);
            let zero: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero, errors::ERR_GAME_NOT_FOUND);
            assert(game.phase == PHASE_ACTIVE, errors::ERR_WRONG_PHASE);
            assert(
                caller == game.player1 || caller == game.player2,
                errors::ERR_NOT_A_PLAYER
            );
            assert(winner != zero, errors::ERR_NO_WINNER);
            assert(
                winner == game.player1 || winner == game.player2,
                errors::ERR_NOT_A_PLAYER
            );

            game.winner = winner;
            game.phase = PHASE_COMPLETED;
            game.updated_at = now;

            world.write_model(@game);
            world.emit_event(@GameCompleted { game_id, winner, completed_at: now });
        }

        // Reveal secret character to prove commitment was honest.
        // Verifies: Pedersen(character_id, salt) == stored hash.
        // Can be called by either player after game is COMPLETED.
        fn reveal_character(
            ref self: ContractState,
            game_id: felt252,
            character_id: felt252,
            salt: felt252,
        ) {
            let mut world = self.world_default();
            let caller = get_caller_address();

            let game: Game = world.read_model(game_id);
            let zero: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero, errors::ERR_GAME_NOT_FOUND);
            assert(game.phase == PHASE_COMPLETED, errors::ERR_WRONG_PHASE);
            assert(
                caller == game.player1 || caller == game.player2,
                errors::ERR_NOT_A_PLAYER
            );
            assert(salt != 0, errors::ERR_INVALID_SALT);

            let mut commitment: Commitment = world.read_model((game_id, caller));
            assert(!commitment.revealed, errors::ERR_ALREADY_REVEALED);

            // Verify the reveal matches the original commitment
            let expected_hash = InternalImpl::pedersen(character_id, salt);
            assert(expected_hash == commitment.hash, errors::ERR_HASH_MISMATCH);

            commitment.character_id = character_id;
            commitment.salt = salt;
            commitment.revealed = true;

            world.write_model(@commitment);
            world.emit_event(@CharacterRevealed { game_id, player: caller, character_id });
        }
    }
}
