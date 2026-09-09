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
npm install express@^5 @stellar/mpp mppx@^0.6.31 @stellar/stellar-sdk@^15 dotenv
npm pkg set type=module
```

> **Version alignment matters:** `@stellar/mpp@0.7.x` pins `@stellar/stellar-sdk@^15.1.0` (installing alongside SDK 13/14 fails with `ERESOLVE`) and `peerDependencies.mppx: ^0.6.29` — pin `mppx@^0.6.31` explicitly, since an unpinned install resolves the latest `mppx` (0.9.x), which falls outside that peer range and also adds a `SecretKey.assert()` guard this doc's "no intent's setup may throw at import time" guarantee assumes isn't there yet. `mppx` also expects `express@>=5`.

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

> **`MPP_SECRET_KEY` must be at least 32 bytes.** `mppx@0.6.31`'s `Mppx.create()` only checks it's present, not its length — a one-character value is accepted and then signs every HMAC challenge. Generate one with `openssl rand -base64 32`. (`mppx@0.9.x` adds this check itself via `SecretKey.assert()`; pinned to `0.6.31` per the install note above, this doc's own examples don't get it for free.)

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
import { StrKey } from "@stellar/stellar-sdk";

const USDC_SAC_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

// commitmentKey must be a Stellar G... address (or a Keypair) — never raw
// ed25519 bytes. MPP_COMMITMENT_KEY is generated and stored as 64-char hex
// (see the testnet runbook), so re-encode it before handing it to the library.
// Validate the raw string, not the decoded length: Buffer.from(x, "hex")
// stops at the first invalid hex character instead of throwing, so 64
// valid chars followed by garbage still decodes to exactly 32 bytes — a
// length check on the buffer can't catch that. StrKey.encodeEd25519PublicKey()
// doesn't check length either, so a bad value would otherwise silently
// become a plausible-looking wrong G... address instead of an error.
if (!/^[0-9a-f]{64}$/i.test(process.env.MPP_COMMITMENT_KEY)) {
  throw new Error("MPP_COMMITMENT_KEY must be exactly 64 hex characters");
}
const commitmentKey = StrKey.encodeEd25519PublicKey(
  Buffer.from(process.env.MPP_COMMITMENT_KEY, "hex")
);

const mppx = Mppx.create({
  secretKey: process.env.MPP_SECRET_KEY,
  methods: [
    stellar.channel({
      channel: process.env.MPP_CHANNEL_CONTRACT,       // C... contract address
      commitmentKey,
      // Both optional but strongly recommended: the channel contract is
      // deployed out-of-band, so without these the library can't reject a
      // channel that would settle to someone else's account or pay out in
      // the wrong token — it only logs a startup warning and trusts the
      // on-chain contract.
      recipient: process.env.STELLAR_RECIPIENT,        // reused from charge mode
      currency: USDC_SAC_TESTNET,
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
  channel: process.env.MPP_CHANNEL_CONTRACT,
  amount: lastCumulativeAmount, // bigint, total USDC owed in base units
  signature: lastCommitmentSignature, // hex string from final commitment
  feePayer: { envelopeSigner: StellarSdk.Keypair.fromSecret(process.env.FEE_PAYER_SECRET) },
  network: "stellar:testnet",
});
// Single on-chain transaction settles the full session
console.log("Channel closed:", txHash);
```

**Env vars (server):** `MPP_CHANNEL_CONTRACT`, `MPP_COMMITMENT_KEY`, `STELLAR_RECIPIENT`, `MPP_SECRET_KEY`, `FEE_PAYER_SECRET`
**Env vars (client):** `COMMITMENT_SECRET`

> `MPP_SECRET_KEY` carries the same 32-byte minimum here as in Charge mode above — see the note there.

## Production patterns

Three patterns for running Charge and Session behind the same server,
verified against a service that's been billing real USDC over MPP Charge
in production since before this skill existed.

### Recipient resolution (recover at boot, fail closed per request)

Two failure modes hit real deployments: `STELLAR_RECIPIENT` isn't set
yet (CI, a fresh environment before secrets are provisioned), or it's
set to the wrong value — a secret key (`S...`) pasted where the public
key belongs, which happens more than you'd expect when a platform's env
var UI doesn't visually distinguish the two. Neither should crash the
server at import time — but neither should let a paid route respond for
free once the server is up. Those are two separate failure surfaces:
booting and billing.

