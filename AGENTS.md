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

- Persistence: `bun:sqlite` in `apps/coordinator/src/lib/db.ts`
- Flare registry: resolves FtsoV2 / FdcHub / FdcVerification / Relay on Coston2
- FDC: `FDC_MODE=mock|live` in `services/fdc.ts`
- On-chain fire: `services/chain.ts` when `TRIGGER_EXECUTOR_ADDRESS` + `DEPLOYER_PRIVATE_KEY`
- Composition: `services/composition.ts` AND/OR over recent events

## Flare

- Coston2 chainId `114`, registry `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- Production path: FDC Payment + FTSO; MVP uses mock FDC with identical proof UX
- Local: `anvil` + `DeployLocal.s.sol` → see `deployments/local.json`
