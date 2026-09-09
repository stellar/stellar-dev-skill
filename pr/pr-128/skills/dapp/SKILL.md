---
name: dapp
description: Stellar dApp / frontend development. Covers the JavaScript stellar-sdk (browser + Node.js), Freighter wallet, Stellar Wallets Kit (multi-wallet), Wallet Standard, smart accounts with passkeys, transaction building / signing / submission, smart contract invocation from the client, simulation, and error handling. Use when building a React/Next.js/Node.js app that talks to Stellar — classic operations or smart contracts.
user-invocable: true
argument-hint: "[dapp task]"
---

# Stellar dApp / Frontend

Client-side development with `@stellar/stellar-sdk`, wallet connection, signing, and submitting transactions. Covers both classic Stellar operations and smart contract invocation from the browser or Node.js.

## When to use this skill
- Connecting Freighter or other wallets via Stellar Wallets Kit
- Building, simulating, signing, and submitting transactions
- Invoking Stellar smart contracts from a frontend
- Implementing smart accounts with passkeys
- Handling network passphrases (Mainnet / Testnet / local)

## Related skills
- Writing the contract being invoked → `../smart-contracts/SKILL.md`
- Issuing assets and managing trustlines → `../assets/SKILL.md`
- Querying chain state via RPC / Horizon → `../data/SKILL.md`
- Building paid APIs or agent payment clients → `../agentic-payments/SKILL.md`
- SEPs the wallet/anchor flows depend on → `../standards/SKILL.md`

---


## Goals
- Single SDK instance for the app (RPC/Horizon + transaction building)
- Freighter wallet integration (or multi-wallet via Stellar Wallets Kit)
- Clean separation of client/server in Next.js
- Transaction sending with proper confirmation handling

## Read the file that matches the task

This file covers SDK setup, wallet connection, and transaction build/sign/submit. The deep dives live alongside it:

