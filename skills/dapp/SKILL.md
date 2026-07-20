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

## Quick Navigation
- SDK setup and env config: [SDK Initialization](#sdk-initialization)
- Wallet integrations: [Wallet Integration](#wallet-integration)
- Tx build/send patterns: [Transaction Building](#transaction-building), [Transaction Submission](#transaction-submission)
- React + Next.js patterns: [React Components](#react-components), [Next.js App Router Setup](#nextjs-app-router-setup)
- Smart wallets/passkeys: [Smart Accounts (Passkey Wallets)](#smart-accounts-passkey-wallets)
- Production UX checklist: [Transaction UX Checklist](#transaction-ux-checklist)

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

The canonical way to call a Soroban contract from JS is the `contract.Client`, not hand-built `Contract.call` + `assembleTransaction`. The client reads the contract's interface from the network, so each method is callable by name and returns an `AssembledTransaction`. You get a native JS result and don't build ScVals by hand.

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

## React Components

### Connect Wallet Button
```tsx
// components/ConnectButton.tsx
"use client";

import { useFreighter } from "@/hooks/useFreighter";

export function ConnectButton() {
  const { connected, address, connect, disconnect } = useFreighter();

  if (connected && address) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm">
          {address.slice(0, 4)}...{address.slice(-4)}
        </span>
        <button
          onClick={disconnect}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      className="px-4 py-2 bg-blue-500 text-white rounded"
    >
      Connect Wallet
    </button>
  );
}
```

### Send Payment Form
```tsx
// components/SendPayment.tsx
"use client";

import { useState } from "react";
import { useFreighter } from "@/hooks/useFreighter";
import { buildPaymentTx, submitTransaction } from "@/lib/transactions";
import { config } from "@/lib/stellar";

export function SendPayment() {
  const { address, sign } = useFreighter();
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;

    setLoading(true);
    setStatus("Building transaction...");

    try {
      const xdr = await buildPaymentTx(address, destination, amount);

      setStatus("Please sign in your wallet...");
      const signedXdr = await sign(xdr, config.networkPassphrase);

      setStatus("Submitting transaction...");
      const result = await submitTransaction(signedXdr);

      setStatus(`Success! Hash: ${result.hash}`);
    } catch (error) {
      setStatus(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Destination Address"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <input
        type="text"
        placeholder="Amount (XLM)"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-full p-2 border rounded"
      />
      <button
        type="submit"
        disabled={loading || !address}
        className="w-full p-2 bg-blue-500 text-white rounded disabled:opacity-50"
      >
        {loading ? "Processing..." : "Send"}
      </button>
      {status && <p className="text-sm">{status}</p>}
    </form>
  );
}
```

## Next.js App Router Setup

### Provider Component
```tsx
// app/providers.tsx
"use client";

import { ReactNode } from "react";

// Add any context providers here
export function Providers({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
```

### Layout
```tsx
// app/layout.tsx
import { Providers } from "./providers";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

## Data Fetching

### Account Balance
```typescript
import { NotFoundError } from "@stellar/stellar-sdk";
import { horizon } from "@/lib/stellar";

export async function getBalance(address: string) {
  try {
    const account = await horizon.loadAccount(address);
    const nativeBalance = account.balances.find(
      (b) => b.asset_type === "native"
    );
    return nativeBalance?.balance || "0";
  } catch (error) {
    // loadAccount rejects with the typed NotFoundError for an unfunded account.
    if (error instanceof NotFoundError) {
      return "0"; // Account not funded yet
    }
    throw error;
  }
}
```

> For submission failures, Horizon returns result codes under `error.response?.data?.extras?.result_codes` (`transaction` + per-`operation`). See [Handle Errors](https://stellar.github.io/js-stellar-sdk/guides/05-handle-errors).

### Contract State

For a read-only contract call, `rpc.Server` has one-line shortcuts that build the contract interface for you (including the built-in spec for Stellar Asset Contracts), so no client setup or manual ScVal work is needed:

```typescript
import { rpc } from "@/lib/stellar";

// Run a read-only method and get the decoded result directly.
const { result: balance, isReadCall } = await rpc.queryContract<bigint>(
  tokenId,
  "balance",
  { id: "G..." } // named args, keyed by parameter name; omit for no-arg methods
);

// Discover a contract's callable methods from just its ID.
const methods = await rpc.getContractMethods(tokenId);
// [{ name: "balance", inputs: [{ name: "id", type: "Address" }], outputs: ["I128"] }, ...]
```

`isReadCall` is per-call: `false` means the `result` is only a simulation preview of a call that would change state (apply it by signing a transaction via `contract.Client`).

<details>
<summary><b>Advanced: read a raw ledger entry</b></summary>

Reach for `getLedgerEntries` only when you need a specific storage key that isn't exposed as a contract method.

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";
import { rpc } from "@/lib/stellar";

export async function getContractData(
  contractId: string,
  key: StellarSdk.xdr.ScVal
) {
  const ledgerKey = StellarSdk.xdr.LedgerKey.contractData(
    new StellarSdk.xdr.LedgerKeyContractData({
      contract: new StellarSdk.Address(contractId).toScAddress(),
      key: key,
      durability: StellarSdk.xdr.ContractDataDurability.persistent(),
    })
  );

  const entries = await rpc.getLedgerEntries(ledgerKey);

  if (entries.entries.length === 0) {
    return null;
  }

  return StellarSdk.scValToNative(
    entries.entries[0].val.contractData().val()
  );
}
```

</details>

## Smart Accounts (Passkey Wallets)

For passwordless authentication using WebAuthn passkeys, use Smart Account Kit.

### Installation
```bash
npm install smart-account-kit
```

### Quick Start
```typescript
import { SmartAccountKit, IndexedDBStorage } from 'smart-account-kit';

const kit = new SmartAccountKit({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  accountWasmHash: 'YOUR_ACCOUNT_WASM_HASH',
  webauthnVerifierAddress: 'CWEBAUTHN_VERIFIER_ADDRESS',
  storage: new IndexedDBStorage(),
});

// On page load - silent restore from stored session
const result = await kit.connectWallet();
if (!result) {
  showConnectButton(); // No stored session
}

// Create new wallet with passkey
const { contractId, credentialId } = await kit.createWallet(
  'My App',
  'user@example.com',
  { autoSubmit: true }
);

// Connect to existing wallet (prompts for passkey)
await kit.connectWallet({ prompt: true });

// Sign and submit transactions
const result = await kit.signAndSubmit(transaction);

// Transfer tokens
await kit.transfer(tokenContract, recipient, amount);
```

### Key Features
- **Session Management**: Automatic credential persistence and silent reconnection
- **Multiple Signer Types**: Passkeys (secp256r1), Ed25519 keys, policies
- **Context Rules**: Fine-grained authorization for different operations
- **Policy Support**: Threshold multisig, spending limits, custom policies
- **External Wallet Support**: Connect Freighter, LOBSTR via adapters
- **Gasless Transactions**: Optional relayer integration for fee sponsoring

### Fee Sponsorship with OpenZeppelin Relayer

The [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer/stellar) (also called Stellar Channels Service) handles gasless transaction submission. It replaces the deprecated Launchtube service and uses Stellar's native fee bump mechanism so users don't need XLM for fees.

```typescript
import * as RPChannels from "@openzeppelin/relayer-plugin-channels";

const client = new RPChannels.ChannelsClient({
  baseUrl: "https://channels.openzeppelin.com/testnet",
  apiKey: "your-api-key",
});

// Submit a smart contract call with fee sponsorship
const response = await client.submitSorobanTransaction({
  func: contractFunc,
  auth: contractAuth,
});
```

- **Testnet hosted instance**: `https://channels.openzeppelin.com/testnet` (API keys at `/gen`)
- **Production**: Self-host via Docker ([GitHub](https://github.com/OpenZeppelin/openzeppelin-relayer))
- **Stellar docs**: https://developers.stellar.org/docs/tools/openzeppelin-relayer

### Resources
- **GitHub**: https://github.com/kalepail/smart-account-kit
- **OpenZeppelin Contracts**: https://github.com/OpenZeppelin/stellar-contracts
- **Legacy SDK**: https://github.com/kalepail/passkey-kit (for simpler use cases)

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
