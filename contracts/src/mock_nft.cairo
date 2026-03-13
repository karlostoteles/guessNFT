use starknet::ContractAddress;

#[starknet::interface]
pub trait IMockNFT<TContractState> {
    fn mint(ref self: TContractState, to: ContractAddress, token_id: u256);
    fn transfer_from(ref self: TContractState, from: ContractAddress, to: ContractAddress, token_id: u256);
    fn approve(ref self: TContractState, to: ContractAddress, token_id: u256);
}

#[starknet::contract]
pub mod MockNFT {
    use starknet::{ContractAddress, get_caller_address};

    #[storage]
    struct Storage {
        owners: starknet::storage::Map<u256, ContractAddress>,
        approvals: starknet::storage::Map<u256, ContractAddress>,
    }

    #[abi(embed_v0)]
    impl MockNFTImpl of super::IMockNFT<ContractState> {
        fn mint(ref self: ContractState, to: ContractAddress, token_id: u256) {
            self.owners.write(token_id, to);
        }

        fn transfer_from(ref self: ContractState, from: ContractAddress, to: ContractAddress, token_id: u256) {
            let owner = self.owners.read(token_id);
            assert(owner == from, 'Not owner');
            
            let caller = get_caller_address();
            let approval = self.approvals.read(token_id);
            assert(caller == owner || caller == approval, 'Not authorized');

            self.owners.write(token_id, to);
            self.approvals.write(token_id, 0_felt252.try_into().unwrap());
        }

        fn approve(ref self: ContractState, to: ContractAddress, token_id: u256) {
            let owner = self.owners.read(token_id);
            assert(get_caller_address() == owner, 'Not owner');
            self.approvals.write(token_id, to);
        }
    }
}
