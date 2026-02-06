# Soroban Smart Contract Development

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

> See [zk-proofs.md](zk-proofs.md) for Groth16 verification patterns, Poseidon usage, Noir/RISC Zero integration, and implementation guidance.
