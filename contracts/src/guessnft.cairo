use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC721<TContractState> {
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, token_id: u256);
}

#[starknet::interface]
pub trait IGuessNFT<TContractState> {
    fn create_game(ref self: TContractState, game_id: felt252, p2: ContractAddress);
    fn join_game(ref self: TContractState, game_id: felt252);
    fn commit_character(ref self: TContractState, game_id: felt252, commitment: felt252);
    fn reveal_character(ref self: TContractState, game_id: felt252, character_id: felt252, salt: felt252);
    fn deposit_wager(ref self: TContractState, game_id: felt252, token_id: u256);
    fn submit_move(ref self: TContractState, game_id: felt252);
    fn claim_timeout_win(ref self: TContractState, game_id: felt252);
    fn cancel_game(ref self: TContractState, game_id: felt252);
    fn opponent_won(ref self: TContractState, game_id: felt252);
    fn get_game(self: @TContractState, game_id: felt252) -> GuessNFT::Game;
    fn get_commitment(self: @TContractState, game_id: felt252, player: ContractAddress) -> felt252;
}

#[starknet::contract]
pub mod GuessNFT {
    use super::{IGuessNFT, IERC721Dispatcher, IERC721DispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[derive(Copy, Drop, Serde, starknet::Store)]
    pub struct Game {
        player1: ContractAddress,
        player2: ContractAddress,
        p1_commitment: felt252,
        p2_commitment: felt252,
        p1_revealed_char: felt252,
        p2_revealed_char: felt252,
        p1_wager: u256,
        p2_wager: u256,
        winner: ContractAddress,
        last_move_timestamp: u64,
        active_player: u8, // 1 or 2
        status: felt252, // 'waiting', 'ready', 'in_progress', 'finished'
    }

    #[storage]
    struct Storage {
        nft_contract: ContractAddress,
        games: starknet::storage::Map<felt252, Game>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        GameCreated: GameCreated,
        PlayerJoined: PlayerJoined,
        CharacterCommitted: CharacterCommitted,
        CharacterRevealed: CharacterRevealed,
        WagerDeposited: WagerDeposited,
        MoveSubmitted: MoveSubmitted,
        TimeoutClaimed: TimeoutClaimed,
        GameCancelled: GameCancelled,
        GameWon: GameWon,
    }

    #[derive(Drop, starknet::Event)]
    struct PlayerJoined { game_id: felt252, player: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct MoveSubmitted { game_id: felt252, player: ContractAddress, timestamp: u64 }
    #[derive(Drop, starknet::Event)]
    struct TimeoutClaimed { game_id: felt252, winner: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct GameCancelled { game_id: felt252, player: ContractAddress }

    #[derive(Drop, starknet::Event)]
    struct GameCreated { game_id: felt252, player1: ContractAddress, player2: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct CharacterCommitted { game_id: felt252, player: ContractAddress, commitment: felt252 }
    #[derive(Drop, starknet::Event)]
    struct CharacterRevealed { game_id: felt252, player: ContractAddress, character_id: felt252, valid: bool }
    #[derive(Drop, starknet::Event)]
    struct WagerDeposited { game_id: felt252, player: ContractAddress, token_id: u256 }
    #[derive(Drop, starknet::Event)]
    struct GameWon { game_id: felt252, winner: ContractAddress, prize1: u256, prize2: u256 }

    #[constructor]
    fn constructor(ref self: ContractState, nft_contract: ContractAddress) {
        self.nft_contract.write(nft_contract);
    }

    #[abi(embed_v0)]
    impl GuessNFTImpl of IGuessNFT<ContractState> {
        fn create_game(ref self: ContractState, game_id: felt252, p2: ContractAddress) {
            let caller = get_caller_address();
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();
            
            let status = if p2 == zero_address { 'waiting' } else { 'ready' };

            let game = Game {
                player1: caller,
                player2: p2,
                p1_commitment: 0,
                p2_commitment: 0,
                p1_revealed_char: 0,
                p2_revealed_char: 0,
                p1_wager: 0,
                p2_wager: 0,
                winner: zero_address,
                last_move_timestamp: starknet::get_block_timestamp(),
                active_player: 1,
                status: status,
            };
            self.games.write(game_id, game);
            self.emit(Event::GameCreated(GameCreated { game_id, player1: caller, player2: p2 }));
        }

        fn join_game(ref self: ContractState, game_id: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero_address, 'Game not found');
            assert(game.player2 == zero_address, 'Game full');
            assert(caller != game.player1, 'Already in game');

            game.player2 = caller;
            game.status = 'ready';
            game.last_move_timestamp = starknet::get_block_timestamp();
            
            self.games.write(game_id, game);
            self.emit(Event::PlayerJoined(PlayerJoined { game_id, player: caller }));
        }

        fn commit_character(ref self: ContractState, game_id: felt252, commitment: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();
            
            assert(commitment != 0, 'Commitment zero');
            assert(game.player1 != zero_address, 'Game does not exist');
            assert(game.status != 'finished', 'Game finished');
            assert(game.status != 'in_progress', 'Game started');

            if caller == game.player1 {
                assert(game.p1_commitment == 0, 'Already committed');
                game.p1_commitment = commitment;
            } else if game.player2 == zero_address {
                // Auto-join if slot is empty (open lobby)
                game.player2 = caller;
                game.p2_commitment = commitment;
                game.status = 'ready';
                self.emit(Event::PlayerJoined(PlayerJoined { game_id, player: caller }));
            } else if caller == game.player2 {
                assert(game.p2_commitment == 0, 'Already committed');
                game.p2_commitment = commitment;
            } else {
                panic!("Not a player or game full");
            }

            // If both committed, move to in_progress
            if game.p1_commitment != 0 && game.p2_commitment != 0 {
                game.status = 'in_progress';
                game.last_move_timestamp = starknet::get_block_timestamp();
                game.active_player = 1; // P1 starts
            }

            self.games.write(game_id, game);
            self.emit(Event::CharacterCommitted(CharacterCommitted { game_id, player: caller, commitment }));
        }

        fn reveal_character(ref self: ContractState, game_id: felt252, character_id: felt252, salt: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            
            // Compute expected commitment from character_id and salt
            let expected_commitment = core::pedersen::pedersen(character_id, salt);
            
            let stored_commitment = if caller == game.player1 {
                game.p1_commitment
            } else if caller == game.player2 {
                game.p2_commitment
            } else {
                panic!("Not a player");
            };
            
            let valid = expected_commitment == stored_commitment;
            assert(valid, 'Invalid reveal');
            
            // Store revealed character
            if caller == game.player1 {
                game.p1_revealed_char = character_id;
            } else {
                game.p2_revealed_char = character_id;
            }
            
            self.games.write(game_id, game);
            self.emit(Event::CharacterRevealed(CharacterRevealed { game_id, player: caller, character_id, valid }));
        }

        fn deposit_wager(ref self: ContractState, game_id: felt252, token_id: u256) {
            let caller = get_caller_address();
            let this_contract = get_contract_address();
            let mut game = self.games.read(game_id);

            assert(token_id != 0_u256, 'Invalid token');
            assert(game.status != 'in_progress', 'Game started');
            assert(game.status != 'finished', 'Game finished');

            if caller == game.player1 {
                assert(game.p1_wager == 0, 'Already deposited');
                game.p1_wager = token_id;
            } else if caller == game.player2 {
                assert(game.p2_wager == 0, 'Already deposited');
                game.p2_wager = token_id;
            } else {
                panic!("Not a player");
            }

            let nft = IERC721Dispatcher { contract_address: self.nft_contract.read() };
            nft.transfer_from(caller, this_contract, token_id);

            self.games.write(game_id, game);
            self.emit(Event::WagerDeposited(WagerDeposited { game_id, player: caller, token_id }));
        }

        fn submit_move(ref self: ContractState, game_id: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            let now = starknet::get_block_timestamp();

            assert(game.status == 'in_progress', 'Not in progress');
            
            let player_count = if caller == game.player1 { 1_u8 } else if caller == game.player2 { 2_u8 } else { 0_u8 };
            assert(player_count == game.active_player, 'Not your turn');

            // Enforce 30s limit
            assert(now - game.last_move_timestamp <= 30, 'Turn timed out');

            // Toggle active player
            game.active_player = if game.active_player == 1 { 2 } else { 1 };
            game.last_move_timestamp = now;

            self.games.write(game_id, game);
            self.emit(Event::MoveSubmitted(MoveSubmitted { game_id, player: caller, timestamp: now }));
        }

        fn claim_timeout_win(ref self: ContractState, game_id: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            let now = starknet::get_block_timestamp();

            assert(game.status == 'in_progress', 'Not in progress');
            
            // Check if caller is one of the players
            let is_p1 = caller == game.player1;
            let is_p2 = caller == game.player2;
            assert(is_p1 || is_p2, 'Not a player');

            // Wait, logic check: if it's P2's turn, then P1 can claim timeout if now - last > 30
            let can_claim = if game.active_player == 1 { is_p2 } else { is_p1 };
            assert(can_claim, 'Not opponent turn');
            assert(now - game.last_move_timestamp > 30, 'Not timed out yet');

            // Caller wins
            game.winner = caller;
            game.status = 'finished';
            self.games.write(game_id, game);

            // Send wagers
            let this_contract = get_contract_address();
            let nft = IERC721Dispatcher { contract_address: self.nft_contract.read() };
            if game.p1_wager != 0_u256 { nft.transfer_from(this_contract, caller, game.p1_wager); }
            if game.p2_wager != 0_u256 { nft.transfer_from(this_contract, caller, game.p2_wager); }

            self.emit(Event::TimeoutClaimed(TimeoutClaimed { game_id, winner: caller }));
            self.emit(Event::GameWon(GameWon { game_id, winner: caller, prize1: game.p1_wager, prize2: game.p2_wager }));
        }

        fn cancel_game(ref self: ContractState, game_id: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();

            assert(game.player1 != zero_address, 'Game not found');
            assert(game.status == 'waiting' || game.status == 'ready', 'Cannot cancel now');
            assert(caller == game.player1 || caller == game.player2, 'Not authorized');

            game.status = 'finished';
            self.games.write(game_id, game);

            let this_contract = get_contract_address();
            let nft = IERC721Dispatcher { contract_address: self.nft_contract.read() };

            // Return wagers
            if game.p1_wager != 0_u256 {
                nft.transfer_from(this_contract, game.player1, game.p1_wager);
            }
            if game.p2_wager != 0_u256 && game.player2 != zero_address {
                nft.transfer_from(this_contract, game.player2, game.p2_wager);
            }

            self.emit(Event::GameCancelled(GameCancelled { game_id, player: caller }));
        }

        fn opponent_won(ref self: ContractState, game_id: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();
            assert(game.winner == zero_address, 'Game finished');

            let opponent = if caller == game.player1 {
                game.player2
            } else if caller == game.player2 {
                game.player1
            } else {
                panic!("Not a player");
            };

            assert(opponent != zero_address, 'No opponent');

            game.winner = opponent;
            game.status = 'finished';
            self.games.write(game_id, game);

            let this_contract = get_contract_address();
            let nft = IERC721Dispatcher { contract_address: self.nft_contract.read() };
            
            // Send both wagers to the opponent
            if game.p1_wager != 0_u256 {
                nft.transfer_from(this_contract, opponent, game.p1_wager);
            }
            if game.p2_wager != 0_u256 {
                nft.transfer_from(this_contract, opponent, game.p2_wager);
            }

            self.emit(Event::GameWon(GameWon { 
                game_id, 
                winner: opponent, 
                prize1: game.p1_wager, 
                prize2: game.p2_wager 
            }));
        }

        fn get_game(self: @ContractState, game_id: felt252) -> Game {
            self.games.read(game_id)
        }

        fn get_commitment(self: @ContractState, game_id: felt252, player: ContractAddress) -> felt252 {
            let game = self.games.read(game_id);
            if player == game.player1 {
                game.p1_commitment
            } else if player == game.player2 {
                game.p2_commitment
            } else {
                0
            }
        }
    }
}
