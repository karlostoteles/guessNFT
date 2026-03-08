# WhoisWho Dojo Contracts

This directory contains the on-chain game logic for WhoisWho using Dojo + Cairo.

## Version Baseline

The contract toolchain is pinned to the same proven baseline used in `PonziLand`:

- Cairo / Starknet: `2.12.1`
- Dojo: `v1.7.0-alpha.2`

## Structure

- `src/models/game.cairo`: Dojo models (`Game`, `Commitment`, `Board`, `Turn`)
- `src/events.cairo`: World events indexed by Torii
- `src/interfaces/game_actions.cairo`: system interface
- `src/systems/game_actions.cairo`: game action system
- `src/tests/`: initial test scaffold
- `dojo_dev.toml`: local Katana + migration config
- `dojo_prod.toml`: production/mainnet profile scaffold

## Common Commands

```bash
cd contracts
scarb run build
scarb run test
scarb run migrate
```

## Notes

- This stage provides a solid project structure and a functional contract scaffold.
- Full cryptographic reveal verification (`pedersen(character_id, salt)`) is intentionally deferred
  to the next implementation stage.