```js
import { Keypair, StrKey } from "@stellar/stellar-sdk";

function resolveRecipient() {
  let raw = (process.env.STELLAR_RECIPIENT || "").trim().replace(/['"]/g, "");
  if (!raw) return "";

  if (raw.startsWith("S")) {
    // A secret key was set where the public key belongs — recover instead
    // of failing. Warn loudly; this should get fixed, not silently relied on.
    try {
      const pub = Keypair.fromSecret(raw).publicKey();
      console.warn(`STELLAR_RECIPIENT is a secret key — derived public key: ${pub.slice(0, 8)}...`);
      return pub;
    } catch {
      console.error("STELLAR_RECIPIENT looks like a secret key but failed to parse — disabling MPP");
      return "";
    }
  }

  // A typo'd G... (wrong length, bad checksum) used to reach the SDK
  // unvalidated and throw several frames deep in Mppx.create(), away from
  // the env var that actually caused it. Fail here instead, with context.
  if (!StrKey.isValidEd25519PublicKey(raw)) {
    console.error(`STELLAR_RECIPIENT is not a valid Stellar public key — disabling MPP: ${raw.slice(0, 8)}...`);
    return "";
  }

  return raw;
}

const RECIPIENT = resolveRecipient();

let chargeMppx = null;
if (RECIPIENT && process.env.MPP_SECRET_KEY) {
  chargeMppx = Mppx.create({ /* ... */ });
} else {
  console.warn("MPP_SECRET_KEY missing, or STELLAR_RECIPIENT missing or invalid — MPP charge middleware disabled");
}

// Every route's middleware checks the instance, not the env var directly.
// Fail CLOSED here, not open: a rotated secret or a misconfigured deploy
// must never turn a paid route into a free one. `next()` would let the
// route respond with its normal 200 and no charge at all — indistinguishable
// from a bug, and silent.
export function mppChargeMiddleware(amount, description) {
  return async (req, res, next) => {
    if (!chargeMppx) {
      res.setHeader("X-MPP-Warning", "MPP not configured on this server");
      res.status(503).json({ error: "MPP charge unavailable — payment middleware not initialized" });
      return;
    }
    // Delegate to the same per-route handler the standalone Charge server
    // example above mounts directly (mppx.charge({ amount, description })),
    // just called manually here instead of passed to app.get() — this
    // factory's whole job is the null-check above it, not a different
    // charge implementation.
    await chargeMppx.charge({ amount, description })(req, res, next);
  };
}
```

The `S...`-key recovery is the case worth stealing even if you don't
need the rest: it turns a silent misconfiguration into a loud warning
plus an explicit `503`, instead of either a `Keypair.fromPublicKey` throw
three layers down in the SDK with no context about which env var caused
it, or — worse — a paid route quietly serving its content for free
because there was nothing left to charge against it.

### Optional dual-intent server

Charge and Session don't have to be an either/or choice at the code
level. Give each mode its own `Mppx` instance, initialize it only when
its full config is present, and let each intent's own middleware fail
closed — never throw, and never let the route respond for free — when
the instance for that intent is `null`. Charge's and
Session's server adapters both export their namespace as `stellar` (see
the Charge and Channel server imports above), so combining them in one
file means aliasing one — here Channel's becomes `stellarChannel`:

