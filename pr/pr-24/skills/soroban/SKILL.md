---
name: soroban
description: Soroban smart contract development on Stellar (Rust SDK). Covers project setup, contract structure, storage types, authorization, cross-contract calls, events, error handling, testing (unit, integration, fuzz, property, mutation, fork, differential), security patterns and vulnerability classes, advanced architecture patterns (upgrades, factories, governance, DeFi primitives), and common pitfalls. Use when writing, testing, securing, or shipping Soroban contracts.
user-invocable: true
argument-hint: "[contract task]"
---

# Soroban Smart Contracts

End-to-end guide for building Soroban contracts: writing them, testing them, securing them, and shipping advanced architectures. This skill bundles five concerns that live and die together — the contract code, the tests, the security posture, the design patterns, and the gotchas.

## When to use this skill
- Writing a Soroban contract in Rust
- Setting up unit, integration, fuzz, or property tests
- Reviewing a contract for security issues (authorization, reentrancy-adjacent bugs, storage hygiene, TTL, overflow)
- Architecting upgradeable contracts, factories, governance, or DeFi primitives
- Debugging a Soroban-specific error (auth, storage, archival, resource limits)

## Related skills
- Assets, trustlines, and SAC bridge → `../assets/SKILL.md`
- Frontend/wallets that call your contract → `../dapp/SKILL.md`
- Chain data queries (RPC/Horizon) → `../data/SKILL.md`
- ZK cryptography (BLS12-381, BN254, Poseidon) → `../zk-proofs/SKILL.md`
- SEP/CAP standards and ecosystem links → `../standards/SKILL.md`

---

# Part 1: Contract Development


## When to use Soroban
Use Soroban when you need:
- Custom on-chain logic beyond Stellar's built-in operations
- Programmable escrow, lending, or DeFi primitives
- Complex authorization rules
- State management beyond account balances
- Interoperability with Stellar Assets via SAC

