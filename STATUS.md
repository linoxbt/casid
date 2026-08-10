# Casid status (2026-07-22)

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

The off-chain prepare/submit/DA-proof-fetch pipeline above is genuinely live
against Flare testnet infrastructure. The **on-chain** `ProofVerifier` deployed
at `deployments/coston2.json` still runs with `mockMode=true` — on-chain proof
consumption accepts any non-empty proof rather than verifying it. See "Going
live" below to flip that once you have a funded deployer key.

## Going live (flip on-chain verification off mock mode)

`ProofVerifier`/`TriggerExecutor` are owner-toggleable — no redeploy needed.
`contracts/script/SetLive.s.sol` calls `ProofVerifier.setFdcVerification(...)`,
`ProofVerifier.setMockMode(false)`, and `TriggerExecutor.setFtsoV2(...)` against
the real Coston2 `FdcVerification`/`FtsoV2` addresses. Requires a funded
Coston2 deployer key that is the current contract owner:

```bash
PROOF_VERIFIER_ADDRESS=0x787c170ad57D650D2BeE947A25c22F677B22bd87 \
TRIGGER_EXECUTOR_ADDRESS=0x29e1f57044ce6C22Db362222e4a66da78F5acd3e \
FDC_VERIFICATION_ADDRESS=0x906507E0B64bcD494Db73bd0459d1C667e14B933 \
FTSO_V2_ADDRESS=0xC4e9c78EA53db782E28f28Fdf80BaF59336B304d \
DEPLOYER_PRIVATE_KEY=0x... \
forge script script/SetLive.s.sol --rpc-url coston2 --broadcast
```

Not run yet — no deployer key is configured in this environment.

## Next (optional)
1. Push GitHub public repo
2. Vercel deploy of `apps/web`
3. Continuous Payment topic watchers for real XRPL txs
4. Design partner outreach for XRPFi teams
5. Run `contracts/script/SetLive.s.sol` once a funded deployer key is available
