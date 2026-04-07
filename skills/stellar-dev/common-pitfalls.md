# Common Pitfalls and Solutions

## Soroban Contract Issues

### 1. Contract Size Exceeds 64KB Limit

**Problem**: Contract won't deploy because WASM exceeds size limit.

**Symptoms**:
```
Error: contract exceeds maximum size
```

**Solutions**:

```toml
# Cargo.toml - Use aggressive optimization
[profile.release]
opt-level = "z"           # Optimize for size
lto = true                # Link-time optimization
codegen-units = 1         # Single codegen unit
panic = "abort"           # Smaller panic handling
strip = "symbols"         # Remove symbols
```

Additional strategies:
- Split large contracts into multiple smaller contracts
- Use `symbol_short!()` for symbols under 9 chars
- Avoid large static data in contract
- Remove debug code and unused functions
- Use `cargo bloat` to identify large dependencies

```bash
# Check contract size
ls -la target/wasm32-unknown-unknown/release/*.wasm

# Analyze what's taking space
cargo install cargo-bloat
cargo bloat --release --target wasm32-unknown-unknown
```

---

### 2. `#![no_std]` Missing

**Problem**: Compilation fails with std library errors.

**Symptoms**:
```
error: cannot find macro `println` in this scope
error[E0433]: failed to resolve: use of undeclared crate or module `std`
```

**Solution**:
```rust
// MUST be first line of lib.rs
#![no_std]

use soroban_sdk::{contract, contractimpl, Env};

// Use soroban_sdk equivalents instead of std:
// - soroban_sdk::String instead of std::string::String
// - soroban_sdk::Vec instead of std::vec::Vec
// - soroban_sdk::Map instead of std::collections::HashMap
```

---

### 3. Storage TTL Not Extended

**Problem**: Contract data gets archived and becomes inaccessible.

**Symptoms**:
- Contract calls fail after period of inactivity
- Data appears missing but contract still exists

**Solution**:
```rust
// Proactively extend TTL in operations that use data
pub fn use_data(env: Env) {
    // Extend instance storage
    env.storage().instance().extend_ttl(
        50,      // If TTL < 50, extend
        518400,  // Extend to ~30 days
    );

    // Extend specific persistent keys
    env.storage().persistent().extend_ttl(
        &DataKey::ImportantData,
        50,
        518400,
    );

    // Now use the data...
}
```

> See [contracts-soroban.md](contracts-soroban.md) for full TTL management patterns and storage type guidance.

---

### 4. Wrong Storage Type

**Problem**: Data unexpectedly deleted or costs too high.

**Symptoms**:
- Temporary data deleted before expected
- Unexpectedly high fees for storage

**Solution**:
```rust
// Instance: Shared config, survives with contract
env.storage().instance().set(&DataKey::Admin, &admin);

// Persistent: User data, can be archived but restored
env.storage().persistent().set(&DataKey::Balance(user), &balance);

// Temporary: Truly temporary, auto-deleted, cheapest
env.storage().temporary().set(&DataKey::Cache(key), &value);
```

---

### 5. Authorization Not Working

**Problem**: `require_auth()` not enforcing signatures in tests.

**Symptoms**:
- Tests pass but transactions fail on network
- Anyone can call protected functions

**Solution**:
```rust
#[test]
fn test_auth() {
    let env = Env::default();

    // DON'T just mock all auths blindly
    // env.mock_all_auths();  // Be careful with this!

    // DO test specific auth requirements with mock_auths()
    env.mock_auths(&[MockAuth {
        address: &user,
        invoke: &MockAuthInvoke {
            contract: &contract_id,
            fn_name: "transfer",
            args: (&user, &other, &100i128).into_val(&env),
            sub_invokes: &[],
        },
    }]);

    client.transfer(&user, &other, &100);
    assert!(!env.auths().is_empty());
}
```

> See [testing.md](testing.md) for comprehensive auth testing patterns including `mock_all_auths()`, specific auth mocking, and cross-contract auth.

---

## SDK Issues

### 6. Network Passphrase Mismatch

**Problem**: Transactions fail with signature errors.

**Symptoms**:
```
Error: tx_bad_auth
```

**Solution**:
```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

// ALWAYS use correct passphrase for network
const PASSPHRASES = {
  mainnet: StellarSdk.Networks.PUBLIC,
  // "Public Global Stellar Network ; September 2015"

  testnet: StellarSdk.Networks.TESTNET,
  // "Test SDF Network ; September 2015"

  local: "Standalone Network ; February 2017",
};

// When building transactions
const tx = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: PASSPHRASES.testnet, // Match your network!
});
```

---

### 7. Account Not Funded

**Problem**: Operations fail because account doesn't exist.

**Symptoms**:
```
Error: Account not found
Status: 404
```

**Solution**:
```typescript
// Testnet - use Friendbot
await fetch(`https://friendbot.stellar.org?addr=${publicKey}`);

// Mainnet - must receive XLM from existing account
const tx = new StellarSdk.TransactionBuilder(funderAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.PUBLIC,
})
  .addOperation(
    StellarSdk.Operation.createAccount({
      destination: newAccountPublicKey,
      startingBalance: "2", // Minimum ~1 XLM for base reserve
    })
  )
  .setTimeout(180)
  .build();
```

---

### 8. Missing Trustline

**Problem**: Payment fails for non-native assets.

**Symptoms**:
```
Error: op_no_trust
```

**Solution**:
```typescript
// Check if trustline exists
const account = await server.loadAccount(destination);
const hasTrustline = account.balances.some(
  (b) =>
    b.asset_type !== "native" &&
    b.asset_code === asset.code &&
    b.asset_issuer === asset.issuer
);