## Quick Navigation
- Initialization and constructors: [Project Setup](#project-setup), [Contract Constructors (Protocol 22+)](#contract-constructors-protocol-22)
- Core implementation patterns: [Core Contract Structure](#core-contract-structure), [Storage Types](#storage-types), [Authorization](#authorization)
- Advanced interactions: [Cross-Contract Calls](#cross-contract-calls), [Events](#events), [Error Handling](#error-handling)
- Delivery workflow: [Building and Deploying](#building-and-deploying), [Unit Testing](#unit-testing), [Best Practices](#best-practices)
- ZK status guidance: [Zero-Knowledge Cryptography (Status-Sensitive)](#zero-knowledge-cryptography-status-sensitive)

## Alternative Languages

Rust is the primary and recommended language for Soroban contracts. Community-maintained alternatives exist but are not recommended for production:
- **AssemblyScript**: [`as-soroban-sdk`](https://github.com/Soneso/as-soroban-sdk) by Soneso — allows TypeScript-like syntax, officially listed on Stellar docs, but may lag behind the latest protocol version
- **Solidity**: [Hyperledger Solang](https://github.com/hyperledger-solang/solang) — SDF-funded, compiles Solidity to Soroban WASM, currently **pre-alpha** ([docs](https://developers.stellar.org/docs/learn/migrate/evm/solidity-support-via-solang))

## Architecture Overview

### Host-Guest Model
Soroban uses a WebAssembly sandbox with strict separation:
- **Host Environment**: Provides storage, crypto, cross-contract calls
- **Guest Contract**: Your Rust code compiled to WASM
- Contracts reference host objects via handles (not direct memory)

### Key Constraints
- `#![no_std]` required - no Rust standard library
- 64KB contract size limit (use release optimizations)
- Limited heap allocation
- No string type (use `String` from soroban-sdk or `Symbol` for short strings)
- `Symbol` limited to 32 characters (was 10 in earlier versions)

## Project Setup

### Initialize a new contract
```bash
stellar contract init my-contract
cd my-contract
```

This creates:
```
my-contract/
├── Cargo.toml
├── src/
│   └── lib.rs
└── contracts/
    └── hello_world/
        ├── Cargo.toml
        └── src/
            └── lib.rs
```

### Cargo.toml configuration
```toml
[package]
name = "my-contract"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib"]

[dependencies]
soroban-sdk = "25.0.1"  # check https://crates.io/crates/soroban-sdk for latest

[dev-dependencies]
soroban-sdk = { version = "25.0.1", features = ["testutils"] }  # match above

[profile.release]
opt-level = "z"
overflow-checks = true
debug = 0
strip = "symbols"
debug-assertions = false
panic = "abort"
codegen-units = 1
lto = true

[profile.release-with-logs]
inherits = "release"
debug-assertions = true
```

## Contract Constructors (Protocol 22+)

Use constructors for atomic initialization when protocol support is available. This avoids a separate `initialize` transaction and reduces front-running risk.

### Constructor pattern
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Value,
}

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    // Runs once at deployment time.
    pub fn __constructor(env: Env, admin: Address, initial_value: u32) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Value, &initial_value);
    }
}
```

### Deploy with constructor args (CLI)
```bash
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source alice \
  --network testnet \
  -- \
  --admin alice \
  --initial_value 100
```

### Rules
1. Name must be `__constructor` exactly.
2. Constructor returns `()` (no return value).
3. Runs only at creation time and does not run on upgrade.
4. If constructor fails, deployment fails atomically.

### Backwards compatibility
If targeting older protocol environments, use guarded `initialize` patterns and prevent re-initialization explicitly.

## Core Contract Structure

### Basic Contract
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Env, Symbol, Vec};

#[contract]
pub struct HelloContract;

#[contractimpl]
impl HelloContract {
    pub fn hello(env: Env, to: Symbol) -> Vec<Symbol> {
        vec![&env, symbol_short!("Hello"), to]
    }
}
```

### Contract with State
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Counter,
    Admin,
    UserBalance(Address),
}

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    pub fn initialize(env: Env, admin: Address) {
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("already initialized");
        }
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0u32);
    }

    pub fn increment(env: Env) -> u32 {
        let mut count: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        count += 1;
        env.storage().instance().set(&DataKey::Counter, &count);

        // Extend TTL to prevent archival
        env.storage().instance().extend_ttl(100, 518400); // threshold, ~30 days

        count
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}
```

## Storage Types

Soroban has three storage types with different costs and lifetimes:

### Instance Storage
- Tied to contract instance lifetime
- Shared across all users
- Best for: admin addresses, global config, counters
```rust
env.storage().instance().set(&key, &value);
env.storage().instance().get(&key);
env.storage().instance().extend_ttl(min_ttl, extend_to);
```

### Persistent Storage
- Survives archival (can be restored)
- Per-key TTL management
- Best for: user balances, important state
```rust
env.storage().persistent().set(&key, &value);
env.storage().persistent().get(&key);
env.storage().persistent().extend_ttl(&key, min_ttl, extend_to);
```

### Temporary Storage
- Cheapest, automatically deleted when TTL expires
- Cannot be restored after archival
- Best for: caches, temporary flags, session data
```rust
env.storage().temporary().set(&key, &value);
env.storage().temporary().get(&key);
env.storage().temporary().extend_ttl(&key, min_ttl, extend_to);
```

### TTL Management
```rust
// Check remaining TTL
let ttl = env.storage().persistent().get_ttl(&key);

// Extend if below threshold
const MIN_TTL: u32 = 17280;  // ~1 day at 5s ledgers
const EXTEND_TO: u32 = 518400;  // ~30 days

if ttl < MIN_TTL {
    env.storage().persistent().extend_ttl(&key, MIN_TTL, EXTEND_TO);
}
```

## Data Types

### Primitive Types
```rust
use soroban_sdk::{Address, Bytes, BytesN, Map, String, Symbol, Vec, I128, U256};

// Address - account or contract identifier
let addr: Address = env.current_contract_address();

// Symbol - short strings (max 32 chars)
let sym: Symbol = symbol_short!("transfer");

// String - longer strings
let s: String = String::from_str(&env, "Hello, Stellar!");

// Fixed-size bytes
let hash: BytesN<32> = env.crypto().sha256(&bytes);

// Collections
let v: Vec<u32> = vec![&env, 1, 2, 3];
let m: Map<Symbol, u32> = Map::new(&env);
```

### Custom Types
```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: Symbol,
    pub decimals: u32,
}

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address),  // (owner, spender)
}
```

## Authorization

### Requiring Authorization
```rust
#[contractimpl]
impl TokenContract {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        // Require 'from' to authorize this call
        from.require_auth();

        // Or require auth for specific arguments
        from.require_auth_for_args((&to, amount).into_val(&env));

        // Transfer logic...
    }
}
```

### Admin Patterns
```rust
fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}

pub fn set_admin(env: Env, new_admin: Address) {
    require_admin(&env);
    env.storage().instance().set(&DataKey::Admin, &new_admin);
}
```

## Cross-Contract Calls

### Calling Another Contract
```rust
use soroban_sdk::{contract, contractimpl, Address, Env};

