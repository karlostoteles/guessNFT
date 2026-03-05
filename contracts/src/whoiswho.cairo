use starknet::ContractAddress;

#[starknet::interface]
pub trait IERC721<TContractState> {
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, token_id: u256);
}

#[starknet::interface]
pub trait IWhoisWho<TContractState> {
    fn create_game(ref self: TContractState, game_id: felt252, p2: ContractAddress);
    fn commit_character(ref self: TContractState, game_id: felt252, commitment: felt252);
    fn deposit_wager(ref self: TContractState, game_id: felt252, token_id: u256);
    fn opponent_won(ref self: TContractState, game_id: felt252);
    fn get_game(self: @TContractState, game_id: felt252) -> WhoisWho::Game;
}

#[starknet::contract]
pub mod WhoisWho {
    use super::{IWhoisWho, IERC721Dispatcher, IERC721DispatcherTrait};
    use starknet::{ContractAddress, get_caller_address, get_contract_address};

    #[derive(Copy, Drop, Serde, starknet::Store)]
    pub struct Game {
        player1: ContractAddress,
        player2: ContractAddress,
        p1_commitment: felt252,
        p2_commitment: felt252,
        p1_wager: u256,
        p2_wager: u256,
        winner: ContractAddress,
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
        CharacterCommitted: CharacterCommitted,
        WagerDeposited: WagerDeposited,
        GameWon: GameWon,
    }

    #[derive(Drop, starknet::Event)]
    struct GameCreated { game_id: felt252, player1: ContractAddress, player2: ContractAddress }
    #[derive(Drop, starknet::Event)]
    struct CharacterCommitted { game_id: felt252, player: ContractAddress, commitment: felt252 }
    #[derive(Drop, starknet::Event)]
    struct WagerDeposited { game_id: felt252, player: ContractAddress, token_id: u256 }
    #[derive(Drop, starknet::Event)]
    struct GameWon { game_id: felt252, winner: ContractAddress, prize1: u256, prize2: u256 }

    #[constructor]
    fn constructor(ref self: ContractState, nft_contract: ContractAddress) {
        self.nft_contract.write(nft_contract);
    }

    #[abi(embed_v0)]
    impl WhoisWhoImpl of IWhoisWho<ContractState> {
        fn create_game(ref self: ContractState, game_id: felt252, p2: ContractAddress) {
            let caller = get_caller_address();
            let zero_address: ContractAddress = 0_felt252.try_into().unwrap();
            let game = Game {
                player1: caller,
                player2: p2,
                p1_commitment: 0,
                p2_commitment: 0,
                p1_wager: 0,
                p2_wager: 0,
                winner: zero_address,
            };
            self.games.write(game_id, game);
            self.emit(Event::GameCreated(GameCreated { game_id, player1: caller, player2: p2 }));
        }

        fn commit_character(ref self: ContractState, game_id: felt252, commitment: felt252) {
            let caller = get_caller_address();
            let mut game = self.games.read(game_id);
            assert(commitment != 0, 'Commitment zero');

            if caller == game.player1 {
                game.p1_commitment = commitment;
            } else if caller == game.player2 {
                game.p2_commitment = commitment;
            } else {
                panic!("Not a player");
            }

            self.games.write(game_id, game);
            self.emit(Event::CharacterCommitted(CharacterCommitted { game_id, player: caller, commitment }));
        }

        fn deposit_wager(ref self: ContractState, game_id: felt252, token_id: u256) {
            let caller = get_caller_address();
            let this_contract = get_contract_address();
            let mut game = self.games.read(game_id);

            assert(token_id != 0_u256, 'Invalid token');

            if caller == game.player1 {
                game.p1_wager = token_id;
            } else if caller == game.player2 {
                game.p2_wager = token_id;
            } else {
                panic!("Not a player");
            }

            let nft = IERC721Dispatcher { contract_address: self.nft_contract.read() };
            nft.transfer_from(caller, this_contract, token_id);

            self.games.write(game_id, game);
            self.emit(Event::WagerDeposited(WagerDeposited { game_id, player: caller, token_id }));
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

            game.winner = opponent;
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
    }
}
