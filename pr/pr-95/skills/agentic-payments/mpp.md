# MPP — Machine Payments Protocol (Charge + Session)

Facilitator-free machine payments settled directly on Stellar: per-request Charge mode and channel-backed Session mode. Companion to [SKILL.md](SKILL.md) (decision table, shared testnet setup, USDC addresses); the facilitator-based alternative lives in [x402.md](x402.md).

## When to use MPP
MPP is the right choice when:
- You want **no facilitator dependency** — payments settle directly on Stellar via SAC transfers
- Your AI agent makes **many requests per session** — use Session mode (a payment channel under the hood) to pay off-chain and settle once
- You're building a Stellar-native payment stack without relying on third-party infrastructure

Two modes:

| Mode | On-chain txs | Best for |
|------|-------------|----------|
| **Charge** | One per request | Per-request payments, no pre-funding required |
| **Session** | One deposit + one close | High-frequency agents (100s of requests/session) |

If you need zero-XLM clients or the simplest possible setup, use x402 ([x402.md](x402.md)) instead.

## Charge mode: per-request payments

Each request triggers a SAC token transfer settled on-chain. No facilitator. Server can optionally sponsor fees so clients don't need XLM.

```bash
npm install express@^5 @stellar/mpp mppx @stellar/stellar-sdk@^15 dotenv
npm pkg set type=module
```

> **Version alignment matters:** `@stellar/mpp@0.7.x` pins `@stellar/stellar-sdk@^15.1.0` (installing alongside SDK 13/14 fails with `ERESOLVE`), and `mppx` expects `express@>=5`.

**Server:**

```js
// charge-server.js
import express from "express";
import { Mppx } from "mppx/express";
import { Store } from "mppx/server";
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
      store: Store.memory(), // required in charge mode; dev only — use a persistent store in production
      // optional: server pays network fees so clients don't need XLM
      feePayer: process.env.FEE_PAYER_SECRET
        ? { envelopeSigner: StellarSdk.Keypair.fromSecret(process.env.FEE_PAYER_SECRET) }
        : undefined,
    }),
  ],
});

const app = express();
app.use(express.json());

// Mppx.create returns per-intent Express handlers — mount one per paid route.
// The price is set here, per route, not in the method config.
app.get(
  "/data",
  mppx.charge({ amount: "0.001", description: "paid API call" }),
  (req, res) => {
    res.json({ result: "paid content", price: "$0.001 USDC" });
  },
);

app.listen(3002, () => console.log("MPP charge server on http://localhost:3002"));
```

**Client:**

```js
// charge-client.js
import { Mppx } from "@stellar/mpp/charge/client"; // re-exports the client Mppx from mppx/client
import * as stellar from "@stellar/mpp/charge/client";
import * as StellarSdk from "@stellar/stellar-sdk";

const keypair = StellarSdk.Keypair.fromSecret(process.env.STELLAR_SECRET_KEY);

const mppx = Mppx.create({
  methods: [
    stellar.charge({
      keypair,
      mode: "pull", // server assembles and broadcasts the transaction
      onProgress(event) {
        // event.type: "challenge" | "signing" | "signed" | "paying" | "confirming" | "paid"
        if (event.type === "paid") console.log("Paid:", event.hash);
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

## Session mode: high-frequency off-chain payments

> **Naming:** current MPP material calls the payment intent a **Session**; it settles over a **one-way payment channel**. Older docs (including earlier versions of this skill) said "Channel mode" — treat that as a synonym. "Channel" below always refers to the settlement mechanism, not the mode.

The client deploys a one-way payment channel contract, deposits USDC once, then signs **cumulative commitments** off-chain for each request. No transaction per request — only two on-chain txs total (deposit + close). Ideal for AI agents making hundreds of calls in a session.

### Session lifecycle

```
1. Deploy channel contract (one-time)   → C... contract address
2. Client deposits USDC into channel    → on-chain tx
3. Per request: client signs commitment → off-chain (just a signature)
   Amount is cumulative: each sig covers all previous payments + this one
4. Server closes channel when done      → on-chain tx, settles total
```

### Prerequisites

- Deploy a one-way-channel smart contract to get a `C...` contract address
- Generate an ed25519 keypair for commitment signing (see [stellar-mpp SDK](https://github.com/stellar/stellar-mpp-sdk))
- Fund the channel with USDC before making requests

### Server:

```js
// channel-server.js
import express from "express";
import { Mppx } from "mppx/express";
import { Store } from "mppx/server";
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

// Per-route handler, same adapter model as charge mode; price per route.
app.get(
  "/data",
  mppx.channel({ amount: "0.001", description: "paid API call" }),
  (req, res) => {
    res.json({ result: "paid content" });
  },
);

app.listen(3003);
```

### Client:

```js
// channel-client.js
import { Mppx } from "mppx/client";
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

## Discovery: let agents find your paid API

Charge and Session modes answer one question: how do I charge? Discovery answers a second: how does a paying agent find me? Without discovery you ship a working paid API that no agent can locate.

A paid MPP server publishes an [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) document at `GET /openapi.json`. Each paid operation carries an `x-payment-info` extension holding an `offers[]` array. Registries aggregate those documents so agents can search for paid APIs.

> **Discovery is advisory.** The document is an informational hint for display and planning. The runtime **402 Challenge is authoritative** for price, token, network, expiry, and terms. Read the payment terms from the Challenge, never from the discovery document.

### Serve the document

