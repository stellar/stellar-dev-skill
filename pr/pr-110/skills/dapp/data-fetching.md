# Client-Side Data Fetching

Reading balances and contract state from the client. Companion to [SKILL.md](SKILL.md); UI patterns live in [react.md](react.md).

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
