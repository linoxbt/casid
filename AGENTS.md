# Casid — agent notes

## Product

Casid is a **verified economic event fabric** on Flare: attested topics, FDC/FTSO proofs, proof-gated webhooks and on-chain triggers.

Not a wallet, DEX, bridge, or AI chatbot.

## Layout

- `contracts/` — Foundry (TopicRegistry, ProofVerifier, SubscriptionHub, TriggerExecutor)
- `packages/core/` — Topic DSL, HMAC webhooks, Flare constants
- `apps/coordinator/` — Hono API on port **4100**
- `apps/web/` — Next.js console on port **3100**

## Commands

```bash
bun install
bun run --filter @casid/core test
cd contracts && forge test
bun run export:abis
bun run dev:coordinator   # :4100, SQLite ./data/casid.db
bun run dev:web           # :3100
```

## Architecture notes (v0.2)

- Env loading: `bun run --filter @casid/X <script>` executes with that package's own directory as cwd, not the repo root, so Bun's automatic `.env` discovery never finds the root `.env`. `dev`/`start`/`build` scripts in `apps/coordinator/package.json` and `apps/web/package.json` explicitly pass `bun --env-file=../../.env` to fix this — don't drop that flag when touching those scripts, or every env var silently reverts to defaults/undefined again.
- Persistence: `bun:sqlite` in `apps/coordinator/src/lib/db.ts`, path resolved relative to the package root (`DATABASE_PATH` overrides)
- Flare registry: resolves FtsoV2 / FdcHub / FdcVerification / Relay on Coston2
- FDC: live prepare/submit/DA-proof flow lives in `services/fdcLive.ts`; called directly from `index.ts` routes (`/v1/attest/payment`, `/v1/attest/ftso`, `/v1/fdc/*`) — there is no `FDC_MODE` env switch
- On-chain proof verification: gated by `ProofVerifier.mockMode` (owner-toggleable on-chain flag, not an env var). As of 2026-08-11 the Coston2 deployment runs with `mockMode=false`, wired to the real `FdcVerification`/`FtsoV2` contracts (flipped via `contracts/script/SetLive.s.sol` — see `STATUS.md`/`deployments/coston2.json` for tx hashes). `MockFdcVerification`/`MockFtsoV2` remain deployed but are no longer referenced by `ProofVerifier`/`TriggerExecutor`.
- On-chain fire: `services/chain.ts` when `TRIGGER_EXECUTOR_ADDRESS` + `DEPLOYER_PRIVATE_KEY`
- Composition: `services/composition.ts` AND/OR over recent events

## Flare

- Coston2 chainId `114`, registry `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- Production path: FDC Payment + FTSO — both the off-chain prepare/DA-proof calls and on-chain proof consumption are genuinely live against Flare testnet infra (see above)
- Local: `anvil` + `DeployLocal.s.sol` → see `deployments/local.json`
