# Casid — Flare Summer Signal Submission

## Project name
**Casid** — Verified Economic Event Fabric for Flare

## Selected bounty
**Primary:** Interoperable Asset Products  
**Secondary (architecture ready):** Confidential Compute Applications (FCC topic filters — roadmap)

## Vision
Building on XRP, BTC, or DOGE payments means trusting an indexer's claim, not cryptographic proof. Flare enshrines real payment attestation and price data, but consuming it raw is a real barrier. Casid turns it into verified webhooks and on-chain triggers.

## Short product description
Casid is infrastructure, not a dApp. It turns Flare’s enshrined **FDC** attestations (XRP/BTC/DOGE payments, AddressValidity, Web2Json) and **FTSO** prices into durable **attested topics** that developers subscribe to — like Kafka + Stripe webhooks, but every event is cryptographically verified multi-chain economic truth.

Developers define topics such as:

```
topic://payment/xrp/{destination}
topic://ftso/price/XRP-USD/threshold/gte/0.50
topic://composition/and/{payment}+{ftso}
```

Casid verifies proofs, delivers **HMAC-signed webhooks**, and optionally fires **on-chain triggers** via `TriggerExecutor`.

## Detailed description

Casid is infrastructure for verified economic events on Flare — not a dApp, not a wallet, not an indexer. It turns Flare's enshrined attestation primitives (the Flare Data Connector for non-EVM payments, FTSOv2 for live price data) into a developer-facing platform: define a typed **attested topic**, and Casid handles the entire verification pipeline, then delivers the result as a signed webhook or an on-chain trigger. The mental model is deliberately familiar — Kafka-style topics plus Stripe-style signed webhooks — except every event Casid fans out is backed by a real cryptographic attestation or a live on-chain read, never an indexer's best guess.

**The problem.** Products built around XRP, Bitcoin, or Dogecoin payments — or that need to react to live price movement — have exactly two options today: run their own indexing/oracle infrastructure (expensive, security-critical, easy to get subtly wrong), or trust a third party's claim with no cryptographic backing. Flare is the only chain that enshrines real, verifiable attestation for exactly this problem, but consuming FDC and FTSOv2 directly means every team re-implements attestation-request preparation, voting-round polling, Merkle proof retrieval, and on-chain proof consumption from scratch. That's a serious integration tax standing between Flare's infrastructure and the builders who'd actually use it.

**How it works.** A topic is a URI — `topic://payment/xrp/{destination}`, `topic://ftso/price/XRP-USD/threshold/gte/0.50`, or a boolean composition of either — registered on-chain via `TopicRegistry`. Submitting a real transaction id (for payments) or requesting a live threshold check (for FTSO) runs the actual Flare verification: FDC's prepare → submit → DA-layer-proof-polling flow for payments, or a direct `FtsoV2` read for price thresholds. Once verified, `ProofVerifier` and `TriggerExecutor` record the event on-chain and Casid's coordinator fans out an HMAC-signed webhook (Stripe-style, `X-Casid-Signature: t={unix},v1={hex}`) to every subscriber, with automatic retries.

**What was built during the program.** The full stack was built greenfield for Flare Summer Signal: the topic URI DSL and on-chain registry (`TopicRegistry`, `ProofVerifier`, `SubscriptionHub`, `TriggerExecutor` — Foundry, source-verified on Coston2), the live FDC integration (real prepare/submit/DA-proof flow, not mocked), the FTSOv2 threshold path with correct feed-id encoding and a real on-chain firing entrypoint, the HMAC webhook fan-out system, a continuous XRPL payment watcher, and a full Next.js console (dashboard, topic/event/subscription management with on-chain-status badges and detail pages, a live proof-testing surface, and an Unlock flow that gates arbitrary content behind a real, Flare-verified payment).

**Current status.** Live on Coston2 (chain id 114), fully off mock mode: `ProofVerifier`, `TriggerExecutor`, `TopicRegistry`, and `SubscriptionHub` are deployed and source-verified, with real FDC Merkle-proof consumption and real FTSOv2-threshold on-chain firing confirmed against live transactions on the explorer. The coordinator runs on Railway with persistent storage; the console is on Netlify with wallet connect via Reown/WalletConnect (injected + QR).

**Next steps.** On-chain live attestation for FAsset lifecycle and EVM-transaction topics, Flare Confidential Compute topic filters (private destinations), and Postgres-backed storage for production write volume beyond the current testnet demo scale.

## Target user
- Protocol engineers building XRPFi / BTCfi products on Flare  
- Agent platforms that need proof-gated settlement signals  
- Fintechs that need attested multi-chain payment events without running their own oracle stack  

## Demo
**Live app:** https://casid.netlify.app · **Coordinator API:** https://casid-production.up.railway.app

| Surface | URL / command |
|---------|----------------|
| Landing | https://casid.netlify.app |
| App console | https://casid.netlify.app/app |
| Unlock (pay-gated content demo) | https://casid.netlify.app/app/unlock |
| Docs (full API + topic reference) | https://casid.netlify.app/app/docs |
| API health | `GET https://casid-production.up.railway.app/health` |
| FDC Payment attestation | `POST https://casid-production.up.railway.app/v1/attest/payment` |
| Live FDC prepare | `POST https://casid-production.up.railway.app/v1/fdc/live/address-validity` |

