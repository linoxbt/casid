# Casid — Flare Summer Signal Submission

## Project name
**Casid** — Verified Economic Event Fabric for Flare

## Selected bounty
**Primary:** Interoperable Asset Products  
**Secondary (architecture ready):** Confidential Compute Applications (FCC topic filters — roadmap)

## Short product description
Casid is infrastructure, not a dApp. It turns Flare’s enshrined **FDC** attestations (XRP/BTC/DOGE payments, AddressValidity, Web2Json) and **FTSO** prices into durable **attested topics** that developers subscribe to — like Kafka + Stripe webhooks, but every event is cryptographically verified multi-chain economic truth.

Developers define topics such as:

```
topic://payment/xrp/{destination}
topic://ftso/price/XRP-USD/threshold/gte/0.50
topic://composition/and/{payment}+{ftso}
```

Casid verifies proofs, delivers **HMAC-signed webhooks**, and optionally fires **on-chain triggers** via `TriggerExecutor`.

## Target user
- Protocol engineers building XRPFi / BTCfi products on Flare  
- Agent platforms that need proof-gated settlement signals  
- Fintechs that need attested multi-chain payment events without running their own oracle stack  

## Demo
| Surface | URL / command |
|---------|----------------|
| Console | `http://localhost:3100` |
| API health | `GET http://localhost:4100/health` |
| One-click demo | `POST http://localhost:4100/v1/demo/run` |
| Live FDC prepare | `POST http://localhost:4100/v1/fdc/live/address-validity` |
| Architecture | `http://localhost:3100/docs` |

### Demo script (90 seconds)
1. Open Console → **Run end-to-end demo**  
2. Show verified XRP payment event + `proofHash` + webhook signature  
3. Topics page → inspect FDC pipeline for payment topic  
4. Events page → payload + HMAC delivery  
5. `curl /v1/meta` → live Coston2 **FtsoV2 / FdcHub / FdcVerification / Relay** from Flare Contract Registry  
6. `curl /v1/fdc/live/address-validity` → real Flare verifier `prepareRequest` (`status: VALID` + `abiEncodedRequest`)  
7. Architecture page → why this is irreplaceable on Flare  

## GitHub / technical materials
Monorepo: `/root/casid` (publish to GitHub before DoraHacks upload)

```
apps/web            Next.js console
apps/coordinator    Hono API + SQLite + FDC/FTSO
packages/core       Topic DSL, webhook crypto
contracts/          Foundry: TopicRegistry, ProofVerifier, SubscriptionHub, TriggerExecutor
deployments/        local.json (+ coston2.json after deploy)
```

## How the project uses Flare

| Primitive | Casid use |
|-----------|-----------|
| **FDC Payment** | Core leaf topics for XRP/BTC/DOGE economic events |
| **FDC AddressValidity** | Live verifier path implemented (`/v1/fdc/*`) |
| **FDC Web2Json** | Topic kind + pipeline (testnet) |
| **FTSOv2** | Price-threshold topics + composition; live feed read via registry |
| **FAssets** | Lifecycle topics (`topic://fasset/mint/FXRP`) + settlement credits roadmap |
| **Flare Contract Registry** | Dynamic resolution of FtsoV2, FdcHub, FdcVerification, Relay |
| **FCC (roadmap)** | Confidential topic filters / private destinations |

**Why not another chain:** Only Flare enshrines non-EVM Payment attestation + FTSO under one economic security domain.

## What was newly built during the program
Greenfield for Summer Signal:

- Attested Topic primitive (URI scheme + on-chain registry + compositions)  
- ProofVerifier with anti-replay + mock/live FDC adapter  
- TriggerExecutor proof-gated execution + FTSO threshold path  
- Coordinator with SQLite persistence, HMAC webhooks, composition evaluator  
- Live FDC verifier integration (prepare + submit + DA proof polling)  
- Next.js product console + architecture narrative  
- Local anvil deploy with verified on-chain `TriggerFired`  

## Smart contract addresses

### Coston2 (primary demo network) ✅ deployed

| Contract | Address | Explorer |
|----------|---------|----------|
| **TopicRegistry** | `0xe132a226382E3A872d558c8c576f0aaeF864bE7C` | [view](https://coston2-explorer.flare.network/address/0xe132a226382E3A872d558c8c576f0aaeF864bE7C) |
| **ProofVerifier** | `0x787c170ad57D650D2BeE947A25c22F677B22bd87` | [view](https://coston2-explorer.flare.network/address/0x787c170ad57D650D2BeE947A25c22F677B22bd87) |
| **SubscriptionHub** | `0xAd5dD33d2F753891A18A970361C81a87c401f31d` | [view](https://coston2-explorer.flare.network/address/0xAd5dD33d2F753891A18A970361C81a87c401f31d) |
| **TriggerExecutor** | `0x29e1f57044ce6C22Db362222e4a66da78F5acd3e` | [view](https://coston2-explorer.flare.network/address/0x29e1f57044ce6C22Db362222e4a66da78F5acd3e) |
| MockFdcVerification | `0xc9442a9542e4A931bc2bA207b31B98EA57C4a53B` | — |
| MockFtsoV2 | `0xFBAD05CFcF1329fBCe5B9d95e618Ebe5A6d23853` | — |

**Deployer:** `0x367d3177F6dDe0B759F39Ba1430a4c14E98d2476`  
**Demo `fireWithProof` tx:** [`0xa975da7f…4614de2f`](https://coston2-explorer.flare.network/tx/0xa975da7f94beb030dae88c847768bceb78d73e5bd1075ac80b3c97e74614de2f)  
**Live FDC `requestAttestation`:** [`0xdcc4fb6e…a3e5e098`](https://coston2-explorer.flare.network/tx/0xdcc4fb6e9d23b6075c4514c17cdb2407388c7ddb799a81d083a705dea3e5e098) (AddressValidity → FdcHub, voting round **1402793**, **DA proof retrieved**)  
**Source verification:** ✅ All 6 contracts verified on Coston2 explorer (solc 0.8.25, optimizer 200)

Full map: `deployments/coston2.json`

### Local anvil (dev)
See `deployments/local.json`.

## Roadmap
| Horizon | Milestone |
|---------|-----------|
| Hackathon+2w | Coston2 main demo deploy, public webhook SLA, design partners |
| 6 months | Live FDC Payment continuous watchers, paid topics, enterprise dashboard |
| 1 year | Mainnet, FAssets lifecycle topics, decentralized coordinators |
| 3–10 years | Default multi-chain economic event plane (DNS-like infrastructure) |

## Evidence of technical execution
- `forge test` — 7/7 passing  
- `@casid/core` unit tests — topic URI DSL  
- Live Coston2 registry resolution in `/v1/meta`  
- Live FDC verifier prepareRequest returns `VALID`  
- Anvil on-chain trigger with event logs  

## Network
- Development: Coston2 (chainId 114) + local anvil  
- Production target: Flare Mainnet (chainId 14)
