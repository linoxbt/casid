# Casid status (2026-08-11)

## Live on Coston2
- Contracts deployed + **source verified** (solc 0.8.25, opt 200)
- `deployments/coston2.json`
- Historical `fireWithProof` txs on explorer

## Local services
- Coordinator: http://localhost:4100
- Web: http://localhost:3100
- App console: http://localhost:3100/app
- SQLite: `./data/casid.db`

## Commands
```bash
bun run deploy:coston2   # already done
bash scripts/verify-coston2.sh
```

## Secrets
- Deployer key: `/root/.casid/deployer.json` (not in git)
- `.env` local only

## Live FDC E2E ✅ (off-chain leg)
- prepareRequest → VALID
- FdcHub.requestAttestation: [`0xdcc4fb6e…`](https://coston2-explorer.flare.network/tx/0xdcc4fb6e9d23b6075c4514c17cdb2407388c7ddb799a81d083a705dea3e5e098)
- Voting round 1402793
- DA Layer proof ready after ~80s

## On-chain verification: LIVE ✅ (2026-08-13, corrected)

**2026-08-11:** `ProofVerifier.mockMode` was flipped to `false` via
`contracts/script/SetLive.s.sol`, pointing at the real `FdcVerification` and
`FtsoV2` contracts.

**2026-08-13:** that flip alone wasn't sufficient — found and fixed a deeper
bug. `ProofVerifier`'s `IFdcVerification.verifyPayment` took raw `bytes`, but
the real deployed `FdcVerification` contract's actual ABI (confirmed against
its Blockscout-verified implementation,
[`0x6E33205…`](https://coston2-explorer.flare.network/address/0x6E33205293aE1C6dcC91249951A5A67C863918A7))
takes a typed `IPayment.Proof` struct. Any real on-chain proof consumption
would have reverted (wrong function selector) — invisible the whole time
mock mode was on, since mock mode never actually called the real verifier.

Fixed by redeploying `ProofVerifier` + `TriggerExecutor`
(`contracts/script/RedeployFixed.s.sol` — narrower than a full redeploy;
`TopicRegistry`/`SubscriptionHub`/`FtsoV2` are unaffected and reused as-is):

- New `ProofVerifier`: [`0x3f800eeE…`](https://coston2-explorer.flare.network/address/0x3f800eeE8f1b4e0c6FCD90ce70BC3aB581151Ffc) — `mockMode=false`, source-verified
- New `TriggerExecutor`: [`0x5062239…`](https://coston2-explorer.flare.network/address/0x50622392654467D6ebb544A74215B655e812C9Fd) — source-verified
- Superseded (do not use): old `ProofVerifier` `0x787c170a…`, old `TriggerExecutor` `0x29e1f570…`

Verified two ways:
1. Two new Foundry tests (`test_realVerificationDecodesPaymentProof`,
   `test_realVerificationRejectsUnsupportedType`) exercise the real,
   non-mock decode-and-verify path end-to-end against a constructed
   `IPayment.Proof`, not just mock mode.
2. Fresh `cast call` reads against the new contracts confirm `mockMode=false`,
   correct `fdcVerification`/`ftsoV2` wiring, and correct `consumer`.

Full detail in `deployments/coston2.json`'s `proofStructFix` block.

**Resolved:** the coordinator's proof-construction code
(`apps/coordinator/src/services/chain.ts`'s `encodePaymentProof`) ABI-encodes
the DA Layer's real response into `IPayment.Proof` and is wired into
`POST /v1/attest/payment` (`index.ts`) when `fireOnChain: true` is requested.
Both the off-chain FDC verification that gates Unlock's reveal and the
on-chain proof consumption are fully live end-to-end.

## Live deployment (2026-08-13)
- Coordinator: Railway project `noble-achievement`, service `casid` —
  https://casid-production.up.railway.app (`/health`, `/v1/meta`)
- Web: Netlify (`netlify.toml`, `apps/web`)
- GitHub autodeploy on the Railway service was found disabled (pushes to
  `main` weren't triggering redeploys) — that, not an account-wide limit,
  was the actual cause of "Failed to fetch" on the live site. Fixed by
  deploying the latest commit directly; re-enabling autodeploy is a pending
  manual follow-up in the Railway dashboard.

## Next (optional)
1. ~~Push GitHub public repo~~ — done (`github.com/linoxbt/casid`)
2. ~~Deploy `apps/web`~~ — done (Netlify)
3. Continuous Payment topic watchers for real XRPL txs
4. Design partner outreach for XRPFi teams
5. Re-enable Railway GitHub autodeploy for the coordinator service