Local dev (`bun run dev:all`) still works identically against `localhost:3100`/`:4100` — see `AGENTS.md`.

### Walkthrough
Full scene-by-scene demo script: [`video.md`](./video.md). Short version:
1. Landing → Launch app → Unlock → create a gate, pay it for real, watch it unlock live ("Verified by Flare")  
2. Topics/Events pages → every record shows on-chain/off-chain status and links to a full detail page with proof hash, event commitment, and deliveries  
3. Verify page → submit a real payment proof, FTSO threshold, composition, or address-validity check directly  
4. `curl /v1/meta` → live Coston2 **FtsoV2 / FdcHub / FdcVerification / Relay** from Flare Contract Registry  
5. Docs page → full API reference, topic URI reference, and an honest "Known limitations" section  

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
- ProofVerifier with anti-replay + FDC adapter, decoding the real Flare `IPayment.Proof` struct  
- TriggerExecutor proof-gated execution + a real on-chain FTSO-threshold firing path (`fireFtsoThreshold`)  
- Coordinator with persistent SQLite (Railway volume), HMAC webhooks, composition evaluator, continuous XRPL payment watcher  
- Live FDC verifier integration (prepare + submit + DA proof polling)  
- Next.js console: dashboard, Topics/Events with on-chain-status badges and per-record detail pages, a 4-mode Verify surface, and Unlock (pay-gated content, verified by Flare, not a claim)  
- Wallet connect via Reown/WalletConnect (injected + QR), chain-specific address validation (rejects EVM addresses in XRP/BTC/DOGE fields, catches address-as-tx-id mistakes before they hit the verifier)  
- Comprehensive docs page: full API + topic URI reference, webhook HMAC verification code sample, and an honest "Known limitations" section  
- CI (GitHub Actions: bun tests, `forge test`, web lint+build) and a live Netlify + Railway deployment, not just local  

## Smart contract addresses

### Coston2 ✅ deployed

| Contract | Address | Explorer |
|----------|---------|----------|
| **TopicRegistry** | `0xe132a226382E3A872d558c8c576f0aaeF864bE7C` | [view](https://coston2-explorer.flare.network/address/0xe132a226382E3A872d558c8c576f0aaeF864bE7C) |
| **ProofVerifier** | `0x3f800eeE8f1b4e0c6FCD90ce70BC3aB581151Ffc` | [view](https://coston2-explorer.flare.network/address/0x3f800eeE8f1b4e0c6FCD90ce70BC3aB581151Ffc) |
| **SubscriptionHub** | `0xAd5dD33d2F753891A18A970361C81a87c401f31d` | [view](https://coston2-explorer.flare.network/address/0xAd5dD33d2F753891A18A970361C81a87c401f31d) |
| **TriggerExecutor** | `0x50622392654467D6ebb544A74215B655e812C9Fd` | [view](https://coston2-explorer.flare.network/address/0x50622392654467D6ebb544A74215B655e812C9Fd) |
| MockFdcVerification | `0xc9442a9542e4A931bc2bA207b31B98EA57C4a53B` | — |
| MockFtsoV2 | `0xFBAD05CFcF1329fBCe5B9d95e618Ebe5A6d23853` | — |

`ProofVerifier`/`TriggerExecutor` were redeployed on 2026-08-13 to fix a real
bug: the original `IFdcVerification.verifyPayment` took raw `bytes`, but the
real Flare `FdcVerification` contract's actual ABI takes a typed
`IPayment.Proof` struct — on-chain proof consumption would have reverted.
`ProofVerifier` now `abi.decode`s the proof into the correct struct before
calling the real verifier (`contracts/src/ProofVerifier.sol`), covered by two
new Foundry tests exercising the real, non-mock verification path.
`TopicRegistry`/`SubscriptionHub` are unaffected and unchanged. Superseded
addresses: `ProofVerifier` `0x787c170a…`, `TriggerExecutor` `0x29e1f570…`.

**Deployer:** `0x367d3177F6dDe0B759F39Ba1430a4c14E98d2476`  
**Historical `fireWithProof` tx:** [`0xa975da7f…4614de2f`](https://coston2-explorer.flare.network/tx/0xa975da7f94beb030dae88c847768bceb78d73e5bd1075ac80b3c97e74614de2f)  
**Live FDC `requestAttestation`:** [`0xdcc4fb6e…a3e5e098`](https://coston2-explorer.flare.network/tx/0xdcc4fb6e9d23b6075c4514c17cdb2407388c7ddb799a81d083a705dea3e5e098) (AddressValidity → FdcHub, voting round **1402793**, **DA proof retrieved**)  
**Source verification:** ✅ All contracts verified on Coston2 explorer (solc 0.8.25, optimizer 200)

Full map: `deployments/coston2.json`

### Local anvil (dev)
See `deployments/local.json`.

## Roadmap
| Horizon | Milestone |
|---------|-----------|
| Hackathon+2w | Coston2 deployment, public webhook SLA, design partners |
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
