use snforge_std::{declare, ContractClassTrait, DeclareResultTrait, start_cheat_caller_address, stop_cheat_caller_address};
use starknet::ContractAddress;
use guessnft::{ICommitRevealDispatcher, ICommitRevealDispatcherTrait};

fn PLAYER1() -> ContractAddress { 0xABC.try_into().unwrap() }
fn PLAYER2() -> ContractAddress { 0xDEF.try_into().unwrap() }
fn OUTSIDER() -> ContractAddress { 0x999.try_into().unwrap() }

fn deploy() -> ICommitRevealDispatcher {
    let class = declare("CommitReveal").unwrap().contract_class();
    let (addr, _) = class.deploy(@array![]).unwrap();
    ICommitRevealDispatcher { contract_address: addr }
}

// ─── commit tests ────────────────────────────────────────────────────────────

#[test]
fn test_commit_stores_hash() {
    let cr = deploy();
    let game_id = 1;
    let commitment = 0x123456789;

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, commitment);
    stop_cheat_caller_address(cr.contract_address);

    assert(cr.get_commitment(game_id, PLAYER1()) == commitment, 'commitment not stored');
}

#[test]
fn test_two_players_commit_same_game() {
    let cr = deploy();
    let game_id = 1;

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, 0x111);
    stop_cheat_caller_address(cr.contract_address);

    start_cheat_caller_address(cr.contract_address, PLAYER2());
    cr.commit(game_id, 0x222);
    stop_cheat_caller_address(cr.contract_address);

    assert(cr.get_commitment(game_id, PLAYER1()) == 0x111, 'p1 wrong');
    assert(cr.get_commitment(game_id, PLAYER2()) == 0x222, 'p2 wrong');
}

#[test]
#[should_panic(expected: 'empty commitment')]
fn test_commit_zero_rejected() {
    let cr = deploy();
    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(1, 0);
}

#[test]
#[should_panic(expected: 'already committed')]
fn test_double_commit_rejected() {
    let cr = deploy();
    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(1, 0x111);
    cr.commit(1, 0x222); // should panic
}

// ─── reveal tests ────────────────────────────────────────────────────────────

#[test]
fn test_reveal_valid() {
    let cr = deploy();
    let game_id = 1;
    let character_id: felt252 = 0x42;
    let salt: felt252 = 0x1234;
    let commitment = core::pedersen::pedersen(character_id, salt);

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, commitment);
    cr.reveal(game_id, character_id, salt); // should not panic
    stop_cheat_caller_address(cr.contract_address);
}

#[test]
#[should_panic(expected: 'hash mismatch')]
fn test_reveal_wrong_salt_rejected() {
    let cr = deploy();
    let game_id = 1;
    let character_id: felt252 = 0x42;
    let salt: felt252 = 0x1234;
    let commitment = core::pedersen::pedersen(character_id, salt);

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, commitment);
    cr.reveal(game_id, character_id, 0x9999); // wrong salt
}

#[test]
#[should_panic(expected: 'hash mismatch')]
fn test_reveal_wrong_character_rejected() {
    let cr = deploy();
    let game_id = 1;
    let character_id: felt252 = 0x42;
    let salt: felt252 = 0x1234;
    let commitment = core::pedersen::pedersen(character_id, salt);

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, commitment);
    cr.reveal(game_id, 0x99, salt); // wrong character
}

#[test]
#[should_panic(expected: 'no commitment')]
fn test_reveal_without_commit_rejected() {
    let cr = deploy();
    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.reveal(1, 0x42, 0x1234); // never committed
}

// ─── isolation tests ─────────────────────────────────────────────────────────

#[test]
fn test_games_isolated() {
    let cr = deploy();

    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(1, 0xAAA);
    cr.commit(2, 0xBBB);
    stop_cheat_caller_address(cr.contract_address);

    assert(cr.get_commitment(1, PLAYER1()) == 0xAAA, 'game1 wrong');
    assert(cr.get_commitment(2, PLAYER1()) == 0xBBB, 'game2 wrong');
}

#[test]
fn test_get_commitment_no_commit_returns_zero() {
    let cr = deploy();
    assert(cr.get_commitment(1, OUTSIDER()) == 0, 'should be zero');
}

// ─── full flow test ──────────────────────────────────────────────────────────

#[test]
fn test_full_flow_two_players() {
    let cr = deploy();
    let game_id = 42;

    let p1_char: felt252 = 0x10;
    let p1_salt: felt252 = 0xAAAA;
    let p1_hash = core::pedersen::pedersen(p1_char, p1_salt);

    let p2_char: felt252 = 0x20;
    let p2_salt: felt252 = 0xBBBB;
    let p2_hash = core::pedersen::pedersen(p2_char, p2_salt);

    // Both commit
    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.commit(game_id, p1_hash);
    stop_cheat_caller_address(cr.contract_address);

    start_cheat_caller_address(cr.contract_address, PLAYER2());
    cr.commit(game_id, p2_hash);
    stop_cheat_caller_address(cr.contract_address);

    // Both reveal
    start_cheat_caller_address(cr.contract_address, PLAYER1());
    cr.reveal(game_id, p1_char, p1_salt);
    stop_cheat_caller_address(cr.contract_address);

    start_cheat_caller_address(cr.contract_address, PLAYER2());
    cr.reveal(game_id, p2_char, p2_salt);
    stop_cheat_caller_address(cr.contract_address);
}
