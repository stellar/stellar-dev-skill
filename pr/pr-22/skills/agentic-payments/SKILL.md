---
name: agentic-payments
description: Agentic and machine-to-machine payments on Stellar. Covers x402 (HTTP 402 paid APIs via OZ Channels facilitator, fee-sponsored clients) and MPP (Machine Payments Protocol) in both Charge mode (per-request Soroban SAC) and Channel mode (off-chain commits, high-frequency). Defaults to USDC (SEP-41 SAC) on `stellar:testnet`/`stellar:pubnet` (CAIP-2). Use when selling a paid API to AI agents, building an x402 client, or designing a payment-channel architecture for high-frequency agent traffic.
user-invocable: true
argument-hint: "[payment task]"
---

# Agentic Payments: x402 + MPP

Two complementary protocols for AI-agent and machine-to-machine payments on Stellar. Pick based on who depends on whom and how often the agent pays.

## Quick decision

| | x402 | MPP Charge | MPP Channel |
|--|------|------------|-------------|
| Per-request on-chain tx? | Yes (via facilitator) | Yes (Soroban SAC) | No (off-chain commits) |
| Needs facilitator? | Yes (OZ Channels) | No | No |
| Client needs XLM? | No (fees sponsored) | Optional (`feePayer`) | Yes |
| Setup complexity | Low | Low | Medium (deploy contract first) |
| Best for | Quickest setup, fee-free clients | No third-party dep | High-frequency agents |

- Selling an API, want zero-XLM clients → see **x402 Seller** below
- Calling an x402 API from an agent → see **x402 Buyer** below
- Selling an API, no facilitator dependency → see **MPP Charge** below
- Agent making many requests per session → see **MPP Channel** below
- Unsure → x402 (lowest friction to get started)

All protocols use USDC (SEP-41 SAC) by default; `stellar:testnet` / `stellar:pubnet` CAIP-2 network IDs.

## Related skills
- The Soroban SACs the protocols call → `../soroban/SKILL.md`
- USDC and other classic assets → `../assets/SKILL.md`
- Wallets and signing in the buyer client → `../dapp/SKILL.md`
- RPC simulation / submission patterns → `../data/SKILL.md`
- SEP-41 (token interface) and related standards → `../standards/SKILL.md`

---

# Part 1: x402 — Paid APIs + Agent Buyer Clients


## When to use x402
x402 is the right choice when:
- You want the fastest path to a paid API — minimal code, no contract deployment
- You want clients (including AI agents) to pay with **zero XLM** — the OZ Channels facilitator sponsors all network fees
- You're building on top of an existing x402 ecosystem (Coinbase, other chains)

Trade-off: you depend on OZ Channels (or a self-hosted relayer) for verification and settlement. If you need zero third-party dependency, use MPP Charge (Part 2 below) instead.

## How x402 works on Stellar

```
Client → GET /resource                               → Server
Client ← 402 Payment Required (payment requirements) ← Server
Client builds Soroban SAC USDC transfer
Client signs auth entries only (not the full tx envelope)
Client → GET /resource + X-PAYMENT header           → Server
Server → OZ Channels /verify + /settle              → Stellar (~5s)
Client ← 200 OK + resource
```

The key Stellar difference: clients sign **auth entries**, not full transaction envelopes. The facilitator assembles the transaction, pays fees, and submits. Clients need zero XLM.

## Seller: monetize an Express API

```bash
npm install @x402/express @x402/core @x402/stellar express dotenv
npm pkg set type=module
```

