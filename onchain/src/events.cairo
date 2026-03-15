use starknet::ContractAddress;

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct GameCreated {
    #[key]
    pub game_id: felt252,
    pub player1: ContractAddress,
    pub created_at: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct PlayerJoined {
    #[key]
    pub game_id: felt252,
    pub player2: ContractAddress,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct CharacterCommitted {
    #[key]
    pub game_id: felt252,
    #[key]
    pub player: ContractAddress,
    pub committed_at: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct GameStarted {
    #[key]
    pub game_id: felt252,
    pub started_at: u64,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct CharacterRevealed {
    #[key]
    pub game_id: felt252,
    #[key]
    pub player: ContractAddress,
    pub character_id: felt252,
}

#[derive(Copy, Drop, Serde)]
#[dojo::event]
pub struct GameCompleted {
    #[key]
    pub game_id: felt252,
    pub winner: ContractAddress,
    pub completed_at: u64,
}