```js
import { Mppx } from "mppx/express";
import { Store } from "mppx/server";
import * as stellar from "@stellar/mpp/charge/server";
import * as stellarChannel from "@stellar/mpp/channel/server";
import { Keypair, StrKey } from "@stellar/stellar-sdk";

const USDC_SAC_TESTNET = "CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA";

// RECIPIENT is the resolveRecipient() result from the pattern above.

const chargeMppx = (RECIPIENT && process.env.MPP_SECRET_KEY)
  ? Mppx.create({ methods: [stellar.charge({ recipient: RECIPIENT, /* ... */ })] })
  : null;

// Same hex -> G-address re-encoding as the Session server example above,
// but this section's whole point is that no intent's setup may throw at
// import time or take another intent down with it — chargeMppx above must
// stay up even if MPP_COMMITMENT_KEY is garbage. So this catches instead
// of throwing: log it, leave commitmentKey undefined, and let the gate
// below fail Session closed (sessionMppx stays null) exactly the same way
// a genuinely-unset env var already does. Validates the raw string, not
// the decoded length — Buffer.from(x, "hex") stops at the first invalid
// character instead of throwing, so 64 valid chars followed by garbage
// still decodes to exactly 32 bytes.
let commitmentKey;
if (process.env.MPP_COMMITMENT_KEY) {
  if (/^[0-9a-f]{64}$/i.test(process.env.MPP_COMMITMENT_KEY)) {
    commitmentKey = StrKey.encodeEd25519PublicKey(
      Buffer.from(process.env.MPP_COMMITMENT_KEY, "hex")
    );
  } else {
    console.error("MPP_COMMITMENT_KEY is not 64 hex characters — Session mode disabled, Charge unaffected");
  }
}

// Same pattern as commitmentKey above: validate the raw string before
// handing it to Keypair.fromSecret(), which throws on a malformed secret
// key. Unvalidated, that throw happens inside the Mppx.create() call
// below — at import time, taking chargeMppx down with it. Unlike Charge
// (where feePayer is genuinely optional — see the ternary in the Charge
// server example above), Session's own env var list two sections up
// already lists FEE_PAYER_SECRET without "(optional)", and
// channel.Parameters' own doc comment says feePayer is "Required when
// handling close credential actions" — so this validates it, rather than
// treating it as optional the way Charge's ternary does.
let feePayerSigner;
if (process.env.FEE_PAYER_SECRET) {
  if (StrKey.isValidEd25519SecretSeed(process.env.FEE_PAYER_SECRET)) {
    feePayerSigner = Keypair.fromSecret(process.env.FEE_PAYER_SECRET);
  } else {
    console.error("FEE_PAYER_SECRET is not a valid Stellar secret key — Session mode disabled, Charge unaffected");
  }
}

// Same validate-before-use pattern as commitmentKey and feePayerSigner
// above: channel() only validates store, not the channel address itself
// — a typo'd C... value still builds sessionMppx, /info still reports
// Session enabled, and the address only reaches `new Contract(...)`
// deep inside the SDK on the first paid request, where it throws
// "Invalid contract ID" instead of failing at boot the way this whole
// section exists to guarantee.
let channelAddress;
if (process.env.MPP_CHANNEL_CONTRACT) {
  if (StrKey.isValidContract(process.env.MPP_CHANNEL_CONTRACT)) {
    channelAddress = process.env.MPP_CHANNEL_CONTRACT;
  } else {
    console.error("MPP_CHANNEL_CONTRACT is not a valid Stellar contract ID — Session mode disabled, Charge unaffected");
  }
}

const sessionMppx = (
  channelAddress &&
  commitmentKey &&
  RECIPIENT &&
  process.env.MPP_SECRET_KEY &&
  feePayerSigner
)
  ? Mppx.create({
      methods: [
        stellarChannel.channel({
          channel: channelAddress,
          commitmentKey,
          // Strongly recommended, not just optional: RECIPIENT is already a
          // precondition to reach this branch, so wire it through instead of
          // leaving the channel's payout address unverified against it.
          recipient: RECIPIENT,
          currency: USDC_SAC_TESTNET,
          // Required, not optional, in channel.Parameters — same as Charge
          // mode's own store above, already shown in full in the standalone
          // Charge and Session server examples earlier in this file.
          // Omitting it here throws at construction time (inside this same
          // ternary), which is exactly the "no intent's setup may throw"
          // rule this section exists to enforce.
          store: Store.memory(), // dev only — use a persistent store in production
          feePayer: { envelopeSigner: feePayerSigner },
          /* ... */
        }),
      ],
    })
  : null;

export const isSessionEnabled = () => !!sessionMppx;

// Same shape as mppChargeMiddleware above, and for the same reason: a
// route wired up the way the standalone Session server example higher in
// this file shows — sessionMppx.channel({ amount, description }) called
// directly as route middleware — evaluates that call at route
// registration time, which runs at import time. With sessionMppx `null`
// (Session not configured), that throws immediately and takes the whole
// process down, chargeMppx included — exactly what this section's "no
// intent's setup may throw or take another down with it" rule exists to
// prevent. Route through this factory instead of calling sessionMppx
// directly.
export function mppSessionMiddleware(amount, description) {
  return async (req, res, next) => {
    if (!sessionMppx) {
      res.setHeader("X-MPP-Warning", "MPP Session not configured on this server");
      res.status(503).json({ error: "MPP session unavailable — payment middleware not initialized" });
      return;
    }
    // Same delegation as mppChargeMiddleware above, to the Channel
    // equivalent of the standalone server example's mppx.channel({...}).
    await sessionMppx.channel({ amount, description })(req, res, next);
  };
}
```

