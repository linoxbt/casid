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

## On-chain verification: LIVE ✅ (2026-08-11)

`ProofVerifier.mockMode` has been flipped to `false`. On-chain proof
consumption now verifies real FDC Merkle proofs via the real
`FdcVerification` contract, and `TriggerExecutor.fireFtsoThreshold` reads the
real `FtsoV2` feed — both legs of "Live FDC E2E" are now genuinely live, not
just the off-chain prepare/DA-proof pipeline above. Flipped via
`contracts/script/SetLive.s.sol` using the original deployer/owner key:

- `ProofVerifier.setFdcVerification(0x906507E0…)`: [`0x5c599aad…`](https://coston2-explorer.flare.network/tx/0x5c599aad36e6b34dc1f0215e56c67085ca59a228650b05eb4c7a9cbb7c45a9ad)
- `ProofVerifier.setMockMode(false)`: [`0x07cba15a…`](https://coston2-explorer.flare.network/tx/0x07cba15af31b000600f15f33553c115ad2f818af50e29901857e697d6157f45a)
- `TriggerExecutor.setFtsoV2(0xC4e9c78E…)`: [`0x6402c192…`](https://coston2-explorer.flare.network/tx/0x6402c192137929a07c3698e1085cdb7bfe978bc49a740c997c809190031ba327)

Full detail in `deployments/coston2.json`'s `onChainVerification` block.
Verify anytime with `cast call <ProofVerifier> "mockMode()(bool)" --rpc-url coston2` (expect `false`), or via the coordinator's
`GET /health` (`onChainVerification: "live"`).

## Next (optional)
1. Push GitHub public repo
2. Vercel deploy of `apps/web`
3. Continuous Payment topic watchers for real XRPL txs
4. Design partner outreach for XRPFi teams
