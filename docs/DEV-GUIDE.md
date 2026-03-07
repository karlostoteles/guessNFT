# WhoisWho — Dev & Deployment Guide

## Prerequisites

Make sure these are installed:

```bash
katana --version       # Dojo Katana (local Starknet node)
torii --version        # Dojo Torii (indexer)
sozo --version         # Dojo build & migrate tool
scarb --version        # Cairo package manager
sncast --version       # Starknet cast (for declare/deploy)
```

Use `.tool-versions` at the repo root to pin versions via `asdf`.

---

## Local Development (Katana)

Run these in **separate terminal tabs**, in order.

### Step 1 — Start Katana

```bash
katana --dev --dev.no-fee
```

Runs a local Starknet node on `http://localhost:5050`.
Dev mode gives you pre-funded accounts and no gas costs.

### Step 2 — Deploy contracts

```bash
bash scripts/deploy-local.sh
```

This does 6 things automatically:
1. Imports the Katana dev account into sncast
2. Builds the Garaga verifier (`packages/verifier`)
3. Declares the verifier class on Katana
4. Deploys the verifier via UDC
5. Patches `VERIFIER_ADDRESS_SEPOLIA` in `packages/contracts/src/constants.cairo` with the new address
6. Runs `sozo build` + `sozo migrate` to deploy the Dojo world

When done it prints the deployed addresses and saves them to `.deploy-local.env`.

**After deploy: update `src/starknet/config.ts`**

The `sozo migrate` output shows the new `game_actions` contract address. Update the hardcoded value:

```typescript
// src/starknet/config.ts
export const GAME_CONTRACT = '0x<new_address_from_migrate_output>';
```

Also check `toriiClient.ts` for `WORLD_ADDRESS` — it should match the world address shown by `sozo migrate`.

### Step 3 — Start Torii

```bash
torii \
  --world 0x04f057e1fead04aae0e8d385d109b3cd66dbe472216035698c23764d3330a61d \
  --rpc http://localhost:5050
```

Replace the `--world` address with the one printed by `sozo migrate` if it changed.
Torii runs on `http://localhost:8080` by default.

> **Why Torii?** The frontend subscribes to on-chain game state via Torii's gRPC-web API. Without it running, the client gets "Failed to fetch" errors and game state never syncs.

### Step 4 — Start the frontend

```bash
npm run dev
```

The Vite dev server runs on `http://localhost:5173`.
It proxies all `/world.World/*` requests to `localhost:8080` (Torii) to avoid CORS/COEP issues — so **Torii must be on port 8080** for the proxy to work.

### Step 5 — Play with two tabs

Open **two browser tabs** at `http://localhost:5173`.

| Tab | Action |
|-----|--------|
| Tab 1 (Player 1) | Select **Katana Account 0** in the dev wallet selector |
| Tab 2 (Player 2) | Select **Katana Account 1** in the dev wallet selector |

1. Tab 1: **Create Game** → copy the Game ID shown
2. Tab 2: **Join Game** → paste the Game ID
3. Both tabs: select a secret character
4. Both tabs: commitments are submitted on-chain automatically
5. Game starts — Player 1 sees question select, Player 2 waits
6. Ask questions → ZK proof generates in browser → answer applied

**Katana dev accounts:**

| Player | Address | Private Key |
|--------|---------|-------------|
| P1 | `0x127fd5f1fe78a71f8bcd1fec63e3fe2f0486b6ecd5c86a0466c3a21fa5cfcec` | `0xc5b2fcab997346f3ea1c00b002ecf6f382c5f9c9659a3894eb783c5320f912` |
| P2 | `0x13d9ee239f33fea4f8785b9e3870ade909e20a9599ae7cd62c1c292b73af1b7` | `0x1c9053c053edf324aec366a34c6901b1095b07af69495bffec7d7fe21effb1b` |

---

## Troubleshooting (Local)

**"Failed to analyze tip statistics / Failed to fetch"**
→ Torii is not running. Start it (Step 3 above). Check it's on port 8080.

**"Failed to fetch" only in browser (not in scripts)**
→ COEP header issue. The Vite proxy handles this in dev. Make sure you're on `localhost:5173`, not opening the HTML file directly.

**`sozo migrate` fails with "account not found"**
→ Katana was restarted and lost state. Re-run `scripts/deploy-local.sh` from scratch.

**Contract phase stuck / no Torii updates**
→ Check the Torii terminal for indexing errors. The `--world` address must match exactly.

**Proof generation hangs**
→ The ZK prover (bb.js WASM) needs SharedArrayBuffer. Check browser console for COEP errors. Make sure `npm run dev` is running (not just opening the built file).

**Class already declared error during deploy**
→ Normal if you re-run deploy without restarting Katana. The script handles it automatically.

---

## Sepolia Deployment

### Differences from local

| Thing | Local (Katana) | Sepolia |
|-------|---------------|---------|
| RPC | `http://localhost:5050` | Your Sepolia RPC URL |
| Account | Katana dev account (free) | Real funded Sepolia account |
| Gas | Free (`--dev.no-fee`) | Real ETH needed |
| Deploy speed | Instant | ~30s per tx |
| Torii | Local `localhost:8080` | Hosted Torii service |
| Frontend env | No `.env` needed | Set `VITE_*` vars |

### 1 — Create `.env.sepolia`

```bash
cat > .env.sepolia << 'EOF'
SEPOLIA_RPC_URL=https://starknet-sepolia.public.blastapi.io
SEPOLIA_ACCOUNT_ADDRESS=0x...
SEPOLIA_PRIVATE_KEY=0x...
EOF
```

Fund the account with Sepolia ETH from the [Starknet faucet](https://blastapi.io/faucets/starknet-sepolia-eth).

### 2 — Deploy

```bash
bash scripts/deploy-sepolia.sh
```

Then migrate Dojo manually (the script intentionally skips this):

```bash
cd packages/contracts
sozo migrate --profile prod
```

Check `Scarb.toml` for the `[profile.prod]` section — it needs the Sepolia RPC and account.

### 3 — Start a hosted Torii

Point Torii at Sepolia:

```bash
torii \
  --world <WORLD_ADDRESS_FROM_MIGRATE> \
  --rpc <SEPOLIA_RPC_URL>
```

Or use a hosted indexer service. Make it publicly accessible (e.g. via a tunnel or VPS).

### 4 — Set frontend env vars

Create `.env.local` (never committed):

```bash
VITE_TORII_URL=https://your-torii-host.example.com
VITE_WORLD_ADDRESS=0x<world_address>
```

Also update `src/starknet/config.ts` with the Sepolia `GAME_CONTRACT` address.

If using Cartridge Controller for wallets (production), users connect with their Cartridge account — no private key handling needed in the frontend.

### 5 — Build & serve

```bash
npm run build
# Serve dist/ from your hosting (Vercel, Netlify, etc.)
```

No Vite proxy in production — the frontend hits `VITE_TORII_URL` directly. Make sure CORS is configured on the Torii host.

---

## Summary of all addresses to keep in sync

After any deploy, these must all point to the same deployment:

| File | Field | What it is |
|------|-------|------------|
| `src/starknet/config.ts` | `GAME_CONTRACT` | game_actions contract address |
| `src/dojo/toriiClient.ts` | `WORLD_ADDRESS` | Dojo world address |
| `packages/contracts/src/constants.cairo` | `VERIFIER_ADDRESS_SEPOLIA` | Garaga verifier (patched by deploy script) |
| Torii `--world` flag | — | Must match `WORLD_ADDRESS` |

The deploy scripts patch `constants.cairo` automatically. The TypeScript constants you update manually.