mod token_contract {
    soroban_sdk::contractimport!(
        file = "../token/target/wasm32-unknown-unknown/release/token.wasm"
    );
}

#[contract]
pub struct VaultContract;

#[contractimpl]
impl VaultContract {
    pub fn deposit(env: Env, user: Address, token: Address, amount: i128) {
        user.require_auth();

        // Create client for token contract
        let token_client = token_contract::Client::new(&env, &token);

        // Call transfer on token contract
        token_client.transfer(&user, &env.current_contract_address(), &amount);

        // Update vault state...
    }
}
```

### Using Stellar Asset Contract (SAC)
```rust
use soroban_sdk::token::Client as TokenClient;

pub fn transfer_asset(env: Env, from: Address, to: Address, asset: Address, amount: i128) {
    from.require_auth();

    let token = TokenClient::new(&env, &asset);
    token.transfer(&from, &to, &amount);
}
```

## Events

### Emitting Events
```rust
use soroban_sdk::{contract, contractevent, contractimpl, Address, Env};

#[contractevent(topics = ["transfer"])]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

#[contract]
pub struct TokenContract;

#[contractimpl]
impl TokenContract {
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        // ... transfer logic ...

        // Emit event
        TransferEvent { from, to, amount }.publish(&env);
    }
}
```

## Error Handling

### Custom Errors
```rust
use soroban_sdk::contracterror;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    AlreadyInitialized = 1,
    NotInitialized = 2,
    InsufficientBalance = 3,
    Unauthorized = 4,
    InvalidAmount = 5,
}

// Usage
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }

    let balance: i128 = get_balance(&env, &from);
    if balance < amount {
        return Err(ContractError::InsufficientBalance);
    }

    // ... transfer logic ...
    Ok(())
}
```

## Building and Deploying

### Build Contract
```bash
# Build optimized WASM
stellar contract build

# Output: target/wasm32-unknown-unknown/release/my_contract.wasm
```

### Deploy to Testnet
```bash
# Generate and fund a new identity
stellar keys generate --global alice --network testnet --fund

# Deploy contract
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source alice \
  --network testnet

# Returns: CONTRACT_ID (starts with 'C')
```

### Initialize Contract
```bash
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  initialize \
  --admin alice
```

### Invoke Functions
```bash
stellar contract invoke \
  --id CONTRACT_ID \
  --source alice \
  --network testnet \
  -- \
  increment
```

## Unit Testing

```rust
#![cfg(test)]

use super::*;
use soroban_sdk::testutils::Address as _;
use soroban_sdk::Env;

#[test]
fn test_increment() {
    let env = Env::default();
    let contract_id = env.register_contract(None, CounterContract);
    let client = CounterContractClient::new(&env, &contract_id);

    let admin = Address::generate(&env);
    client.initialize(&admin);

    assert_eq!(client.get_count(), 0);
    assert_eq!(client.increment(), 1);
    assert_eq!(client.increment(), 2);
    assert_eq!(client.get_count(), 2);
}