This is the pattern actually running in production: Charge mode is
initialized and billing; Session mode's instance is `null` there today,
by choice — it requires deploying and funding a channel contract per
deployment, a step that carries custody implications worth a compliance
pass before turning on for a given business. Session works the same way
Charge does once its five env vars are set; nothing in the server code
changes when you flip it on later. What this pattern buys you is
shipping Charge on day one without a rewrite pending.

### Runtime configuration-status endpoint (`/info`)

Not the OpenAPI discovery document below, and not a health check either —
call it that and a caller will expect it to confirm the Soroban RPC, the
facilitator, and the store backend it depends on are actually reachable
right now. It doesn't: it only reports whether each intent's `Mppx`
instance was constructed at startup, which is configuration state, not
live dependency health. A client (human or agent) shouldn't have to guess
which intents are live. Report the true initialization state, not a
static capability list — `enabled` reflects whether the instance actually
initialized:

```js
app.get("/info", (_req, res) => {
  res.json({
    protocol: "mpp",
    intents: {
      charge: {
        enabled: !!chargeMppx,
        routes: { data: { path: "/data", price: "0.001 USDC" } },
      },
      session: {
        enabled: isSessionEnabled(),
        // channelAddress, not process.env.MPP_CHANNEL_CONTRACT directly — channelAddress
        // is undefined when the raw env var failed StrKey.isValidContract() above, so a
        // rejected value shows null here instead of appearing valid beside enabled: false.
        channelContract: channelAddress || null,
        note: "Off-chain cumulative commitments, two on-chain txs total (deposit + close).",
      },
    },
  });
});
```

An agent that reads this before its first request can pick a configured
intent instead of finding out from a 503 that Session was never
configured.

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
npm install @stellar/mpp mppx@^0.6.31 @stellar/stellar-sdk@^15
```

Pinned for the same reason as the Charge mode install above: `@stellar/mpp@0.7.1` declares `peerDependencies` of `mppx: ^0.6.29` and `@stellar/stellar-sdk: ^15.1.0`, but unpinned resolves each package's `latest` tag today (`mppx@0.9.2`, `@stellar/stellar-sdk@17.0.1`) — both outside those ranges, so an unpinned install fails with `ERESOLVE`.

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
5. Generate a 64-char hex ed25519 seed for the commitment key — this value
   is `COMMITMENT_SECRET`, kept on the **client** only:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
6. Derive the corresponding public key from that same seed — this is
   `MPP_COMMITMENT_KEY`, what the **server** holds, stored as hex the same
   way (the server code above re-encodes it to a G... address at startup).
   Export the seed from step 5 first, then read it from the environment
   rather than passing it as a bare CLI argument:
   ```bash
   export COMMITMENT_SECRET="<64-char hex from step 5>"
   node -e "const {Keypair}=require('@stellar/stellar-sdk');const seed=Buffer.from(process.env.COMMITMENT_SECRET,'hex');console.log(Keypair.fromRawEd25519Seed(seed).rawPublicKey().toString('hex'))"
   ```
   Then fund the channel with USDC before making requests.

## Common pitfalls

**Charge: server throws `A store is required for charge mode` at startup**
- Symptom: `Error: [stellar:charge] A store is required for charge mode. Provide a Store instance…`
- Fix: pass `store: Store.memory()` (dev) or a persistent store to `stellar.charge({ ... })` — charge mode requires one, not just session mode.

**Install fails with `ERESOLVE`**
- Symptom: npm refuses to install `@stellar/mpp` alongside an existing stellar-sdk 13/14, or alongside an unpinned `mppx`
- Fix: `@stellar/mpp@0.7.x` pins `@stellar/stellar-sdk@^15.1.0` and `peerDependencies.mppx: ^0.6.29`, and `mppx` expects `express@>=5` — align versions per the install note above, including the `mppx@^0.6.31` pin (an unpinned install resolves the latest 0.9.x, outside that peer range).

**Session: wrong commitment key format**
- Symptom: `Keypair.fromRawEd25519Seed` throws or signatures fail to verify
- Fix: two different 64-char hex values, not a Stellar `S...` secret key and not interchangeable. `COMMITMENT_SECRET` (client only) is the raw ed25519 **seed** — generate with `crypto.randomBytes(32).toString('hex')`. `MPP_COMMITMENT_KEY` (server) is the **public key** derived from that same seed, hex-encoded the same way — never the seed itself. See the testnet runbook above for the derivation step.

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
