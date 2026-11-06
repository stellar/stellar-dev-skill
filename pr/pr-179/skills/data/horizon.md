# Horizon API (Legacy)

Horizon REST endpoints, common operations, streaming, and pagination. Companion to [SKILL.md](SKILL.md) — new projects should prefer Stellar RPC; see the [migration guide](SKILL.md#migration-horizon-to-rpc).

### Endpoints

| Network | Horizon URL |
|---------|-------------|
| Mainnet | `https://horizon.stellar.org` |
| Testnet | `https://horizon-testnet.stellar.org` |
| Local | `http://localhost:8000` |

### Setup

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");
```

### Common Operations

#### Load Account

```typescript
const account = await server.loadAccount(publicKey);
// Full account details including balances, signers, data
```

#### Get Account Balances

```typescript
const account = await server.loadAccount(publicKey);
for (const balance of account.balances) {
  if (balance.asset_type === "native") {
    console.log("XLM:", balance.balance);
  } else {
    console.log(`${balance.asset_code}:`, balance.balance);
  }
}
```

#### Get Transactions

```typescript
// Account transactions
const transactions = await server
  .transactions()
  .forAccount(publicKey)
  .order("desc")
  .limit(10)
  .call();

// Specific transaction
const tx = await server
  .transactions()
  .transaction(txHash)
  .call();
```

#### Get Operations

```typescript
const operations = await server
  .operations()
  .forAccount(publicKey)
  .order("desc")
  .limit(20)
  .call();

for (const op of operations.records) {
  console.log(op.type, op.created_at);
}
```

#### Get Payments

```typescript
const payments = await server
  .payments()
  .forAccount(publicKey)
  .order("desc")
  .call();

for (const payment of payments.records) {
  if (payment.type === "payment") {
    console.log(
      `${payment.from} -> ${payment.to}: ${payment.amount} ${payment.asset_code || "XLM"}`
    );
  }
}
```

#### Get Effects

```typescript
const effects = await server
  .effects()
  .forAccount(publicKey)
  .limit(50)
  .call();
```

#### Streaming (Server-Sent Events)

Reconnecting at `"now"` silently drops everything that arrived while the
connection was down. Persist each record's `paging_token` and resume from it:

```typescript
// Durable in production (DB/Redis) — an in-memory cursor is lost on restart.
let cursor = (await loadCursor()) ?? "now";
let closeHandler: (() => void) | undefined;

function subscribe() {
  closeHandler = server
    .transactions()
    .forAccount(publicKey)
    .cursor(cursor)
    .stream({
      onmessage: (tx) => {
        console.log("New transaction:", tx.hash);
        // Advance only after handling, so a crash mid-work replays the record.
        cursor = tx.paging_token;
        void saveCursor(cursor);
      },
      onerror: (error) => {
        console.error(`Stream error, resuming from ${cursor}:`, error);
        closeHandler?.();
        setTimeout(subscribe, 5_000); // back off, then resume from the cursor
      },
    });
}

subscribe();

// Close stream when done
closeHandler?.();
```

Resuming replays the record at the cursor, so make `onmessage` idempotent
(key off `tx.hash`) rather than assuming exactly-once delivery.

#### Submit Transaction

```typescript
try {
  const result = await server.submitTransaction(signedTransaction);
  console.log("Success:", result.hash);
} catch (error) {
  if (error.response?.data?.extras?.result_codes) {
    console.error("Error codes:", error.response.data.extras.result_codes);
  }
}
```

### Pagination

```typescript
// First page
let page = await server.transactions().forAccount(publicKey).limit(10).call();

// Next page
if (page.records.length > 0) {
  page = await page.next();
}

// Previous page
page = await page.prev();
```
