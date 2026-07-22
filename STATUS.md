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

## Next (optional)
1. Poll DA for live FDC proof after FdcHub submit
2. Push GitHub public repo
3. Vercel deploy of `apps/web`
4. Design partner outreach for XRPFi teams
