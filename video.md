# Casid — 3-Minute Demo Video Script

**Run time:** ~3:00
**Format:** Screen recording + voiceover (VO). Timestamps are targets, not hard cuts — pace to the screen action.
**Live URL:** https://casid.netlify.app · **Coordinator:** https://casid-production.up.railway.app · **Network:** Flare Coston2

---

## 0:00–0:15 — Hook

**SCREEN:** Landing page (`/`), hero in view.

**VO:**
> Every chain has its own idea of "a payment happened." Flare is the only one that lets you prove it — cryptographically, across XRP, Bitcoin, Dogecoin, and price feeds — under one economic security domain. Casid turns that proof into infrastructure developers can actually build on.

---

## 0:15–0:35 — What Casid is

**SCREEN:** Scroll landing page through the "How it works" flow (Payment sent → Flare verifies → Unlocked) and the topic examples section.

**VO:**
> Casid is a verified economic event fabric for Flare. You define a typed topic — a payment address, a price threshold — and Casid does the rest: verify the proof through Flare's FDC and FTSO, then fan it out as a signed webhook or an on-chain trigger. Think Kafka plus Stripe webhooks, except every event is backed by a real cryptographic attestation, not a guess.

---

## 0:35–1:00 — Into the console

**SCREEN:** Click "Launch app" → Dashboard (`/app`). Point out the live status badge, stat cards (Network, Verified events, Delivered webhooks, Pending), and the sidebar.

**VO:**
> This is the console. Live status, verified event counts, delivery health — all reading straight off the Coston2 testnet deployment, not mock data. Everything here maps to one of four primitives: Unlock, Topics, Verify, and Events.

---

## 1:00–1:45 — Unlock: the flagship flow

**SCREEN:** Navigate to Unlock (`/app/unlock`). Create a gate: pick XRP, paste a receiving address, type a secret message, hit "Create gate." Copy the generated pay-link. Open it in a new tab (`/app/unlock/pay`), paste a real testnet transaction id, submit.

**VO:**
> Here's the clearest way to feel what Casid does. I create a gate: any XRP payment to this address unlocks this message. That's it — no backend code, no custom oracle. Casid just registered a typed topic behind the scenes.
>
> Now, as the payer: I paste the transaction id. Casid calls Flare's Data Connector, verifies the payment really happened on the XRP Ledger, and only then — reveals the secret. Watch the badge: "Verified by Flare." That's not decoration. That proof is real, and if the transaction fires on-chain, you can click straight through to the Coston2 explorer and see it.

---

## 1:45–2:20 — Topics, Verify, and real proofs

**SCREEN:** Topics page — show the registered topic, its attestation pipeline. Then Verify page — switch through the tabs (Payment proof / FTSO threshold / Composition / Address validity), submit an FTSO threshold check live.

**VO:**
> Every topic has a pipeline you can inspect — exactly which Flare primitive verifies it, step by step. And Verify is where you test any of the four proof types directly: a payment, an FTSO price threshold, a boolean composition of two topics, or a raw address-validity check against Flare's live testnet verifier. No mocks anywhere in this path — this is the same code hitting the same infrastructure production traffic would hit.

---

## 2:20–2:45 — Wallet-signed, on-chain, and verifiable

**SCREEN:** Click "Connect wallet" in the top bar — open the Reown modal, connect. Point at the network pill ("Coston2 · 114"). Go to Events, show a delivered webhook. Click through on a **payment** event's proof link specifically (not an FTSO one — see note below) to the Coston2 explorer.

**VO:**
> Wallet connect is built on Reown, so it works with any injected wallet or WalletConnect-compatible app on mobile — not just one browser extension. Once connected, you can sign topic registration yourself instead of relying on Casid's relay key. And a payment event's proof isn't just a claim — click through and you're looking at the actual on-chain trigger transaction on the Coston2 explorer. Nothing here asks you to trust us.

---

## 2:45–3:00 — Close

**SCREEN:** Back to landing page, "Verify it yourself" section showing the four deployed contract addresses.

**VO:**
> TopicRegistry, ProofVerifier, SubscriptionHub, TriggerExecutor — all deployed, all source-verified on Coston2. Casid is infrastructure for anyone building XRPFi, BTCfi, or agent-driven settlement on Flare, and it's live today. Try it at casid dot netlify dot app.

**[END CARD: casid.netlify.app · github.com/linoxbt/casid]**

---

## Notes for the recorder

- Have a real Coston2 testnet XRP transaction id ready before recording the Unlock segment (Casid does not accept fabricated tx ids — the FDC verification is real).
- If a wallet extension isn't installed in the recording environment, the Reown modal still opens and shows the WalletConnect QR path — that's fine to show instead of a full connect.
- Keep cuts on scene boundaries only; mid-sentence cuts will fight the VO pacing above.
- **Known limitation, do not demo this:** on-chain trigger firing (`fireOnChain: true`) only works for Payment-type proofs right now. FTSO threshold events verify and deliver correctly (real price, real proofHash, real webhook), but firing one on-chain reverts (`ProofVerifier.UnsupportedAttestationType` — see STATUS.md). If demoing Verify's FTSO tab, don't click through to an explorer link for that event; use a payment event for the on-chain proof.
- Demo topics/subscriptions/events were seeded live on the coordinator (7 topics across all 4 kinds, 5 subscriptions, a couple of real verified FTSO events) so Topics/Events/dashboard aren't empty — but the coordinator has no persistent storage (ephemeral container filesystem), so a redeploy between now and recording will wipe it back to 2 seed topics. Check `GET https://casid-production.up.railway.app/health` right before recording; if counts are back to `2/0/0/0`, ask to have it reseeded.
