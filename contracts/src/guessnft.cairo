/// Minimal commit-reveal trust anchor for guessNFT.
/// Gameplay lives in Supabase — this contract only stores and verifies commitments.

#[starknet::interface]
pub trait ICommitReveal<TContractState> {
    fn commit(ref self: TContractState, game_id: felt252, commitment: felt252);
    fn reveal(ref self: TContractState, game_id: felt252, character_id: felt252, salt: felt252);
    fn get_commitment(self: @TContractState, game_id: felt252, player: starknet::ContractAddress) -> felt252;
}

#[starknet::contract]
mod CommitReveal {
    use starknet::{ContractAddress, get_caller_address};
    use starknet::storage::{StorageMapReadAccess, StorageMapWriteAccess};

    #[storage]
    struct Storage {
        /// (game_id, player) → pedersen(character_id, salt)
        commitments: starknet::storage::Map<(felt252, ContractAddress), felt252>,
    }

    #[event]
    #[derive(Drop, starknet::Event)]
    enum Event {
        Committed: Committed,
        Revealed: Revealed,
    }

    #[derive(Drop, starknet::Event)]
    struct Committed { game_id: felt252, player: ContractAddress, hash: felt252 }
    #[derive(Drop, starknet::Event)]
    struct Revealed { game_id: felt252, player: ContractAddress, character_id: felt252 }

    #[abi(embed_v0)]
    impl CommitRevealImpl of super::ICommitReveal<ContractState> {
        fn commit(ref self: ContractState, game_id: felt252, commitment: felt252) {
            assert(commitment != 0, 'empty commitment');
            let caller = get_caller_address();
            assert(self.commitments.read((game_id, caller)) == 0, 'already committed');
            self.commitments.write((game_id, caller), commitment);
            self.emit(Event::Committed(Committed { game_id, player: caller, hash: commitment }));
        }

        fn reveal(ref self: ContractState, game_id: felt252, character_id: felt252, salt: felt252) {
            let caller = get_caller_address();
            let stored = self.commitments.read((game_id, caller));
            assert(stored != 0, 'no commitment');
            assert(core::pedersen::pedersen(character_id, salt) == stored, 'hash mismatch');
            self.emit(Event::Revealed(Revealed { game_id, player: caller, character_id }));
        }

        fn get_commitment(self: @ContractState, game_id: felt252, player: ContractAddress) -> felt252 {
            self.commitments.read((game_id, player))
        }
    }
}