```js
// server.js
import express from "express";
import { paymentMiddlewareFromConfig } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { ExactStellarScheme } from "@x402/stellar/exact/server";

const app = express();

const facilitator = new HTTPFacilitatorClient({
  url: process.env.FACILITATOR_URL ?? "https://channels.openzeppelin.com/x402/testnet",
  // omit createAuthHeaders on testnet if you don't have an API key yet
  createAuthHeaders: process.env.OZ_API_KEY
    ? async () => {
        const h = { Authorization: `Bearer ${process.env.OZ_API_KEY}` };
        return { verify: h, settle: h, supported: h };
      }
    : undefined,
});

app.use(
  paymentMiddlewareFromConfig(
    {
      "GET /weather": {
        description: "Current weather data",
        // human-readable price string — auto-converts to USDC base units
        price: "$0.001",
        network: "stellar:testnet",
        payTo: process.env.STELLAR_RECIPIENT, // your G... address
      },
    },
    { facilitator, schemes: [ExactStellarScheme] }
  )
);

app.get("/weather", (_req, res) => {
  res.json({ city: "San Francisco", temp: 18, conditions: "Foggy" });
});

app.listen(3001, () => console.log("x402 server on http://localhost:3001"));
```

**Env vars:**
- `STELLAR_RECIPIENT` — your G... address (receives USDC)
- `OZ_API_KEY` — OZ Channels API key (optional on testnet, required on mainnet)
- `FACILITATOR_URL` — defaults to testnet URL above

**Price format options:**
- `"$0.001"` — human-readable, auto-converts to 7-decimal USDC units
- `{ amount: "1000", asset: "ASSET_SAC_CONTRACT_ID" }` — explicit base units for non-USDC assets

## Buyer: agent client

```bash
npm install @x402/fetch @x402/stellar @stellar/stellar-sdk dotenv
npm pkg set type=module
```

```js
// client.js
import { x402HTTPClient } from "@x402/fetch";
import { createEd25519Signer, getNetworkPassphrase } from "@x402/stellar";
import { ExactStellarScheme } from "@x402/stellar/exact/client";
import * as StellarSdk from "@stellar/stellar-sdk";

const keypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);
const network = "stellar:testnet";

// createEd25519Signer wraps the keypair for auth-entry signing
const signer = createEd25519Signer(keypair, getNetworkPassphrase(network));

// x402HTTPClient wraps fetch — handles 402 negotiation transparently
const client = x402HTTPClient({ signer, schemes: [ExactStellarScheme] });

const res = await client.fetch("http://localhost:3001/weather");
console.log(await res.json());
// Paid automatically: 402 negotiation + auth-entry signing happens under the hood
```

**Env vars:**
- `STELLAR_SECRET_KEY` — your S... secret key (needs USDC trustline + balance)

## Testnet runbook

1. **Generate a keypair**
   ```bash
   node -e "const { Keypair } = require('@stellar/stellar-sdk'); const kp = Keypair.random(); console.log('Public:', kp.publicKey()); console.log('Secret:', kp.secret());"
   ```

2. **Fund with testnet XLM**
   ```bash
   curl "https://friendbot.stellar.org?addr=YOUR_PUBLIC_KEY"
   ```