if (!hasTrustline) {
  // Create trustline first
  const trustTx = new StellarSdk.TransactionBuilder(destAccount, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase,
  })
    .addOperation(StellarSdk.Operation.changeTrust({ asset }))
    .setTimeout(180)
    .build();
  // Sign and submit...
}
```

---

### 9. Sequence Number Issues

**Problem**: Transaction rejected for sequence number.

**Symptoms**:
```
Error: tx_bad_seq
```

**Causes & Solutions**:

```typescript
// Cause 1: Stale account data
// Solution: Always load fresh account before building tx
const account = await server.loadAccount(publicKey);

// Cause 2: Parallel transactions
// Solution: Use sequence number management
class SequenceManager {
  private sequence: bigint;

  async getNext(server: Horizon.Server, publicKey: string) {
    if (!this.sequence) {
      const account = await server.loadAccount(publicKey);
      this.sequence = BigInt(account.sequence);
    }
    this.sequence++;
    return this.sequence.toString();
  }
}

// Cause 3: Transaction timeout without resubmit
// Solution: Rebuild with fresh sequence on timeout
```

---

### 10. Soroban Transaction Not Simulated

**Problem**: Soroban transaction fails with resource errors.

**Symptoms**:
```
Error: transaction simulation failed
Error: insufficient resources
```

**Solution**:
```typescript
// ALWAYS simulate before submitting Soroban transactions
const simulation = await rpc.simulateTransaction(transaction);

if (StellarSdk.rpc.Api.isSimulationError(simulation)) {
  throw new Error(`Simulation failed: ${simulation.error}`);
}

// Use assembleTransaction to add correct resources
const preparedTx = StellarSdk.rpc.assembleTransaction(
  transaction,
  simulation
).build();

// Now sign and submit preparedTx, not original transaction
```

---

## Frontend Issues

### 11. Freighter Not Detected

**Problem**: Wallet connection fails silently.

**Symptoms**:
- `isConnected()` returns false
- No wallet prompt appears

**Solution**:
```typescript
import { isConnected, isAllowed } from "@stellar/freighter-api";

async function checkFreighter() {
  // Check if extension is installed
  const connected = await isConnected();
  if (!connected) {
    // Prompt user to install
    window.open("https://freighter.app", "_blank");
    return;
  }

  // Check if app is allowed
  const allowed = await isAllowed();
  if (!allowed) {
    // Need to request permission
    await setAllowed();
  }
}
```

---

### 12. Network Mismatch with Wallet

**Problem**: Wallet on different network than app.

**Symptoms**:
- Transactions fail unexpectedly
- Wrong balances displayed

**Solution**:
```typescript
import { getNetwork } from "@stellar/freighter-api";

async function validateNetwork() {
  const walletNetwork = await getNetwork();
  const appNetwork = process.env.NEXT_PUBLIC_STELLAR_NETWORK;

  if (walletNetwork !== appNetwork) {
    throw new Error(
      `Please switch Freighter to ${appNetwork}. Currently on ${walletNetwork}`
    );
  }
}
```

---

### 13. Transaction Timeout

**Problem**: Transaction expires before confirmation.

**Symptoms**:
```
Error: tx_too_late
```

**Solution**:
```typescript
// Set appropriate timeout based on expected confirmation time
const tx = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase,
})
  .addOperation(/* ... */)
  .setTimeout(180) // 3 minutes - adjust as needed
  .build();

// Handle timeout gracefully
async function submitWithRetry(signedXdr: string) {
  try {
    return await submitTransaction(signedXdr);
  } catch (error) {
    if (error.response?.data?.extras?.result_codes?.transaction === "tx_too_late") {
      // Rebuild with fresh blockhash and retry
      const newTx = await rebuildTransaction(signedXdr);
      return await submitTransaction(newTx);
    }
    throw error;
  }
}
```

---

## CLI Issues

### 14. Identity Not Found

**Problem**: Stellar CLI can't find saved identity.

**Symptoms**:
```
Error: identity "alice" not found
```

**Solution**:
```bash
# List existing identities
stellar keys list

# Generate new identity
stellar keys generate --global alice

# For testnet with funding
stellar keys generate --global alice --network testnet --fund

# Specify identity location
stellar keys generate alice --config-dir /custom/path
```

---

### 15. Contract Invoke Parsing Errors

**Problem**: CLI can't parse function arguments.

**Symptoms**:
```
Error: invalid argument format
```

**Solution**:
```bash
# Use correct argument syntax
# Addresses: just the G... or C... string
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  transfer \
  --from GABC... \
  --to GDEF... \
  --amount 1000

# Complex types: use JSON
stellar contract invoke \
  --id CONTRACT_ID \
  -- \
  complex_fn \
  --data '{"field1": "value", "field2": 123}'
```

---

## General Best Practices

### Debugging Checklist

1. **Check network**: Is wallet/CLI on correct network?
2. **Check account**: Is source account funded?
3. **Check sequence**: Is sequence number current?
4. **Check simulation**: Did Soroban tx simulate successfully?
5. **Check trustlines**: For asset transfers, do trustlines exist?
6. **Check TTL**: For contract data, is TTL sufficient?
7. **Check authorization**: Is correct account signing?
8. **Check logs**: What does the error message actually say?

### Error Code Reference

| Code | Meaning | Common Fix |
|------|---------|------------|
| `tx_bad_auth` | Signature invalid | Check network passphrase |
| `tx_bad_seq` | Wrong sequence | Reload account |
| `tx_too_late` | Transaction expired | Rebuild and resubmit |
| `op_no_trust` | Missing trustline | Create trustline first |
| `op_underfunded` | Insufficient balance | Add funds |
| `op_low_reserve` | Below minimum balance | Maintain reserve |
