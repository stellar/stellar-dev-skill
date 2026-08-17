---
name: agentic-payments
description: Agentic and machine-to-machine payments on Stellar. Covers x402 (HTTP 402 paid APIs via OZ Channels facilitator, fee-sponsored clients) and MPP (Machine Payments Protocol) in both Charge mode (per-request SAC) and Session mode (channel-backed off-chain commits, high-frequency; formerly called Channel mode). Defaults to USDC (SEP-41 SAC) on `stellar:testnet`/`stellar:pubnet` (CAIP-2). Use when selling a paid API to AI agents, building an x402 client, or designing a payment-channel architecture for high-frequency agent traffic.
user-invocable: true
argument-hint: "[payment task]"
---

# Agentic Payments: x402 + MPP

Two complementary protocols for AI-agent and machine-to-machine payments on Stellar. Pick based on who depends on whom and how often the agent pays.

## Quick decision

| | x402 | MPP Charge | MPP Session |
|--|------|------------|-------------|
| Per-request on-chain tx? | Yes (via facilitator) | Yes (SAC) | No (off-chain commits) |
| Needs facilitator? | Yes (OZ Channels) | No | No |
| Client needs XLM? | No (fees sponsored) | Optional (`feePayer`) | Yes |
| Setup complexity | Low | Low | Medium (deploy contract first) |
| Best for | Quickest setup, fee-free clients | No third-party dep | High-frequency agents |

- Selling an API, want zero-XLM clients → **x402 Seller** in [x402.md](x402.md)
- Calling an x402 API from an agent → **x402 Buyer** in [x402.md](x402.md)
- Selling an API, no facilitator dependency → **Charge mode** in [mpp.md](mpp.md)
- Agent making many requests per session → **Session mode** in [mpp.md](mpp.md)
- Unsure → x402 (lowest friction to get started)

All protocols use USDC (SEP-41 SAC) by default; `stellar:testnet` / `stellar:pubnet` CAIP-2 network IDs.

## Read the file that matches the task

This file carries the decision table, the shared testnet account setup, and the USDC address reference. The protocol playbooks live alongside it:

| Task | File |
|------|------|
| Sell a paid API via a facilitator (zero-XLM clients), build an x402 buyer agent | [x402.md](x402.md) |
| Facilitator-free per-request payments (Charge) or channel-backed sessions (Session) | [mpp.md](mpp.md) |
| Create/fund testnet accounts, add USDC trustlines, get testnet USDC | [Testnet setup](#testnet-setup-shared) (below) |
| Which USDC address goes where (classic issuer vs SAC) | [Two USDC addresses](#two-usdc-addresses-dont-confuse-them) (below) |

## Related skills
- The SACs the protocols call → `../smart-contracts/SKILL.md`
- USDC and other classic assets → `../assets/SKILL.md`
- Wallets and signing in the buyer client → `../dapp/SKILL.md`
- RPC simulation / submission patterns → `../data/SKILL.md`
- SEP-41 (token interface) and related standards → `../standards/SKILL.md`


## Testnet setup (shared)

Both protocols need the same base setup: a **client/payer** account (signs and pays from a USDC balance) and a **server/recipient** account. Both need a USDC trustline.

One step is web-only (Captcha) and cannot be scripted: the Circle USDC faucet. Everything else can be automated — [x402.md](x402.md) ships a `setup.js` that does steps 1–3 and writes a starter `.env`. (x402 additionally needs the web-only OZ Channels key generator; MPP needs no third-party key.)

1. **Generate two keypairs**
   ```bash
   node -e "const { Keypair } = require('@stellar/stellar-sdk'); for (const n of ['RECIPIENT','PAYER']) { const k = Keypair.random(); console.log(n, k.publicKey(), k.secret()); }"
   ```

2. **Fund both with testnet XLM (friendbot)**
   ```bash
   curl "https://friendbot.stellar.org?addr=RECIPIENT_G..."
   curl "https://friendbot.stellar.org?addr=PAYER_G..."
   ```

3. **Add a USDC trustline to BOTH accounts** — open [Stellar Lab](https://lab.stellar.org/account/fund?network=test) and add a USDC trustline to each `G...`, or run via SDK for each keypair:
   ```js
   import * as StellarSdk from "@stellar/stellar-sdk";

   const horizon = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
   // Circle's classic USDC issuer on Stellar testnet
   const USDC_ISSUER = "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5";

   async function addTrustline(secret) {
     const kp = StellarSdk.Keypair.fromSecret(secret);
     const acc = await horizon.loadAccount(kp.publicKey());
     const tx = new StellarSdk.TransactionBuilder(acc, {
       fee: StellarSdk.BASE_FEE,
       networkPassphrase: StellarSdk.Networks.TESTNET,
     })
       .addOperation(StellarSdk.Operation.changeTrust({
         asset: new StellarSdk.Asset("USDC", USDC_ISSUER),
       }))
       .setTimeout(60)
       .build();
     tx.sign(kp);
     return horizon.submitTransaction(tx);
   }

   // Repeat for both the recipient secret and the payer secret.
   await addTrustline(process.env.RECIPIENT_SECRET);
   await addTrustline(process.env.PAYER_SECRET);
   ```

   Without a trustline on the recipient, the SAC `transfer` settles into nothing and the request fails with `op_no_trust`.

4. **Fund the PAYER with testnet USDC** — open the [Circle testnet faucet](https://faucet.circle.com/), select **Stellar testnet**, paste the payer's `G...`. Web Captcha; no API.

## Two USDC addresses (don't confuse them)

USDC on Stellar has two addresses, used in different places. Mixing them up is a common stumble.

| Address | Format | Used for |
|---------|--------|----------|
| Classic asset issuer | `G...` (32-byte ed25519 public key) | The `issuer` of the classic USDC asset; used when adding a trustline (`new Asset("USDC", G...)`) |
| SAC (Stellar Asset Contract) | `C...` (32-byte contract address) | The contract the protocol invokes `transfer` on; used in payment requirements |

Use the exported constants instead of hard-coding when possible:

```js
import { USDC_TESTNET_ADDRESS, USDC_PUBNET_ADDRESS } from "@x402/stellar";
// USDC_TESTNET_ADDRESS = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA"
// USDC_PUBNET_ADDRESS  = "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75"
```

x402's `payTo` route config and MPP's `recipient` are always a classic account (`G...`). The SAC address only appears where the config names the settlement asset (x402's custom `asset` price config, MPP's `currency`).