#[test]
fn test_transfer_with_auth() {
    let env = Env::default();
    env.mock_all_auths();  // Auto-approve all auth requests

    let contract_id = env.register_contract(None, TokenContract);
    let client = TokenContractClient::new(&env, &contract_id);

    let alice = Address::generate(&env);
    let bob = Address::generate(&env);

    // Mint tokens to alice
    client.mint(&alice, &1000);

    // Transfer from alice to bob
    client.transfer(&alice, &bob, &100);

    assert_eq!(client.balance(&alice), 900);
    assert_eq!(client.balance(&bob), 100);
}
```

## Best Practices

### Contract Size Optimization
- Use `symbol_short!()` for symbols under 9 chars (more efficient)
- Avoid unnecessary string operations
- Use appropriate storage type for data lifetime
- Consider splitting large contracts

### Storage Efficiency
- Use compact data structures
- Clean up temporary storage
- Batch storage operations when possible
- Manage TTLs proactively to avoid archival

### Security
- Always validate inputs
- Use `require_auth()` for sensitive operations
- Check contract ownership in initialization
- Prevent reinitialization attacks
- Validate cross-contract call targets

### Gas/Resource Optimization
- Minimize storage reads/writes
- Use events for data that doesn't need on-chain queries
- Batch operations where possible
- Profile resource usage with `stellar contract invoke --sim`

## Zero-Knowledge Cryptography (Status-Sensitive)

Stellar's ZK cryptography capabilities are evolving. Treat availability as protocol- and network-dependent.

- [CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md): BLS12-381 primitives
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md): BN254 host functions (proposed)
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md): Poseidon/Poseidon2 host functions (proposed)

Before implementation, always verify:
1. CAP status in the CAP preamble (`Accepted`/`Implemented` vs draft/awaiting decision)
2. Target network software version and protocol support
3. `soroban-sdk` release support for the target host functions

### Practical guidance
- Use BLS12-381 features where supported and documented in your target SDK/network.
- For BN254/Poseidon plans, design feature flags and graceful fallbacks until support is active.
- Keep cryptographic assumptions explicit in audits and deployment notes.

### Example references
- [Groth16 Verifier](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier)
- [Soroban examples repository](https://github.com/stellar/soroban-examples)

> See [zk-proofs.md](../zk-proofs/SKILL.md) for Groth16 verification patterns, Poseidon usage, Noir/RISC Zero integration, and implementation guidance.

---

# Part 2: Testing Strategy


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

---

# Part 3: Security


## Core Principle

Assume the attacker controls:
- All arguments passed to contract functions
- Transaction ordering and timing
- All accounts except those requiring signatures
- The ability to create contracts that mimic your interface

## Soroban Security Advantages

Soroban's architecture prevents certain vulnerability classes by design:

### No Delegate Call
Unlike Ethereum, Soroban has no `delegatecall` equivalent. Contracts cannot execute arbitrary bytecode in their context, eliminating proxy-based attacks.

### No Classical Reentrancy
Soroban's synchronous execution model prevents the cross-contract reentrancy that plagues Ethereum. Self-reentrancy is possible but rarely exploitable.

### Explicit Authorization
Authorization is opt-in via `require_auth()`, making it explicit which operations need signatures.

---

## Vulnerability Categories

### 1. Missing Authorization Checks

**Risk**: Anyone can call privileged functions without proper verification.

**Attack**: Attacker calls admin-only functions, drains funds, or modifies critical state.

**Vulnerable Code**:
```rust
// BAD: No authorization check
pub fn withdraw(env: Env, to: Address, amount: i128) {
    transfer_tokens(&env, &to, amount);
}
```

**Secure Code**:
```rust
// GOOD: Requires authorization from admin
pub fn withdraw(env: Env, to: Address, amount: i128) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    transfer_tokens(&env, &to, amount);
}
```

**Prevention**: Always use `require_auth()` on the caller or an admin address. See Part 1: Contract Development above for full authorization patterns (direct auth, admin helpers, `require_auth_for_args`).

---

### 2. Reinitialization Attacks

**Risk**: Initialization function can be called multiple times, allowing attacker to overwrite admin or critical state.

**Attack**: Attacker reinitializes contract to become the admin, then drains assets.

**Vulnerable Code**:
```rust
// BAD: Can be called multiple times
pub fn initialize(env: Env, admin: Address) {
    env.storage().instance().set(&DataKey::Admin, &admin);
}
```

**Secure Code**:
```rust
// GOOD: Prevents reinitialization
pub fn initialize(env: Env, admin: Address) {
    if env.storage().instance().has(&DataKey::Initialized) {
        panic!("already initialized");
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
    env.storage().instance().set(&DataKey::Initialized, &true);
}

// Alternative: Check for admin existence
pub fn initialize(env: Env, admin: Address) {
    if env.storage().instance().has(&DataKey::Admin) {
        panic!("already initialized");
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
}
```

---

### 3. Arbitrary Contract Calls

**Risk**: Contract calls whatever address is passed as parameter without validation.

**Attack**: Attacker passes malicious contract that mimics expected interface but behaves differently.

**Vulnerable Code**:
```rust
// BAD: Calls any contract passed as parameter
pub fn swap(env: Env, token: Address, amount: i128) {
    let client = token::Client::new(&env, &token);
    client.transfer(...); // Could be malicious contract
}
```

**Secure Code**:
```rust
// GOOD: Validate against known allowlist
pub fn swap(env: Env, token: Address, amount: i128) {
    let allowed_tokens: Vec<Address> = env.storage()
        .instance()
        .get(&DataKey::AllowedTokens)
        .unwrap();

    if !allowed_tokens.contains(&token) {
        panic!("token not allowed");
    }

    let client = token::Client::new(&env, &token);
    client.transfer(...);
}

// Or validate against Stellar Asset Contract
pub fn swap_sac(env: Env, asset: Address, amount: i128) {
    // SACs have known, predictable addresses
    // Verify it's a legitimate SAC if needed
}
```

---

### 4. Integer Overflow/Underflow

**Risk**: Arithmetic operations overflow or underflow, causing unexpected values.

**Attack**: Attacker manipulates amounts to cause overflow, bypassing balance checks.

**Vulnerable Code**:
```rust
// BAD: Unchecked arithmetic
pub fn deposit(env: Env, user: Address, amount: i128) {
    let balance: i128 = get_balance(&env, &user);
    set_balance(&env, &user, balance + amount); // Can overflow
}
```

**Secure Code**:
```rust
// GOOD: Use checked arithmetic
pub fn deposit(env: Env, user: Address, amount: i128) {
    let balance: i128 = get_balance(&env, &user);
    let new_balance = balance.checked_add(amount)
        .expect("overflow");
    set_balance(&env, &user, new_balance);
}

// Also validate inputs
pub fn deposit(env: Env, user: Address, amount: i128) {
    if amount <= 0 {
        panic!("invalid amount");
    }
    // ... rest of logic
}
```

---

### 5. Storage Key Collisions

**Risk**: Different data types share the same storage key, causing data corruption.

**Attack**: Attacker manipulates one type of data to corrupt another.

**Vulnerable Code**:
```rust
// BAD: Same prefix for different data
env.storage().persistent().set(&symbol_short!("data"), &user_balance);
env.storage().persistent().set(&symbol_short!("data"), &config); // Overwrites!
```

**Secure Code**:
```rust
// GOOD: Use typed enum for keys
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Config,
    Allowance(Address, Address),
}

env.storage().persistent().set(&DataKey::Balance(user), &balance);
env.storage().instance().set(&DataKey::Config, &config);
```

---

### 6. Timing/State Race Conditions

**Risk**: Contract state changes between check and use.

**Attack**: In multi-transaction scenarios, attacker exploits gap between validation and action.

**Prevention**:
```rust
// Use atomic operations where possible
pub fn swap(env: Env, user: Address, amount_in: i128, min_out: i128) {
    user.require_auth();

    // Perform all checks and state changes atomically
    let balance = get_balance(&env, &user);
    if balance < amount_in {
        panic!("insufficient balance");
    }

    let amount_out = calculate_output(amount_in);
    if amount_out < min_out {
        panic!("slippage exceeded");
    }

    // Update all state together
    set_balance(&env, &user, balance - amount_in);
    transfer_output(&env, &user, amount_out);
}
```

---

### 7. TTL/Archival Vulnerabilities

**Risk**: Critical contract data gets archived, breaking functionality.

**Attack**: Attacker waits for data to be archived, then exploits the missing state.

**Prevention**:
```rust
// Extend TTL for critical data
pub fn critical_operation(env: Env) {
    // Always extend instance storage
    env.storage().instance().extend_ttl(
        100,      // threshold
        518400,   // extend_to (~30 days)
    );

    // Extend specific persistent keys
    env.storage().persistent().extend_ttl(
        &DataKey::CriticalData,
        100,
        518400,
    );
}

// Consider restoration costs in design
// Archived data can be restored, but requires transaction
```

---

### 8. Cross-Contract Call Validation

**Risk**: Trusting return values from untrusted contracts.

**Attack**: Malicious contract returns false data, causing incorrect state updates.

**Prevention**:
```rust
// Validate all external data
pub fn process_oracle_price(env: Env, oracle: Address, asset: Address) -> i128 {
    // Validate oracle is trusted
    let trusted_oracles: Vec<Address> = env.storage()
        .instance()
        .get(&DataKey::TrustedOracles)
        .unwrap();

    if !trusted_oracles.contains(&oracle) {
        panic!("untrusted oracle");
    }

    let price: i128 = oracle_client.get_price(&asset);

    // Sanity check the value
    if price <= 0 || price > MAX_REASONABLE_PRICE {
        panic!("invalid price");
    }

    price
}
```

---

## Classic Stellar Security

### Trustline Attacks

**Risk**: Users create trustlines to malicious assets that look legitimate.

**Prevention**:
- Verify asset issuer before creating trustlines
- Use well-known asset lists (stellar.toml)
- Display full asset code + issuer in UIs

### Clawback Awareness

**Risk**: Assets with clawback enabled can be seized by issuer.

**Prevention**:
```typescript
// Check if clawback is enabled
const issuerAccount = await server.loadAccount(asset.issuer);
const clawbackEnabled = issuerAccount.flags.auth_clawback_enabled;

if (clawbackEnabled) {
  // Warn user or reject asset
}
```

### Account Merge Attacks

**Risk**: Merged accounts can be recreated with different configuration.

**Prevention**:
- Validate account state before critical operations
- Don't cache account data long-term

---

## Soroban-Specific Checklist

### Contract Development
- [ ] All privileged functions require appropriate authorization
- [ ] Initialization can only happen once
- [ ] External contract calls are validated against allowlists
- [ ] All arithmetic uses checked operations
- [ ] Storage keys are typed and collision-free
- [ ] Critical data TTLs are extended proactively
- [ ] Input validation on all public functions
- [ ] Events emitted for auditable state changes

### Storage Security
- [ ] Sensitive data uses appropriate storage type
- [ ] Instance storage for shared/admin data
- [ ] Persistent storage for user-specific data
- [ ] Temporary storage only for truly temporary data
- [ ] TTL management strategy documented

### Cross-Contract Calls
- [ ] Called contracts are validated or allowlisted
- [ ] Return values are sanity-checked
- [ ] Failure cases handled gracefully
- [ ] No excessive trust in external state

---

## Client-Side Checklist

- [ ] Network passphrase validated before signing
- [ ] Transaction simulation before submission
- [ ] Clear display of all operation details
- [ ] Confirmation for high-value transactions
- [ ] Handle all error states gracefully
- [ ] Don't trust client-side validation alone
- [ ] Verify contract addresses against known deployments
- [ ] Check asset trustline status before transfers

---

## Security Review Questions

1. Can anyone call admin functions without authorization?
2. Can the contract be reinitialized?
3. Are all external contract calls validated?
4. Is arithmetic safe from overflow/underflow?
5. Can storage keys collide?
6. Will critical data survive archival?
7. Are cross-contract return values validated?
8. Can timing attacks exploit state changes?

---

## Bug Bounty Programs

### Immunefi — Stellar Core (up to $250K)
- **URL**: https://immunefi.com/bug-bounty/stellar/
- **Scope**: stellar-core, rs-soroban-sdk, rs-soroban-env, soroban-tools (CLI + RPC), js-soroban-client, rs-stellar-xdr, wasmi fork
- **Rewards**: Critical $50K–$250K, High $10K–$50K, Medium $5K, Low $1K
- **Payment**: USD-denominated, paid in XLM. KYC required.
- **Rules**: PoC required. Test on local forks only (no mainnet/testnet).

### Immunefi — OpenZeppelin on Stellar (up to $25K)
- **URL**: https://immunefi.com/bug-bounty/openzeppelin-stellar/
- **Scope**: OpenZeppelin Stellar Contracts library
- **Max payout**: $25K per bug, $250K total program cap

### HackerOne — Web Applications
- **URL**: https://stellar.org/grants-and-funding/bug-bounty
- **Scope**: SDF web applications, production servers, domains
- **Disclosure**: 90-day remediation window before public disclosure

## Soroban Audit Bank

SDF's proactive security program with **$3M+ deployed across 43+ audits**.

- **URL**: https://stellar.org/grants-and-funding/soroban-audit-bank
- **Projects list**: https://stellar.org/audit-bank/projects
- **Eligibility**: SCF-funded projects (financial protocols, infrastructure, high-traction dApps)
- **Co-payment**: 5% upfront (refundable if Critical/High/Medium issues remediated within 20 business days)
- **Follow-up audits**: Triggered at $10M and $100M TVL milestones (includes formal verification and competitive audits)
- **Preparation**: STRIDE threat modeling framework + Audit Readiness Checklist

### Partner Audit Firms

| Firm | Specialty |
|------|-----------|
| **OtterSec** | Smart contract audits |
| **Veridise** | Tool-assisted audits, [security checklist](https://veridise.com/blog/audit-insights/building-on-stellar-soroban-grab-this-security-checklist-to-avoid-vulnerabilities/) |
| **Runtime Verification** | Formal methods, [Komet tool](https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification) |
| **CoinFabrik** | Static analysis (Scout), manual audits |
| **QuarksLab** | Security research |
| **Coinspect** | Security audits |
| **Certora** | Formal verification ([Sunbeam Prover](https://docs.certora.com/en/latest/docs/sunbeam/index.html)) |
| **Halborn** | Security assessments |
| **Zellic** | Blockchain + cryptography research |
| **Code4rena** | Competitive audit platform |

## Security Tooling

### Static Analysis

#### Scout Soroban (CoinFabrik)
Open-source vulnerability detector with 23 detectors (critical through enhancement severity).
- **GitHub**: https://github.com/CoinFabrik/scout-soroban
- **Install**: `cargo install cargo-scout-audit` → `cargo scout-audit`
- **Output formats**: HTML, Markdown, JSON, PDF, SARIF (CI/CD integration)
- **VSCode extension**: [Scout Audit](https://marketplace.visualstudio.com/items?itemName=CoinFabrik.scout-audit)
- **Key detectors**: `overflow-check`, `unprotected-update-current-contract-wasm`, `set-contract-storage`, `unrestricted-transfer-from`, `divide-before-multiply`, `dos-unbounded-operation`, `unsafe-unwrap`

#### OpenZeppelin Security Detectors SDK
Framework for building custom security detectors for Soroban.
- **GitHub**: https://github.com/OpenZeppelin/soroban-security-detectors-sdk
- **Architecture**: `sdk` (core), `detectors` (pre-built), `soroban-scanner` (CLI)
- **Pre-built detectors**: `auth_missing`, `unchecked_ft_transfer`, improper TTL extension, contract panics, unsafe temporary storage
- **Extensible**: Load external detector libraries as shared objects

### Formal Verification

#### Certora Sunbeam Prover
Purpose-built formal verification for Soroban — first WASM platform supported by Certora.
- **Docs**: https://docs.certora.com/en/latest/docs/sunbeam/index.html
- **Spec language**: CVLR (Certora Verification Language for Rust) — Rust macros (`cvlr_assert!`, `cvlr_assume!`, `cvlr_satisfy!`)
- **Operates at**: WASM bytecode level (eliminates compiler trust assumptions)
- **Reports**: https://github.com/Certora/SecurityReports
- **Example**: [Blend V1 verification report](https://www.certora.com/reports/blend-smart-contract-verification-report)

#### Runtime Verification — Komet
Formal verification and testing tool built specifically for Soroban (SCF-funded).
- **Docs**: https://docs.runtimeverification.com/komet
- **Repo**: https://github.com/runtimeverification/komet
- **Spec language**: Rust — property-based tests written in the same language as Soroban contracts
- **Operates at**: WASM bytecode level via [KWasm semantics](https://github.com/runtimeverification/wasm-semantics) (eliminates compiler trust assumptions)
- **Features**: Fuzzing, testing, formal verification
- **Reports**: [RV publications](https://github.com/runtimeverification/publications)
- **Example**: [TokenOps audit and verification report](https://github.com/runtimeverification/publications/blob/main/reports/smart-contracts/TokenOps.pdf)
- **Blog**: [Introducing Komet](https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification)

### Security Knowledge Base

#### Soroban Security Portal
Community security knowledge base by Inferara (SCF-funded).
- **URL**: https://sorobansecurity.com
- **Features**: Searchable audit reports, vulnerability database, best practices

### Security Monitoring (Post-Deployment)

#### OpenZeppelin Monitor (Stellar alpha)
Open-source contract monitoring with Stellar support.
- **Features**: Self-hosted via Docker, Prometheus + Grafana observability
- **Source**: https://www.openzeppelin.com/news/monitor-and-relayers-are-now-open-source

## OpenZeppelin Partnership Overview

Strategic partnership highlights include:
- **40 Auditor Weeks** of dedicated security audits
- **Stellar Contracts library** (audited, production-ready)
- **Relayer** (fee-sponsored transactions, Stellar-native)
- **Monitor** (contract monitoring, Stellar alpha)
- **Security Detectors SDK** (static analysis framework)
- **SEP authorship**: SEP-0049 (Upgradeable Contracts), SEP-0050 (NFTs)
- **Blog**: https://stellar.org/blog/foundation-news/sdf-partners-with-openzeppelin-to-enhance-stellar-smart-contract-development

---

# Part 4: Advanced Patterns


## When to use this guide
Use this guide for higher-complexity contract architecture:
- Upgrades and migrations
- Factory/deployer systems
- Governance and timelocks
- DeFi primitives (vaults, pools, oracles)
- Regulated token/compliance workflows
- Resource and storage optimization

For core contract syntax and day-to-day patterns, refer to the earlier sections in this guide covering contract structure, storage, authorization, cross-contract calls, events, error handling, and testing.

## Design principles
- Prefer simple state machines over implicit behavior.
- Minimize privileged entrypoints and protect all privileged actions with explicit auth.
- Keep upgrades predictable: version metadata + migration plan + rollback strategy.
- Use idempotent migrations and fail fast on incompatible versions.
- Separate protocol/business logic from governance/admin logic when possible.

## Upgradeability patterns

### 1) Explicit upgrade policy
- Decide early whether the contract is mutable or immutable.
- If mutable, implement an `upgrade` entrypoint guarded by admin or governance.
- If immutable, do not expose upgrade capability.

### 2) Version tracking
Track both runtime and code version:
- Contract metadata (`contractmeta!`) for binary version
- Storage key for migration/application version

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, contracttype, Address, BytesN, Env};

contractmeta!(key = "binver", val = "1.0.0");

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    AppVersion,
}

#[contract]
pub struct Upgradeable;

#[contractimpl]
impl Upgradeable {
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::AppVersion, &1u32);
    }

    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}
```

### 3) Migration entrypoint
- Add a dedicated `migrate` function after upgrades.
- Ensure migration is monotonic (`new_version > current_version`).
- Treat migrations as one-way and idempotent.

## Factory and deployment patterns

### Factory contract responsibilities
- Authorize who can deploy instances.
- Derive deterministic addresses with salts when needed.
- Emit events for deployments (indexing/ops observability).
- Keep deployment logic separate from instance business logic.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Val, Vec};

