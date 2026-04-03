# MPP (Machine Payments Protocol) on Stellar

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

If you need zero-XLM clients or the simplest possible setup, use [x402](x402.md) instead.

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

| Import path | Exports |
|-------------|---------|
| `@stellar/mpp/charge/server` | `stellar`, `charge` |
| `@stellar/mpp/charge/client` | `stellar`, `charge` |
| `@stellar/mpp/channel/server` | `stellar`, `channel`, `close`, `getChannelState`, `watchChannel` |
| `@stellar/mpp/channel/client` | `stellar`, `channel` |
| `@stellar/mpp/channel` | Zod schema definitions |
| `mppx` | `Mppx`, `Store` |

## Testnet runbook

**Steps shared with all protocols:**
1. Generate keypair + fund with Friendbot (see [x402.md testnet runbook](x402.md))
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
