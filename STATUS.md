# Casid status (2026-07-22)

## Live on Coston2
- Contracts deployed + **source verified** (solc 0.8.25, opt 200)
- `deployments/coston2.json`
- Demo `fireWithProof` txs on explorer

## Local services
- Coordinator: http://localhost:4100
- Console: http://localhost:3100 (restart `bun run dev:web` if contracts page missing)
- SQLite: `./data/casid.db`

## Commands
```bash
bun run demo
bun run deploy:coston2   # already done
bash scripts/verify-coston2.sh
```

## Secrets
- Deployer key: `/root/.casid/deployer.json` (not in git)
- `.env` local only

## Live FDC E2E ✅
- prepareRequest → VALID
- FdcHub.requestAttestation: [`0xdcc4fb6e…`](https://coston2-explorer.flare.network/tx/0xdcc4fb6e9d23b6075c4514c17cdb2407388c7ddb799a81d083a705dea3e5e098)
- Voting round 1402793
- DA Layer proof ready after ~80s

## Next (optional)
1. Push GitHub public repo
2. Vercel deploy of `apps/web`
3. Continuous Payment topic watchers for real XRPL txs
4. Design partner outreach for XRPFi teams