3. **Add USDC trustline** — open [Stellar Lab](https://laboratory.stellar.org/#account-creator?network=test), or via SDK:
   ```js
   import * as StellarSdk from "@stellar/stellar-sdk";

   const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
   const keypair = process.env.STELLAR_SECRET_KEY
     ? StellarSdk.Keypair.fromSecret(process.env.STELLAR_SECRET_KEY)
     : StellarSdk.Keypair.random();

   const account = await server.loadAccount(keypair.publicKey());
   const tx = new StellarSdk.TransactionBuilder(account, {
     fee: "100",
     networkPassphrase: StellarSdk.Networks.TESTNET,
   })
     .addOperation(
       StellarSdk.Operation.changeTrust({
         asset: new StellarSdk.Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"),
       }),
     )
     .setTimeout(30)
     .build();
   tx.sign(keypair);
   await server.submitTransaction(tx);
   ```

4. **Get testnet USDC** — use the [Circle testnet faucet](https://faucet.circle.com/) (select Stellar testnet)

5. **Get an OZ Channels testnet API key** (optional for testnet, required for mainnet):
   - Testnet: [channels.openzeppelin.com/testnet/gen](https://channels.openzeppelin.com/testnet/gen)
   - Mainnet: [channels.openzeppelin.com/gen](https://channels.openzeppelin.com/gen)

## Mainnet checklist

| Config | Value |
|--------|-------|
| Network ID | `stellar:pubnet` |
| RPC URL | Provider-specific endpoint (see [Stellar RPC providers directory](https://developers.stellar.org/docs/data/apis/rpc/providers)) |
| Facilitator URL | `https://channels.openzeppelin.com/x402` |
| USDC SAC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` |
| Funding | Real USDC on mainnet (CEX, DEX, or bridge) |

Always test on testnet first. Switch by changing `network` and `FACILITATOR_URL`.

## Key concepts

**Auth entry signing** — On Stellar, x402 clients sign Soroban authorization entries, not full transaction envelopes. The facilitator assembles the complete transaction. This is lighter than EVM/Solana signing, and means clients never need to manage sequence numbers or pay fees.

**Fee sponsorship** — OZ Channels pays all Stellar network fees (~$0.00001/tx). Clients need a funded wallet with USDC but zero XLM.

**`exact-v2` scheme** — The Stellar x402 scheme version. Server advertises `scheme: "exact"` + `x402Version: 2`. Don't mix v1 and v2 packages.

**SAC (Stellar Asset Contract)** — USDC on Stellar is a classic asset wrapped in a Soroban contract. x402 payments invoke `transfer` on the SAC. Any SEP-41 token works; USDC is the default.

**Ledger expiration** — Auth entries include a `max_ledger` bound. Use `latestLedger + 12` (~1 minute at 5s/ledger). Expired entries fail at settlement.

**CAIP-2 network IDs** — `stellar:testnet` and `stellar:pubnet`. These are the exact strings the protocol expects.

## Common pitfalls

**Auth entry expired on settle**
- Symptom: facilitator returns `isValid: false`, error mentions ledger expiration
- Fix: ensure client uses `latestLedger + 12` (or higher) as expiration; don't cache auth entries across requests

**Wrong USDC decimal precision**
- Symptom: payment amount off by 10x or 100x
- Fix: Stellar USDC uses **7 decimal places** (not 6 like EVM USDC). `$0.001` = `10000` in base units.

**V1/V2 package mismatch**
- Symptom: TypeScript errors or silent payment failures
- Fix: use all `@x402/*` packages at the same major version. V2 is multi-chain; don't import V1 `@x402/core` alongside V2 `@x402/stellar`.

**Missing USDC trustline**
- Symptom: `op_no_trust` error during settlement
- Fix: add a USDC `changeTrust` operation before attempting any x402 payment (see testnet runbook above)

**OZ Channels 401 on mainnet**
- Symptom: facilitator rejects with 401
- Fix: mainnet requires an API key in the `Authorization: Bearer` header — generate one at channels.openzeppelin.com/gen

---

# Part 2: MPP — Machine Payments Protocol (Charge + Channel)


## When to use MPP
MPP is the right choice when:
- You want **no facilitator dependency** — payments settle directly on Stellar via Soroban SAC transfers
- Your AI agent makes **many requests per session** — use channel mode to pay off-chain and settle once
- You're building a Stellar-native payment stack without relying on third-party infrastructure

Two modes:

| Mode | On-chain txs | Best for |
|------|-------------|----------|
| **Charge** | One per request | Per-request payments, no pre-funding required |
| **Channel** | One deposit + one close | High-frequency agents (100s of requests/session) |

If you need zero-XLM clients or the simplest possible setup, use x402 (Part 1 above) instead.

## Charge mode: per-request payments

Each request triggers a Soroban SAC token transfer settled on-chain. No facilitator. Server can optionally sponsor fees so clients don't need XLM.

```bash
npm install express @stellar/mpp mppx @stellar/stellar-sdk dotenv
npm pkg set type=module
```

**Server:**

```js
// charge-server.js
import express from "express";
import { Mppx } from "mppx";
import * as stellar from "@stellar/mpp/charge/server";
import * as StellarSdk from "@stellar/stellar-sdk";

const USDC_SAC_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";
const RECIPIENT = process.env.STELLAR_RECIPIENT; // G... address

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY, // shared secret for credential verification
  methods: [
    stellar.charge({
      recipient: RECIPIENT,
      currency: USDC_SAC_TESTNET,
      network: "stellar:testnet",
      // optional: server pays network fees so clients don't need XLM
      feePayer: process.env.FEE_PAYER_SECRET
        ? { envelopeSigner: StellarSdk.Keypair.fromSecret(process.env.FEE_PAYER_SECRET) }
        : undefined,
    }),
  ],
});

const app = express();
app.use(express.json());

// mppx middleware: returns 402 with challenge, then validates payment on retry
app.use(mppx.middleware());

app.get("/data", (req, res) => {
  res.json({ result: "paid content", price: "$0.001 USDC" });
});

app.listen(3002, () => console.log("MPP charge server on http://localhost:3002"));
```

**Client:**

```js
// charge-client.js
import { Mppx } from "mppx";
import * as stellar from "@stellar/mpp/charge/client";
import * as StellarSdk from "@stellar/stellar-sdk";

const keypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);

const mppx = Mppx.create({
  methods: [
    stellar.charge({
      keypair,
      mode: "pull", // server assembles and broadcasts the transaction
      onProgress(event) {
        // event.type: "challenge" | "signed" | "settled"
        if (event.type === "settled") console.log("Settled:", event.txHash);
      },
    }),
  ],
});

// mppx wraps fetch — 402 handling is transparent
const res = await mppx.fetch("http://localhost:3002/data");
console.log(await res.json());
```

**Env vars (server):** `STELLAR_RECIPIENT`, `MPP_SECRET_KEY`, `FEE_PAYER_SECRET` (optional)
**Env vars (client):** `STELLAR_SECRET_KEY`

**`mode: "pull"` vs `"push"`:**
- `"pull"` — client signs auth entries, server assembles + broadcasts (default; use with `feePayer`)
- `"push"` — client builds and broadcasts the transaction directly (client must have XLM for fees)

## Channel mode: high-frequency off-chain payments

The client deploys a one-way payment channel contract, deposits USDC once, then signs **cumulative commitments** off-chain for each request. No transaction per request — only two on-chain txs total (deposit + close). Ideal for AI agents making hundreds of calls in a session.

### Channel lifecycle

```
1. Deploy channel contract (one-time)   → C... contract address
2. Client deposits USDC into channel    → on-chain tx
3. Per request: client signs commitment → off-chain (just a signature)
   Amount is cumulative: each sig covers all previous payments + this one
4. Server closes channel when done      → on-chain tx, settles total
```

### Prerequisites

- Deploy a one-way-channel Soroban contract to get a `C...` contract address
- Generate an ed25519 keypair for commitment signing (see [stellar-mpp SDK](https://github.com/stellar/stellar-mpp-sdk))
- Fund the channel with USDC before making requests

### Server:

```js
// channel-server.js
import express from "express";
import { Mppx, Store } from "mppx";
import * as stellar from "@stellar/mpp/channel/server";

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY,
  methods: [
    stellar.channel({
      channel: process.env.CHANNEL_CONTRACT,       // C... contract address
      commitmentKey: process.env.COMMITMENT_PUBKEY, // 64-char hex ed25519 public key
      store: Store.memory(), // dev only — use persistent store in production
      network: "stellar:testnet",
    }),
  ],
});

const app = express();
app.use(express.json());
app.use(mppx.middleware());

app.get("/data", (req, res) => {
  res.json({ result: "paid content" });
});

app.listen(3003);
```

### Client:

```js
// channel-client.js
import { Mppx } from "mppx";
import * as stellar from "@stellar/mpp/channel/client";
import * as StellarSdk from "@stellar/stellar-sdk";

// commitment key must be a raw ed25519 seed — NOT a standard Stellar secret key
const commitmentKey = StellarSdk.Keypair.fromRawEd25519Seed(
  Buffer.from(process.env.COMMITMENT_SECRET, "hex") // 64-char hex secret
);

const mppx = Mppx.create({
  methods: [
    stellar.channel({
      commitmentKey,
      onProgress(event) {
        // event.type: "challenge" | "signed"
      },
    }),
  ],
});

// Make many requests — each signs a cumulative off-chain commitment
for (let i = 0; i < 100; i++) {
  const res = await mppx.fetch("http://localhost:3003/data");
  console.log(i, await res.json());
}
```

### Closing the channel (server-initiated):

```js
import { close } from "@stellar/mpp/channel/server";
import * as StellarSdk from "@stellar/stellar-sdk";

const txHash = await close({
  channel: process.env.CHANNEL_CONTRACT,
  amount: lastCumulativeAmount, // bigint, total USDC owed in base units
  signature: lastCommitmentSignature, // hex string from final commitment
  feePayer: { envelopeSigner: StellarSdk.Keypair.fromSecret(process.env.FEE_PAYER_SECRET) },
  network: "stellar:testnet",
});
// Single on-chain transaction settles the full session
console.log("Channel closed:", txHash);
```

**Env vars (server):** `CHANNEL_CONTRACT`, `COMMITMENT_PUBKEY`, `MPP_SECRET_KEY`, `FEE_PAYER_SECRET`
**Env vars (client):** `COMMITMENT_SECRET`

## Packages and subpath imports

```bash
npm install @stellar/mpp mppx @stellar/stellar-sdk
```

| Import path | Recommended import pattern |
|-------------|----------------------------|
| `@stellar/mpp/charge/server` | `import * as stellar from "@stellar/mpp/charge/server"` — use `stellar.charge(...)` |
| `@stellar/mpp/charge/client` | `import * as stellar from "@stellar/mpp/charge/client"` — use `stellar.charge(...)` |
| `@stellar/mpp/channel/server` | `import * as stellar from "@stellar/mpp/channel/server"` — use `stellar.channel(...)`, `stellar.close(...)`, `stellar.getChannelState(...)`, `stellar.watchChannel(...)` |
| `@stellar/mpp/channel/client` | `import * as stellar from "@stellar/mpp/channel/client"` — use `stellar.channel(...)` |
| `@stellar/mpp/channel` | Zod schema definitions for channel types |
| `mppx` | `import { Mppx, Store } from "mppx"` |

## Testnet runbook

**Steps shared with all protocols:**
1. Generate keypair + fund with Friendbot (see x402 testnet runbook in Part 1 above)
2. Add USDC trustline
3. Get testnet USDC from [Circle faucet](https://faucet.circle.com/)

**Channel mode only:**
4. Deploy the one-way-channel contract (see [stellar-mpp-sdk](https://github.com/stellar/stellar-mpp-sdk) for deploy script)
5. Generate a 64-char hex ed25519 seed for the commitment key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
6. Derive the public key and fund the channel with USDC before making requests

## Common pitfalls

**Channel: wrong commitment key format**
- Symptom: `Keypair.fromRawEd25519Seed` throws or signatures fail to verify
- Fix: the commitment key is a raw ed25519 seed as a 64-char hex string — not a Stellar `S...` secret key. Generate with `crypto.randomBytes(32).toString('hex')`.

**Channel: non-cumulative amounts**
- Symptom: server rejects commitments after the first request
- Fix: each commitment's `amount` must be the **running total** of all payments so far, not just the price of the current request. The server tracks the highest-seen commitment.

**Channel: deposit TTL expired**
- Symptom: `close()` fails or channel appears drained
- Fix: Soroban contract storage has a TTL. Close the channel before it expires, or extend storage TTL via `bumpContractInstance`. Don't leave channels open indefinitely.

**Charge: client has no XLM for fees**
- Symptom: `op_insufficient_balance` or fee errors on client-submitted transactions
- Fix: set `mode: "pull"` on the client and configure `feePayer` on the server so the server pays fees. The client only signs auth entries.

**`Store.memory()` in production**
- Symptom: server loses track of channel state on restart, enables double-spend
- Fix: replace `Store.memory()` with a persistent store (database-backed) before going to production.
