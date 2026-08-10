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

- Persistence: `bun:sqlite` in `apps/coordinator/src/lib/db.ts`, path resolved relative to the package root (`DATABASE_PATH` overrides)
- Flare registry: resolves FtsoV2 / FdcHub / FdcVerification / Relay on Coston2
- FDC: live prepare/submit/DA-proof flow lives in `services/fdcLive.ts`; called directly from `index.ts` routes (`/v1/attest/payment`, `/v1/attest/ftso`, `/v1/fdc/*`) — there is no `FDC_MODE` env switch
- On-chain proof verification: gated by `ProofVerifier.mockMode` (owner-toggleable on-chain flag, not an env var). The Coston2 deployment currently runs with `mockMode=true` (wired to `MockFdcVerification`/`MockFtsoV2`) — see `contracts/script/SetLive.s.sol` to flip it once a real deployer key + funded account are available
- On-chain fire: `services/chain.ts` when `TRIGGER_EXECUTOR_ADDRESS` + `DEPLOYER_PRIVATE_KEY`
- Composition: `services/composition.ts` AND/OR over recent events

## Flare

- Coston2 chainId `114`, registry `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- Production path: FDC Payment + FTSO; off-chain prepare/DA-proof calls are genuinely live against Flare testnet infra, but on-chain proof consumption is still in mock mode on the current deployment (see above)
- Local: `anvil` + `DeployLocal.s.sol` → see `deployments/local.json`