| Task | File |
|------|------|
| SDK setup and env config | [SDK Initialization](#sdk-initialization) (below) |
| Wallet integrations (Freighter, Wallets Kit) | [Wallet Integration](#wallet-integration) (below) |
| Tx build/send patterns | [Transaction Building](#transaction-building), [Transaction Submission](#transaction-submission) (below) |
| Connect-wallet button, payment form, Next.js App Router wiring | [react.md](react.md) |
| Account balances, contract reads (`queryContract`), raw ledger entries | [data-fetching.md](data-fetching.md) |
| Passkey smart wallets (Smart Account Kit), gasless tx via OpenZeppelin Relayer | [smart-accounts.md](smart-accounts.md) |
| Production UX checklist | [Transaction UX Checklist](#transaction-ux-checklist) (below) |

## Recommended Dependencies

> **Requires Node.js 22+.** As of SDK v16, Node 22 is the minimum (older Node produces an `EBADENGINE` warning). v16 also folded `@stellar/stellar-base` into `@stellar/stellar-sdk`, is ESM-first, and uses native `fetch` instead of axios. If you still import `@stellar/stellar-base` directly, switch the import to `@stellar/stellar-sdk` and uninstall the base package (keeping both breaks `instanceof` checks). See the [migration guide](https://stellar.github.io/js-stellar-sdk/guides/00-migration).

```bash
npm install @stellar/stellar-sdk @stellar/freighter-api
# Or for multi-wallet support — Wallets Kit v2 is distributed on JSR, not npm:
npx jsr add @creit-tech/stellar-wallets-kit
```

> **Sourcing:** SDK mechanics below (init, transaction building, contract invocation, submission, data fetching, error handling) track the official [JS SDK docs](https://stellar.github.io/js-stellar-sdk/) (which also publish [`llms.txt`](https://stellar.github.io/js-stellar-sdk/llms.txt) / [`llms-full.txt`](https://stellar.github.io/js-stellar-sdk/llms-full.txt) bundles for agents). Wallet integrations (Freighter, Stellar Wallets Kit), passkey smart accounts, and the OpenZeppelin relayer are separate packages, not part of the JS SDK — verify those against their own upstream docs.

## SDK Initialization

> For the full API reference (RPC methods, Horizon endpoints, migration guide), see the [data skill](../data/SKILL.md).

### Basic Setup
```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

// For Testnet
const testnetServer = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
const testnetRpc = new StellarSdk.rpc.Server("https://soroban-testnet.stellar.org");
const testnetNetworkPassphrase = StellarSdk.Networks.TESTNET;

// For Mainnet
const mainnetServer = new StellarSdk.Horizon.Server("https://horizon.stellar.org");
const mainnetRpcUrl = process.env.NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL;
if (!mainnetRpcUrl) throw new Error("Missing NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL");
const mainnetRpc = new StellarSdk.rpc.Server(mainnetRpcUrl); // set from your chosen RPC provider
const mainnetNetworkPassphrase = StellarSdk.Networks.PUBLIC;
```

### Environment Configuration
> Use a provider-specific mainnet RPC URL (see: https://developers.stellar.org/docs/data/apis/rpc/providers).

```typescript
// lib/stellar.ts
import * as StellarSdk from "@stellar/stellar-sdk";

const NETWORK = process.env.NEXT_PUBLIC_STELLAR_NETWORK || "testnet";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
};

function getConfig(network: string) {
  switch (network) {
    case "testnet":
      return {
        horizonUrl: "https://horizon-testnet.stellar.org",
        rpcUrl: "https://soroban-testnet.stellar.org",
        networkPassphrase: StellarSdk.Networks.TESTNET,
        friendbotUrl: "https://friendbot.stellar.org" as string | null,
      };
    case "mainnet":
      return {
        horizonUrl: "https://horizon.stellar.org",
        // Resolved lazily so testnet runs don't require the mainnet env var
        rpcUrl: requireEnv("NEXT_PUBLIC_STELLAR_MAINNET_RPC_URL"),
        networkPassphrase: StellarSdk.Networks.PUBLIC,
        friendbotUrl: null,
      };
    default:
      throw new Error(`Unknown network: ${network}`);
  }
}

export const config = getConfig(NETWORK);

export const horizon = new StellarSdk.Horizon.Server(config.horizonUrl);
export const rpc = new StellarSdk.rpc.Server(config.rpcUrl);
```

## Wallet Integration

### Freighter (Primary Browser Wallet)
```typescript
// hooks/useFreighter.ts
import { useState, useEffect, useCallback } from "react";
import {
  isConnected,
  getAddress,
  requestAccess,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";

export function useFreighter() {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [network, setNetwork] = useState<string | null>(null);

  useEffect(() => {
    checkConnection();
  }, []);

  const checkConnection = async () => {
    const { isConnected: installed, error } = await isConnected();
    if (error || !installed) return;

    // getAddress returns address: "" until the app has been granted access,
    // so a non-empty address means we're already authorized.
    const { address: addr, error: addressError } = await getAddress();
    if (addressError || !addr) return;

    const { network: net, error: networkError } = await getNetwork();
    if (networkError) return;
    setConnected(true);
    setAddress(addr);
    setNetwork(net);
  };

  const connect = useCallback(async () => {
    const { isConnected: installed, error } = await isConnected();
    if (error || !installed) {
      throw new Error("Freighter extension not installed");
    }

    // requestAccess prompts the user and returns the granted address.
    const { address: addr, error: accessError } = await requestAccess();
    if (accessError) throw new Error(accessError.message);

    const { network: net, error: networkError } = await getNetwork();
    if (networkError) throw new Error(networkError.message);
    setConnected(true);
    setAddress(addr);
    setNetwork(net);

    return addr;
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setNetwork(null);
  }, []);

  const sign = useCallback(
    async (xdr: string, networkPassphrase: string) => {
      if (!connected) throw new Error("Wallet not connected");
      const { signedTxXdr, error } = await signTransaction(xdr, {
        networkPassphrase,
      });
      if (error) throw new Error(error.message);
      return signedTxXdr;
    },
    [connected]
  );

  return { connected, address, network, connect, disconnect, sign };
}
```

### Stellar Wallets Kit (Multi-Wallet)

```typescript
// hooks/useStellarWallet.ts
import { useState, useCallback } from "react";
import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";

// v2 is a static singleton: init once at module load, then call static methods —
// there is no instance to construct or pass around.
// defaultModules() loads every wallet that needs no extra setup; modules with
// prerequisites (WalletConnect, Ledger, Trezor) must be imported and added explicitly.
StellarWalletsKit.init({
  modules: defaultModules(),
  network: Networks.TESTNET,
});

export function useStellarWallet() {
  const [address, setAddress] = useState<string | null>(null);

  const connect = useCallback(async () => {
    // authModal() opens the wallet picker, sets the chosen module active,
    // and returns the address — one call replaces v1's openModal callback dance.
    const { address } = await StellarWalletsKit.authModal();
    setAddress(address);
  }, []);

  const disconnect = useCallback(async () => {
    await StellarWalletsKit.disconnect();
    setAddress(null);
  }, []);

  const sign = useCallback(async (xdr: string) => {
    const { signedTxXdr } = await StellarWalletsKit.signTransaction(xdr);
    return signedTxXdr;
  }, []);

  return { address, connect, disconnect, sign };
}
```

> **Migrating from v1?** (noted July 2026) v1 lived on npm under the dotted scope `@creit.tech/stellar-wallets-kit`, with `new StellarWalletsKit({...})`, `allowAllModules()`, and `openModal({ onWalletSelected })`. v2 moved to JSR under `@creit-tech/stellar-wallets-kit`, made the kit fully static, replaced `allowAllModules()` with `defaultModules()`, and folded wallet selection + address fetch into `authModal()`. npm parity is maintained for now, but the maintainers say npm updates will eventually stop — install from JSR. Pre-selecting a wallet (`setWallet(FREIGHTER_ID)`) still works; the ID constants now live in per-wallet module subpaths like `@creit-tech/stellar-wallets-kit/modules/freighter`.

## Transaction Building

### Basic Payment
```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
import { horizon, config } from "@/lib/stellar";

export async function buildPaymentTx(
  sourceAddress: string,
  destinationAddress: string,
  amount: string,
  asset: StellarSdk.Asset = StellarSdk.Asset.native()
) {
  const account = await horizon.loadAccount(sourceAddress);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(
      StellarSdk.Operation.payment({
        destination: destinationAddress,
        asset: asset,
        amount: amount,
      })
    )
    .setTimeout(180)
    .build();

  return transaction.toXDR();
}
```

### Smart Contract Invocation (`contract.Client`)

The canonical way to call a Stellar smart contract from JS is the `contract.Client`, not hand-built `Contract.call` + `assembleTransaction`. The client reads the contract's interface from the network, so each method is callable by name and returns an `AssembledTransaction`. You get a native JS result and don't build ScVals by hand.

```typescript
import { contract } from "@stellar/stellar-sdk";
import { config } from "@/lib/stellar";

// Describe just the methods you call. `Client.from<T>()` uses this to type
// the returned client, so calls are checked and autocompleted — no codegen.
// For a contract with many methods, generate this interface from its spec
// with the SDK's binding CLI instead of writing it by hand.
interface CounterContract {
  increment: (
    options?: contract.MethodOptions,
  ) => Promise<contract.AssembledTransaction<number>>;
}

// `signTransaction` comes from the wallet (e.g. Freighter/Wallets Kit in the
// browser). `contract.basicNodeSigner(keypair, networkPassphrase)` is the
// Node equivalent for scripts and tests.
export async function getCounterClient(
  contractId: string,
  publicKey: string,
  signTransaction: contract.ClientOptions["signTransaction"],
) {
  return contract.Client.from<CounterContract>({
    contractId,
    rpcUrl: config.rpcUrl,
    networkPassphrase: config.networkPassphrase,
    publicKey,
    signTransaction,
  });
}

// Preview (free simulation) then sign + send to apply on-chain.
export async function increment(client: contract.Client & CounterContract) {
  const tx = await client.increment();
  console.log("preview:", tx.result); // predicted return value, no signature
  const sent = await tx.signAndSend(); // submits and polls to completion
  return sent.result;
}
```

`AssembledTransaction` also supports fine-grained control (`{ fee, simulate, timeoutInSeconds }` as a second arg) and multi-party auth via `tx.needsNonInvokerSigningBy()` / `tx.signAuthEntries()`. See [Invoke a Contract](https://stellar.github.io/js-stellar-sdk/guides/06-invoke-a-contract) and [Authorize a Contract Call](https://stellar.github.io/js-stellar-sdk/guides/07-contract-auth).

<details>
<summary><b>Advanced: low-level invocation without a client</b></summary>

Use this only when you need direct control over the transaction (e.g. batching a contract call with classic operations). Otherwise prefer `contract.Client` above.

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, config } from "@/lib/stellar";

export async function invokeContract(
  sourceAddress: string,
  contractId: string,
  method: string,
  args: StellarSdk.xdr.ScVal[]
) {
  const account = await rpc.getAccount(sourceAddress);
  const contract = new StellarSdk.Contract(contractId);

  const transaction = new StellarSdk.TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: config.networkPassphrase,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(180)
    .build();

  // `prepareTransaction` simulates and applies footprint/auth/fees in one step.
  // (Equivalent to simulateTransaction + rpc.assembleTransaction.)
  const prepared = await rpc.prepareTransaction(transaction);
  return prepared.toXDR();
}
```

**Building ScVal arguments by hand** (only needed for the low-level path — `contract.Client` converts native JS args for you):

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const addressVal = StellarSdk.Address.fromString(address).toScVal();
const i128Val = StellarSdk.nativeToScVal(BigInt(amount), { type: "i128" });
const u32Val = StellarSdk.nativeToScVal(42, { type: "u32" });
const stringVal = StellarSdk.nativeToScVal("hello", { type: "string" });
const symbolVal = StellarSdk.nativeToScVal("transfer", { type: "symbol" });

// Struct
const structVal = StellarSdk.nativeToScVal(
  { name: "Token", decimals: 7 },
  {
    type: {
      name: ["symbol", null],
      decimals: ["u32", null],
    },
  }
);

// Vec of i128 — the element type is applied to each item
const vecVal = StellarSdk.nativeToScVal(
  [1, 2, 3].map((n) => BigInt(n)),
  { type: "i128" }
);
```

</details>

## Transaction Submission

### Submit and Wait for Confirmation
```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc, horizon, config } from "@/lib/stellar";

export async function submitTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  );

  // For smart contract transactions, use RPC
  if (transaction.operations.some(op => op.type === "invokeHostFunction")) {
    return submitSorobanTransaction(signedXdr);
  }

  // For classic transactions, use Horizon
  return submitClassicTransaction(signedXdr);
}

async function submitSorobanTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await rpc.sendTransaction(transaction);

  if (response.status === "ERROR") {
    throw new Error(`Send failed: ${response.errorResult}`);
  }

  // Poll for completion. pollTransaction handles the retry loop (default 5
  // attempts, 1s apart — tune with { attempts, sleepStrategy }) instead of a
  // hand-rolled while loop that can spin forever.
  const getResponse = await rpc.pollTransaction(response.hash);

  if (getResponse.status === "SUCCESS") {
    return {
      hash: response.hash,
      result: getResponse.returnValue,
    };
  }

  throw new Error(`Transaction failed: ${getResponse.status}`);
}

async function submitClassicTransaction(signedXdr: string) {
  const transaction = StellarSdk.TransactionBuilder.fromXDR(
    signedXdr,
    config.networkPassphrase
  ) as StellarSdk.Transaction;

  const response = await horizon.submitTransaction(transaction);
  return {
    hash: response.hash,
    ledger: response.ledger,
  };
}
```

## Transaction UX Checklist

- [ ] Show loading state during wallet signing
- [ ] Display transaction hash immediately after submission
- [ ] Track confirmation status (pending → success/failed)
- [ ] Handle common errors with clear messages:
  - Wallet not connected
  - User rejected signing
  - Insufficient XLM for fees
  - Account not funded
  - Network mismatch (wallet on wrong network)
  - Transaction timeout/expired
- [ ] Prevent double-submission while processing
- [ ] Show destination and amount before signing