#[contract]
pub struct Factory;

#[contractimpl]
impl Factory {
    pub fn deploy(
        env: Env,
        owner: Address,
        wasm_hash: BytesN<32>,
        salt: BytesN<32>,
        constructor_args: Vec<Val>,
    ) -> Address {
        owner.require_auth();
        env.deployer()
            .with_address(env.current_contract_address(), salt)
            .deploy_v2(wasm_hash, constructor_args)
    }
}
```

Operational note:
- Keep a registry (or emit canonical deployment events) to avoid orphaned instances.

## Governance patterns

### Timelock for sensitive actions
Use a timelock for upgrades and major config changes:
- `propose_*` stores pending action + execute ledger
- `execute_*` enforces delay
- `cancel_*` allows governance abort

### Multisig and role separation
- Separate roles: proposer, approver, executor.
- Define threshold and signer rotation process.
- Record proposal state in persistent storage and prevent replay.

Checklist:
- Proposal uniqueness and replay protection
- Expiry semantics
- Clear cancellation path
- Explicit event emission

## DeFi primitives

### Vaults
- Track `total_assets` and `total_shares` with careful rounding rules.
- Use conservative math for mint/redeem conversions.
- Enforce pause/emergency controls for admin-level intervention.

### Pools/AMMs
- Define invariant and fee accounting precisely.
- Protect against stale pricing and manipulation.
- Include slippage checks on all user-facing swaps.

### Oracle integration
- Require freshness constraints (ledger/time bounds).
- Prefer median/multi-source feeds for critical operations.
- Add circuit breakers for extreme price movement.

## Compliance-oriented token design

Common regulated features:
- Allowlist/denylist checks before transfer
- Jurisdiction or investor-class restrictions
- Forced transfer/freeze authority with auditable governance
- Off-chain identity references (never store sensitive PII directly)

Implementation guidance:
- Keep compliance policy in dedicated modules/entrypoints.
- Emit policy decision events for traceability.
- Treat privileged compliance actions as high-risk operations requiring strong auth.

## Resource optimization

### Storage
- Use `instance` for global config.
- Use `persistent` for critical user state.
- Use `temporary` only for disposable data.
- Extend TTL strategically, not on every call.

### Compute
- Avoid unbounded loops over user-controlled collections.
- Prefer bounded batch operations.
- Reduce cross-contract calls in hot paths.

### Contract size
- Keep release profile optimized (`opt-level = "z"`, `lto = true`, `panic = "abort"`).
- Split concerns across contracts when near Wasm size limits.

## Security review checklist for advanced architectures
- Access control is explicit on every privileged path.
- Upgrade and migration are both tested (happy path + failure path).
- Timelock and governance logic is replay-safe.
- External dependency assumptions are documented.
- Emergency controls and incident runbooks are defined.
- Events cover operationally important transitions.

## Testing strategy for advanced patterns
- Unit tests for role checks, invariants, and edge-case math.
- Integration tests for multi-step governance flows.
- Upgrade tests from old state snapshots to new versions.
- Negative tests for unauthorized and malformed calls.

---

# Part 5: Common Pitfalls


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

> See Part 1: Contract Development above for full TTL management patterns and storage type guidance.

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

> See Part 2: Testing Strategy above for comprehensive auth testing patterns including `mock_all_auths()`, specific auth mocking, and cross-contract auth.

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
