# Testing Strategy (Local / Testnet / Unit Tests)

## Quick Navigation
- Strategy overview: [Testing Pyramid](#testing-pyramid)
- Core test layers: [Unit Testing with Soroban SDK](#unit-testing-with-soroban-sdk), [Local Testing with Stellar Quickstart](#local-testing-with-stellar-quickstart), [Testnet Testing](#testnet-testing)
- Integration and CI: [Integration Testing Patterns](#integration-testing-patterns), [Test Configuration](#test-configuration), [CI/CD Configuration](#cicd-configuration)
- Advanced testing: [Fuzz Testing](#fuzz-testing), [Property-Based Testing](#property-based-testing), [Differential Testing with Test Snapshots](#differential-testing-with-test-snapshots), [Fork Testing](#fork-testing), [Mutation Testing](#mutation-testing)
- Performance and readiness: [Resource Profiling](#resource-profiling), [Best Practices](#best-practices)

## Testing Pyramid

1. **Unit tests (fast)**: Native Rust tests with `soroban-sdk` testutils
2. **Local integration tests**: Stellar Quickstart Docker
3. **Testnet tests**: Deploy and test on public testnet
4. **Mainnet smoke tests**: Final validation before production

## Unit Testing with Soroban SDK

The Soroban SDK provides comprehensive testing utilities that run natively (not in WASM), enabling fast iteration with full debugging support.

### Basic Test Setup

```rust
#![cfg(test)]

use soroban_sdk::{testutils::Address as _, Address, Env};

// Import your contract
use crate::{Contract, ContractClient};

#[test]
fn test_basic_functionality() {
    // Create test environment
    let env = Env::default();

    // Register contract
    let contract_id = env.register_contract(None, Contract);

    // Create typed client
    let client = ContractClient::new(&env, &contract_id);

    // Generate test addresses
    let user = Address::generate(&env);

    // Call contract functions
    client.initialize(&user);

    // Assert results
    assert_eq!(client.get_value(), 0);
}
```

### Testing Authorization

```rust
#[test]
fn test_with_auth() {
    let env = Env::default();

    // Mock all authorizations automatically
    env.mock_all_auths();

    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    let user1 = Address::generate(&env);
    let user2 = Address::generate(&env);

    // Initialize and mint
    client.initialize(&admin);
    client.mint(&user1, &1000);

    // Transfer (requires auth from user1)
    client.transfer(&user1, &user2, &100);

    assert_eq!(client.balance(&user1), 900);
    assert_eq!(client.balance(&user2), 100);

    // Verify which auths were required
    let auths = env.auths();
    assert_eq!(auths.len(), 1);
    // auths[0] contains (address, contract_id, function, args)
}
```

### Testing with Specific Auth Requirements

```rust
#[test]
fn test_specific_auth() {
    let env = Env::default();
    let contract_id = env.register_contract(None, Contract);
    let client = ContractClient::new(&env, &contract_id);

    let user = Address::generate(&env);

    // Mock auth only for specific address
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
}
```

### Testing Time-Dependent Logic

```rust
#[test]
fn test_time_based() {
    let env = Env::default();
    let contract_id = env.register_contract(None, VestingContract);
    let client = VestingContractClient::new(&env, &contract_id);

    let beneficiary = Address::generate(&env);

    // Set initial timestamp
    env.ledger().set_timestamp(1000);

    client.create_vesting(&beneficiary, &1000, &2000); // unlock at t=2000

    // Try to claim before unlock
    assert!(client.try_claim(&beneficiary).is_err());

    // Advance time past unlock
    env.ledger().set_timestamp(2500);

    // Now claim succeeds
    client.claim(&beneficiary);
}
```

### Testing Ledger State

```rust
#[test]
fn test_ledger_manipulation() {
    let env = Env::default();

    // Set ledger sequence
    env.ledger().set_sequence_number(1000);

    // Set timestamp
    env.ledger().set_timestamp(1704067200); // Jan 1, 2024

    // Set network passphrase
    env.ledger().set_network_id([0u8; 32]); // Custom network ID

    // Get current values
    let seq = env.ledger().sequence();
    let ts = env.ledger().timestamp();
}
```

### Testing Events

```rust
#[test]
fn test_events() {
    let env = Env::default();
    let contract_id = env.register_contract(None, Contract);
    let client = ContractClient::new(&env, &contract_id);

    client.do_something();

    // Get all events
    let events = env.events().all();

    // Check specific event
    assert_eq!(events.len(), 1);

    let event = &events[0];
    // event.0 = contract_id
    // event.1 = topics (Vec<Val>)
    // event.2 = data (Val)
}
```

### Testing Storage

```rust
#[test]
fn test_storage_ttl() {
    let env = Env::default();
    let contract_id = env.register_contract(None, Contract);
    let client = ContractClient::new(&env, &contract_id);

    client.store_data();

    // Check TTL
    let key = DataKey::MyData;
    let ttl = env.as_contract(&contract_id, || {
        env.storage().persistent().get_ttl(&key)
    });

    assert!(ttl > 0);
}
```

### Testing Cross-Contract Calls

```rust
#[test]
fn test_cross_contract() {
    let env = Env::default();

    // Register both contracts
    let token_id = env.register_contract_wasm(None, token::WASM);
    let vault_id = env.register_contract(None, VaultContract);

    let token_client = token::Client::new(&env, &token_id);
    let vault_client = VaultContractClient::new(&env, &vault_id);

    env.mock_all_auths();

    let user = Address::generate(&env);

    // Setup: mint tokens to user
    token_client.mint(&user, &1000);

    // Test: deposit tokens into vault
    vault_client.deposit(&user, &token_id, &500);

    assert_eq!(token_client.balance(&user), 500);
    assert_eq!(vault_client.balance(&user), 500);
}
```

## Local Testing with Stellar Quickstart

### Start Local Network

```bash
# Pull and run Stellar Quickstart
docker run --rm -it -p 8000:8000 \
  --name stellar \
  stellar/quickstart:latest \
  --local \
  --enable-soroban-rpc

# Or use Stellar CLI
stellar container start local
```

### Configure for Local Network

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const LOCAL_RPC = "http://localhost:8000/soroban/rpc";
const LOCAL_HORIZON = "http://localhost:8000";
const LOCAL_PASSPHRASE = "Standalone Network ; February 2017";

const rpc = new StellarSdk.rpc.Server(LOCAL_RPC);
const horizon = new StellarSdk.Horizon.Server(LOCAL_HORIZON);
```

### Fund Test Accounts (Local)

```bash
# Using Stellar CLI
stellar keys generate --global test-account --network local --fund

# Or via friendbot endpoint
curl "http://localhost:8000/friendbot?addr=G..."
```

### Deploy and Test Locally

```bash
# Deploy contract to local network
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \
  --source test-account \
  --network local

# Invoke contract
stellar contract invoke \
  --id CONTRACT_ID \
  --source test-account \
  --network local \
  -- \
  function_name \
  --arg value
```

## Testnet Testing

### Network Configuration

```bash
# Testnet RPC: https://soroban-testnet.stellar.org
# Testnet Horizon: https://horizon-testnet.stellar.org
# Network Passphrase: "Test SDF Network ; September 2015"
# Friendbot: https://friendbot.stellar.org
```

### Create and Fund Testnet Account

```bash
# Generate new identity
stellar keys generate --global my-testnet-key --network testnet

# Fund via Friendbot
stellar keys fund my-testnet-key --network testnet

# Or manually
curl "https://friendbot.stellar.org?addr=G..."
```

### Deploy to Testnet

```bash
# Deploy contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \
  --source my-testnet-key \
  --network testnet

# Install contract code (separate from deployment)
stellar contract install \
  --wasm target/wasm32-unknown-unknown/release/contract.wasm \
  --source my-testnet-key \
  --network testnet
```

### Testnet Reset Awareness

**Important**: Testnet resets approximately quarterly:
- All accounts and contracts are deleted
- Plan for re-deployment after resets
- Don't rely on persistent state for test data

Check reset schedule: https://stellar.org/developers/blog

## Integration Testing Patterns

### TypeScript Integration Tests

```typescript
// tests/integration/contract.test.ts
import * as StellarSdk from "@stellar/stellar-sdk";

const RPC_URL = process.env.RPC_URL || "http://localhost:8000/soroban/rpc";
const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE || "Standalone Network ; February 2017";

describe("Contract Integration Tests", () => {
  let rpc: StellarSdk.rpc.Server;
  let keypair: StellarSdk.Keypair;
  let contractId: string;

  beforeAll(async () => {
    rpc = new StellarSdk.rpc.Server(RPC_URL);
    keypair = StellarSdk.Keypair.random();

    // Fund account
    await fundAccount(keypair.publicKey());

    // Deploy contract
    contractId = await deployContract(keypair);
  });

  test("should initialize contract", async () => {
    const account = await rpc.getAccount(keypair.publicKey());
    const contract = new StellarSdk.Contract(contractId);

    const tx = new StellarSdk.TransactionBuilder(account, {
      fee: "100",
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(
        contract.call(
          "initialize",
          StellarSdk.Address.fromString(keypair.publicKey()).toScVal()
        )
      )
      .setTimeout(30)
      .build();

    const simResult = await rpc.simulateTransaction(tx);
    const preparedTx = StellarSdk.rpc.assembleTransaction(tx, simResult);

    preparedTx.sign(keypair);
    const result = await rpc.sendTransaction(preparedTx.build());

    expect(result.status).not.toBe("ERROR");
  });
});
```

### Rust Integration Tests

```rust
// tests/integration_test.rs
use soroban_sdk::{Env, Address};
use std::process::Command;

#[test]
#[ignore] // Run with: cargo test -- --ignored
fn integration_test_with_local_network() {
    // Requires local network running
    let output = Command::new("stellar")
        .args([
            "contract", "invoke",
            "--id", "CONTRACT_ID",
            "--source", "test-account",
            "--network", "local",
            "--",
            "get_count"
        ])
        .output()
        .expect("Failed to invoke contract");

    assert!(output.status.success());
}
```

## Test Configuration

### Cargo.toml for Tests

```toml
[dev-dependencies]
soroban-sdk = { version = "25.0.1", features = ["testutils"] }  # match [dependencies] version

[profile.test]
opt-level = 0
debug = true
```

### Running Tests

```bash
# Run unit tests
cargo test

# Run with output
cargo test -- --nocapture

# Run specific test
cargo test test_transfer

# Run ignored (integration) tests
cargo test -- --ignored
```

## CI/CD Configuration

### GitHub Actions Example

```yaml
name: Test Soroban Contract

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Add WASM target
        run: rustup target add wasm32-unknown-unknown

      - name: Run unit tests
        run: cargo test

      - name: Build contract
        run: cargo build --release --target wasm32-unknown-unknown

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    services:
      stellar:
        image: stellar/quickstart:latest
        ports:
          - 8000:8000
        options: >-
          --health-cmd "curl -f http://localhost:8000 || exit 1"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 10

    steps:
      - uses: actions/checkout@v4

      - name: Install Stellar CLI
        run: |
          cargo install stellar-cli --locked

      - name: Deploy and test
        run: |
          stellar keys generate --global ci-test --network local --fund
          stellar contract deploy \
            --wasm target/wasm32-unknown-unknown/release/contract.wasm \
            --source ci-test \
            --network local
```

## Best Practices

### Test Organization
```
project/
├── src/
│   └── lib.rs
├── tests/
│   ├── common/
│   │   └── mod.rs      # Shared test utilities
│   ├── unit/
│   │   ├── mod.rs
│   │   └── transfer.rs
│   └── integration/
│       └── full_flow.rs
└── Cargo.toml
```

### Test Utilities Module

```rust
// tests/common/mod.rs
use soroban_sdk::{testutils::Address as _, Address, Env};
use crate::{Contract, ContractClient};

pub fn setup_contract(env: &Env) -> (Address, ContractClient) {
    let contract_id = env.register_contract(None, Contract);
    let client = ContractClient::new(env, &contract_id);
    let admin = Address::generate(env);

    env.mock_all_auths();
    client.initialize(&admin);

    (contract_id, client)
}

pub fn create_funded_user(env: &Env, client: &ContractClient, amount: i128) -> Address {
    let user = Address::generate(env);
    client.mint(&user, &amount);
    user
}
```

## Fuzz Testing

Soroban has first-class fuzz testing via `cargo-fuzz` and the built-in `SorobanArbitrary` trait. All `#[contracttype]` types automatically derive `SorobanArbitrary` when the `"testutils"` feature is active.

### Setup

```bash
# Install nightly Rust + cargo-fuzz
rustup install nightly
cargo install --locked cargo-fuzz

# Initialize fuzz targets
cargo fuzz init
```

Update `Cargo.toml` to include both crate types:
```toml
[lib]
crate-type = ["lib", "cdylib"]
```

Add to `fuzz/Cargo.toml`:
```toml
[dependencies]
soroban-sdk = { version = "25.0.1", features = ["testutils"] }
```

### Writing a Fuzz Target

```rust
// fuzz/fuzz_targets/fuzz_deposit.rs
#![no_main]

use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, Env};
use my_contract::{Contract, ContractClient};

fuzz_target!(|input: (u64, i128)| {
    let (seed, amount) = input;
    let env = Env::default();
    env.mock_all_auths();

    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    // Initialize
    client.initialize(&user);

    // Fuzz deposit — should never panic unexpectedly
    let _ = client.try_deposit(&user, &amount);
});
```

### Running Fuzz Tests

```bash
# Run (use --sanitizer=thread on macOS)
cargo +nightly fuzz run fuzz_deposit

# Generate code coverage
cargo +nightly fuzz coverage fuzz_deposit
```

### Soroban Token Fuzzer

Reusable library for fuzzing token contracts:
- **GitHub**: https://github.com/brson/soroban-token-fuzzer

### Documentation

- [Stellar Fuzzing Guide](https://developers.stellar.org/docs/build/guides/testing/fuzzing)
- [Fuzzing Example Contract](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/fuzzing)

## Property-Based Testing

Use `proptest` with `SorobanArbitrary` for QuickCheck-style property testing that runs in standard `cargo test`.

```rust
#[cfg(test)]
mod prop_tests {
    use super::*;
    use proptest::prelude::*;
    use soroban_sdk::{testutils::Address as _, Env};

    proptest! {
        #[test]
        fn deposit_then_withdraw_preserves_balance(amount in 1i128..=i128::MAX) {
            let env = Env::default();
            env.mock_all_auths();
            let contract_id = env.register(Contract, ());
            let client = ContractClient::new(&env, &contract_id);
            let user = Address::generate(&env);

            client.initialize(&user);
            client.deposit(&user, &amount);
            client.withdraw(&user, &amount);

            prop_assert_eq!(client.balance(&user), 0);
        }
    }
}
```

**Recommended workflow**: Use `cargo-fuzz` interactively to find deep bugs, then convert to `proptest` for regression prevention in CI.

## Differential Testing with Test Snapshots

Soroban automatically writes JSON snapshots at the end of every test to `test_snapshots/`, capturing events and final ledger state. Commit these to source control — diffs reveal unintended behavioral changes.

### Comparing Against Deployed Contracts

```rust
// Fetch deployed contract for comparison
// $ stellar contract fetch --id C... --out-file deployed.wasm

mod deployed {
    soroban_sdk::contractimport!(file = "deployed.wasm");
}

#[test]
fn test_upgrade_compatibility() {
    let env = Env::default();
    env.mock_all_auths();

    // Register both versions
    let old_id = env.register_contract_wasm(None, deployed::WASM);
    let new_id = env.register(NewContract, ());

    let old_client = deployed::Client::new(&env, &old_id);
    let new_client = NewContractClient::new(&env, &new_id);

    let user = Address::generate(&env);

    // Run identical operations and compare
    old_client.initialize(&user);
    new_client.initialize(&user);

    assert_eq!(old_client.get_value(), new_client.get_value());
}
```

- **Docs**: [Differential Tests with Test Snapshots](https://developers.stellar.org/docs/build/guides/testing/differential-tests-with-test-snapshots)

## Fork Testing

Test against real production state using ledger snapshots:

```bash
# Create snapshot of deployed contract
stellar snapshot create --address C... --output json --out snapshot.json

# Optionally at a specific ledger
stellar snapshot create --address C... --ledger 12345678 --output json --out snapshot.json
```

```rust
#[test]
fn test_against_mainnet_state() {
    let env = Env::from_ledger_snapshot_file("snapshot.json");
    env.mock_all_auths();

    let contract_id = /* contract address from snapshot */;
    let client = ContractClient::new(&env, &contract_id);

    // Test operations against real state
    let result = client.get_value();
    assert!(result > 0);
}
```

- **Docs**: [Fork Testing](https://developers.stellar.org/docs/build/guides/testing/fork-testing)

## Mutation Testing

Use `cargo-mutants` to verify test quality — modifies source code and checks that tests catch the changes.

```bash
cargo install --locked cargo-mutants
cargo mutants
```

**Output interpretation**:
- **CAUGHT**: Tests detected the mutation (good coverage)
- **MISSED**: Tests passed despite mutation (test gap — review `mutants.out/diff/`)

- **Docs**: [Mutation Testing](https://developers.stellar.org/docs/build/guides/testing/mutation-testing)

## Resource Profiling

Soroban uses a multidimensional resource model (CPU instructions, ledger reads/writes, bytes, events, rent).

### CLI Simulation

```bash
# Simulate contract invocation to see resource costs
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  --sim-only \
  -- \
  function_name --arg value
```

### Stellar Plus Profiler (Cheesecake Labs)

```typescript
import { StellarPlus } from 'stellar-plus';

const profilerPlugin = new StellarPlus.Utils.Plugins.sorobanTransaction.profiler();
// Collects CPU instructions, RAM, ledger reads/writes
// Aggregation: sum, average, standard deviation
// Output: CSV, formatted text tables
```

- **Docs**: https://docs.cheesecakelabs.com/stellar-plus/reference/utils/plugins/profiler-plugin

### Testing Checklist

- [ ] Unit tests cover all public functions
- [ ] Edge cases tested (zero amounts, max values, empty state)
- [ ] Authorization tested (correct signers required)
- [ ] Error conditions tested (invalid inputs, unauthorized)
- [ ] Events emission verified
- [ ] Storage TTL behavior validated
- [ ] Cross-contract interactions tested
- [ ] Fuzz tests for critical paths (deposits, withdrawals, swaps)
- [ ] Property-based tests for invariants
- [ ] Mutation testing confirms test quality
- [ ] Differential test snapshots committed to source control
- [ ] Integration tests against local network
- [ ] Testnet deployment verified before mainnet
