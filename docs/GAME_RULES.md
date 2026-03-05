# guessNFT — Game Rules

## Overview

guessNFT is a digital adaptation of "Guess Who?" built for NFT collections. Two players each secretly pick a character from a shared pool, then take turns asking yes/no questions about character traits to narrow down the opponent's secret pick.

## Game Modes

### Free Mode (vs CPU)
Local single-player against an AI opponent. Uses the built-in CHARACTERS dataset (or MEME_CHARACTERS). No wallet connection required.

### NFT Mode (vs CPU)
Same as Free Mode, but characters are pulled from the player's owned Schizodio NFTs on Starknet. Requires wallet connection via Cartridge Controller. NFT metadata is converted to game characters via the `nftCharacterAdapter`.

### Online Mode (vs Player)
Two players connect via a room code. Uses Supabase Realtime for event synchronization. Secret character selections are protected by a commit-reveal scheme (hash commitment before reveal).

## Game Flow

### 1. Setup Phase
- Both players view the character grid (same pool for both)
- Each player secretly selects one character as their "secret pick"
- In online mode, a cryptographic commitment (hash of characterId + random salt) is created before the game begins

### 2. Gameplay Loop
Players alternate turns. Each turn:

**a) Ask a Question**
The active player selects a yes/no question from the question bank (e.g., "Does your character have brown hair?", "Is your character wearing glasses?")

**b) Opponent Answers**
The opponent (or CPU) truthfully answers "Yes" or "No" based on their secret character's traits. The answer is evaluated using `evaluateQuestion()` which checks the character's trait data.

**c) Eliminate Characters**
Based on the answer, the asking player eliminates characters from their board that don't match. For example, if the answer to "brown hair?" is "Yes", eliminate all characters without brown hair.

**d) Guess or Continue**
The player can either:
- **Continue** — End turn, opponent's turn begins
- **Risk It (Guess)** — Attempt to guess the opponent's secret character

### 3. Guessing
- If the guess is **correct** → the guesser wins
- If the guess is **wrong** → the guesser loses immediately (high stakes!)

### 4. End Game
The winner is displayed on the Result screen. In online mode, the commit-reveal is verified to prove neither player cheated on their character selection.

## Character Traits

Characters are defined by these traits (from `data/traits.ts`):

- **Gender:** male, female
- **Skin tone:** light, medium, tan, dark, very_dark
- **Hair color:** black, brown, blonde, red, white, blue
- **Hair style:** short, long, curly, bald, mohawk, ponytail
- **Eye color:** brown, blue, green, hazel
- **Accessories:** glasses, hat, earrings, beard, mustache, freckles, scar

Questions in `data/questions.ts` target these traits. The `evaluateQuestion()` function in utils matches a question against a character's trait values to produce a boolean answer.

## NFT Character Mapping

For NFT mode, on-chain Schizodio NFTs have metadata attributes that get mapped to the game's `CharacterTraits` interface via `nftCharacterAdapter.ts`. This allows any Schizodio NFT to be playable as a game character with proper trait-based questioning.

## Anti-Cheat (Commit-Reveal)

In online mode, character selection integrity is protected by commit-reveal:

1. **Commit phase:** Player hashes their `(characterId, randomSalt)` and shares only the hash
2. **Play phase:** Game proceeds normally — neither player knows the other's pick
3. **Reveal phase:** At game end, both players reveal their `(characterId, salt)` — the hash is verified to match the original commitment

Currently implemented client-side only. On-chain verification via Cairo smart contracts is planned for Phase 2.