`mppx/express` exports `discovery()`. It mounts `GET /openapi.json` and derives each offer from the method config and the per-route handler, so the document stays in step with the Challenges the route returns.

Edit the Charge mode server above — don't append this to it. A second `mppx/express` import redeclares `Mppx`, and a second `/data` route never runs.

```js
// charge-server.js

// 1. Replace the existing `mppx/express` import with this one.
import { Mppx, discovery } from "mppx/express";

// 2. Replace the inline app.get("/data", ...) block with these two.
//    discovery() reads the price off the handler object, so name it.
const pay = mppx.charge({ amount: "0.001", description: "paid API call" });

app.get("/data", pay, (req, res) => {
  res.json({ result: "paid content", price: "$0.001 USDC" });
});

// 3. Add this after the route, before app.listen().
discovery(app, mppx, {
  info: { title: "Paid Data API", version: "1.0.0" },
  routes: [{ handler: pay, method: "get", path: "/data" }],
});
```

Session mode works the same way — pass the `mppx.channel(...)` handler in `routes`.

Validate the document before you publish it:

```bash
npx mppx discover validate http://localhost:3002/openapi.json
```

### Register the service (optional)

| Registry | What it is | How to list |
|----------|------------|-------------|
| [MPPScan](https://mppscan.com) | Public registry of MPP services, with search and analytics | [Register](https://www.mppscan.com/register) |
| [MPP services directory](https://mpp.dev/services) | Curated list of live services on mpp.dev | [Submission guide](https://mpp.dev/services#list-your-service) |

Agents can query the curated directory over MCP at `https://mpp.dev/mcp/services`. That server is read-only.

A registry listing advertises your service. It does not verify any client payment. Your server still issues the 402 Challenge and verifies the Credential on every request.

Full reference: [MPP discovery docs](https://mpp.dev/advanced/discovery).

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
| `mppx/express` | `import { Mppx, discovery } from "mppx/express"` — Express adapter; `Mppx.create(...)` returns per-route handlers, `discovery(...)` mounts `/openapi.json` |
| `mppx/server` | `import { Mppx, Store } from "mppx/server"` — framework-agnostic server + `Store` |
| `mppx/client` | `import { Mppx } from "mppx/client"` — client; also re-exported by `@stellar/mpp/charge/client` |

> The bare `mppx` root does **not** export `Mppx` at all — always import it from the subpaths above. (`Store` *is* re-exported from the root and is the same object as `mppx/server`'s, but importing it from `mppx/server` keeps the server imports together.)

## Testnet runbook

**Steps shared with all protocols:**
1. Generate keypair + fund with Friendbot — see the [shared testnet setup in SKILL.md](SKILL.md#testnet-setup-shared)
2. Add USDC trustline (same shared setup)
3. Get testnet USDC from [Circle faucet](https://faucet.circle.com/)

**Session mode only:**
4. Deploy the one-way-channel contract (see [stellar-mpp-sdk](https://github.com/stellar/stellar-mpp-sdk) for deploy script)
5. Generate a 64-char hex ed25519 seed for the commitment key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
6. Derive the public key and fund the channel with USDC before making requests

## Common pitfalls

**Charge: server throws `A store is required for charge mode` at startup**
- Symptom: `Error: [stellar:charge] A store is required for charge mode. Provide a Store instance…`
- Fix: pass `store: Store.memory()` (dev) or a persistent store to `stellar.charge({ ... })` — charge mode requires one, not just session mode.

**Install fails with `ERESOLVE`**
- Symptom: npm refuses to install `@stellar/mpp` alongside an existing stellar-sdk 13/14
- Fix: `@stellar/mpp@0.7.x` pins `@stellar/stellar-sdk@^15.1.0`, and `mppx` expects `express@>=5` — align versions per the install note above.

**Session: wrong commitment key format**
- Symptom: `Keypair.fromRawEd25519Seed` throws or signatures fail to verify
- Fix: the commitment key is a raw ed25519 seed as a 64-char hex string — not a Stellar `S...` secret key. Generate with `crypto.randomBytes(32).toString('hex')`.

**Session: non-cumulative amounts**
- Symptom: server rejects commitments after the first request
- Fix: each commitment's `amount` must be the **running total** of all payments so far, not just the price of the current request. The server tracks the highest-seen commitment.

**Session: deposit TTL expired**
- Symptom: `close()` fails or channel appears drained
- Fix: Contract storage has a TTL. Close the channel before it expires, or extend storage TTL via `bumpContractInstance`. Don't leave channels open indefinitely.

**Charge: client has no XLM for fees**
- Symptom: `op_insufficient_balance` or fee errors on client-submitted transactions
- Fix: set `mode: "pull"` on the client and configure `feePayer` on the server so the server pays fees. The client only signs auth entries.

**Discovery: client trusts the discovery price**
- Symptom: the client pays the amount from `/openapi.json` and the server rejects the Credential
- Fix: the discovery document is advisory. Take price, token, network, expiry, and terms from the 402 Challenge.

**Discovery: route missing from `/openapi.json`**
- Symptom: the document builds, but a paid route carries no `x-payment-info`
- Fix: on Express, `discovery()` only documents routes listed in `routes`. Add one entry per paid route, and pass the same handler object you mounted on the route.

**`Store.memory()` in production**
- Symptom: server loses track of channel state on restart, enables double-spend
- Fix: replace `Store.memory()` with a persistent store (database-backed) before going to production.
