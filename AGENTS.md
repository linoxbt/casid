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
- On-chain proof verification: gated by `ProofVerifier.mockMode` (owner-toggleable on-chain flag, not an env var). `mockMode=false` since 2026-08-11. As of 2026-08-13, `ProofVerifier`/`TriggerExecutor` were also redeployed (`contracts/script/RedeployFixed.s.sol`) to fix a real bug: `IFdcVerification.verifyPayment` took raw `bytes`, but the real Flare `FdcVerification` contract's actual ABI takes a typed `IPayment.Proof` struct — see `contracts/src/interfaces/IPayment.sol` and `STATUS.md`/`deployments/coston2.json` for the fix and tx hashes. `MockFdcVerification`/`MockFtsoV2` remain deployed but aren't referenced by the current `ProofVerifier`/`TriggerExecutor`.
- On-chain fire: `services/chain.ts` when `TRIGGER_EXECUTOR_ADDRESS` + `DEPLOYER_PRIVATE_KEY`
- Composition: `services/composition.ts` AND/OR over recent events

## Flare

- Coston2 chainId `114`, registry `0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019`
- Production path: FDC Payment + FTSO — both the off-chain prepare/DA-proof calls and on-chain proof consumption are genuinely live against Flare testnet infra (see above)
- Local: `anvil` + `DeployLocal.s.sol` → see `deployments/local.json`

## Deployment

- Coordinator: Railway (project `noble-achievement`, service `casid`, GitHub-connected to `linoxbt/casid` branch `main`) — https://casid-production.up.railway.app. Build/start are overridden on the service (not the `package.json` scripts) since Railway injects env vars natively and doesn't have the repo's `.env`: build `bun install && bun run --filter @casid/core build`, start `cd apps/coordinator && bun run src/index.ts`. Listens on `COORDINATOR_PORT` (set to `8080` on Railway; domain's `targetPort` matches). `NODE_ENV=production` + `CASID_API_KEY` gate mutating `/v1/*` routes so the public URL can't be used to drain the deployer key's gas.
- Web: Netlify, per `netlify.toml` (builds from repo root for Bun workspace resolution). `NEXT_PUBLIC_COORDINATOR_URL` must point at the Railway domain above, and `NEXT_PUBLIC_CASID_API_KEY` must match the coordinator's `CASID_API_KEY` — both are set in the Netlify UI (Site configuration → Environment variables), not in `netlify.toml`, since `NEXT_PUBLIC_*` is inlined at build time.
- GitHub autodeploy was found disabled on the Railway service (silent — pushes to `main` didn't trigger new deployments, which was the real cause of prior "Failed to fetch" reports, not a Railway account limit). Check it's enabled before assuming a push will go live.
