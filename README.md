# Casid

**Verified Economic Event Fabric for Flare.**

> Kafka + Stripe Webhooks for multi-chain economic truth — powered by Flare’s enshrined FDC, FTSO, and FAssets.

Casid is infrastructure, not another DeFi dashboard. Developers define **attested topics** (`topic://payment/xrp/...`, `topic://ftso/price/...`, compositions). Casid continuously attests economic facts, verifies proofs, and delivers **proof-gated** webhooks and on-chain triggers.

Built for the [Flare Summer Signal](https://dorahacks.io/hackathon/flaresummersignal/detail) hackathon — designed to still matter in 2035.

---

## Why Flare

| Primitive | Role in Casid |
|-----------|----------------|
| **FDC Payment** | Attest XRP / BTC / DOGE payments as first-class topics |
| **FTSOv2** | Price-threshold topics & composition conditions |
| **FAssets** | Lifecycle topics + settlement/credits for paid subscriptions |
| **FCC** (roadmap) | Confidential topic filters / private destinations |
| **Smart Accounts** | XRPL-native operators without FLR UX friction |

No other L1 gives you enshrined non-EVM payment attestation + prices under one security domain.

---

## Monorepo

```
casid/
├── apps/
│   ├── web/            # Next.js console (topics, events, architecture)
│   └── coordinator/    # Hono API: topics, attestations, HMAC webhooks
├── packages/
│   └── core/           # Topic DSL, webhook crypto, Flare constants
└── contracts/          # Foundry: TopicRegistry, ProofVerifier, Hub, Executor
```

---

## Quick start

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.1
- [Foundry](https://book.getfoundry.sh) (`forge`, `anvil`)

### Install

```bash
cd casid
bun install
```

### Contracts

```bash
cd contracts
forge test

# Local anvil
anvil --port 8545
forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --broadcast -vv

# Export ABIs for TS
bun run export:abis
```

See `deployments/local.json` for a sample anvil address map.

### Coordinator + web

```bash
# terminal 1
bun run dev:coordinator   # SQLite at ./data/casid.db

# terminal 2
bun run dev:web
```

- Console: http://localhost:3100  
- API: http://localhost:4100/health  
- Meta (live Flare registry): `GET http://localhost:4100/v1/meta`

Copy `.env.example` → `.env` as needed. For on-chain fire after local deploy:

```bash
export TRIGGER_EXECUTOR_ADDRESS=0xa513E6E4b8f2a923D98304ec87F64353C4D5C853
export DEPLOYER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
export FLARE_RPC_URL=http://127.0.0.1:8545
export FLARE_CHAIN_ID=31337
```

---

## Topic URI scheme

```
topic://payment/{xrp|btc|doge}/{destination}
topic://ftso/price/{FEED}/threshold/{gt|gte|lt|lte|eq}/{value}
topic://web2json/{sourceId}/{jq}
topic://fasset/{mint|redeem}/{FXRP|FBTC|FDOGE}
topic://composition/{and|or}/...
```

Example composition (product vision):

> Fire when **XRP payment ≥ N** to destination **AND** **XRP/USD ≥ 0.50** on FTSO.

---

## API surface (coordinator)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness (default port **4100**) |
| GET | `/v1/meta` | Network + contract addresses |
| GET/POST | `/v1/topics` | List / register topics |
| GET/POST | `/v1/subscriptions` | Webhook subscriptions |
| POST | `/v1/attest/payment` | Live FDC Payment request + DA proof + fan-out + optional on-chain fire |
| POST | `/v1/attest/ftso` | Live FTSO threshold cross |
| POST | `/v1/composition/evaluate` | AND/OR composition against recent events |
| GET | `/v1/ftso/:feed` | Live FTSO read via Flare registry |
| GET | `/v1/events` | Verified events (SQLite) |
| GET | `/v1/deliveries` | Webhook delivery log |

Webhooks are signed:

```
X-Casid-Signature: t={unix},v1={hmac_sha256_hex}
```

Payload body is signed as `{t}.{body}` (Stripe-style).

---

## Smart contracts

| Contract | Responsibility |
|----------|----------------|
| `TopicRegistry` | Topic IDs, schema hashes, AND/OR compositions |
| `ProofVerifier` | FDC verify + `usedProof` anti-replay |
| `SubscriptionHub` | Subscribers, webhook commits, credits |
| `TriggerExecutor` | `fireWithProof` / `fireFtsoThreshold` → `TriggerFired` + optional call |

All covered by `forge test` (7 tests).

---

## Security

- Proof hashes are single-use on-chain  
- Webhook HMAC + timestamp tolerance  
- Topic schemas hashed on registration  
- No private keys in the web app  

---

## Roadmap

| Horizon | Milestone |
|---------|-----------|
| Current | Topic DSL, live FDC request flow, dashboard, Coston2 deploy |
| 6 months | Live FDC rounds, Postgres, enterprise webhooks, design partners |
| 1 year | Mainnet, FAssets lifecycle topics, paid SLAs |
| 3 years | Decentralized coordinators, Attested Topic standard |
| 10 years | Invisible multi-chain economic event plane |

---

## Live FDC (Coston2 verifiers)

```bash
# Real Flare verifier prepareRequest (no gas)
curl -X POST http://localhost:4100/v1/fdc/live/address-validity \
  -H 'content-type: application/json' \
  -d '{"address":"rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe","submit":false}'

# Full submit to FdcHub (needs C2FLR + DEPLOYER_PRIVATE_KEY)
curl -X POST http://localhost:4100/v1/fdc/live/address-validity \
  -H 'content-type: application/json' \
  -d '{"submit":true,"waitRounds":8}'
```

## Coston2 deploy

```bash
# 1) Fund deployer (see deployments/coston2.pending.json)
# 2) Deploy Casid contracts
bun run deploy:coston2
# 3) Start the web app and submit a real FDC Payment transaction id
bun run dev:web
```

## Hackathon submission notes

See **[SUBMISSION.md](./SUBMISSION.md)** for DoraHacks fields.

- **Track:** Interoperable Asset Products (primary)  
- **What is new:** Attested Topics + proof-gated delivery fabric on Flare  
- **Operator path:** Landing → Launch app → Submit FDC Payment tx → Verify FTSO threshold → Docs  
- **Existing work:** Greenfield for Summer Signal  

---

## License

MIT
