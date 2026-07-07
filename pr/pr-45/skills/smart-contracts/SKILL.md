---
name: smart-contracts
description: Stellar smart contract development (Rust, soroban-sdk). Entry point with project setup, contract anatomy, and build/deploy workflow, routing to three companion files in this directory — development.md (storage, auth, cross-contract calls, events, errors, upgrades, factories, troubleshooting), testing.md (unit, fuzz, property, fork, mutation, integration), and security.md (vulnerability classes, checklists, tooling, audits). Use when writing, testing, securing, or shipping Stellar smart contracts (formerly branded Soroban).
user-invocable: true
argument-hint: "[contract task]"
---

# Stellar Smart Contracts

Guide for building Stellar smart contracts in Rust. Smart contracts on Stellar were formerly branded "Soroban" — the platform name is retired, but the Rust SDK (`soroban-sdk`) and several tool names keep the prefix.

This file covers setup and the core workflow. The deep dives live alongside it — **read the file that matches the task**:

| Task | File |
|------|------|
| Storage, auth, cross-contract calls, events, errors, upgrades, factories, troubleshooting | [development.md](development.md) |
| Unit, integration, fuzz, property, fork, and mutation testing | [testing.md](testing.md) |
| Security review, vulnerability classes, checklists, audit prep, tooling | [security.md](security.md) |

## When to use this skill
- Writing a Stellar smart contract in Rust
- Setting up contract tests (any layer)
- Reviewing a contract for security issues
- Architecting upgradeable contracts, factories, governance, or DeFi primitives
- Debugging a contract-specific error (auth, storage, archival, resource limits)

## Related skills
- Assets, trustlines, and SAC bridge → `../assets/SKILL.md`
- Frontend/wallets that call your contract → `../dapp/SKILL.md`
- Chain data queries (RPC/Horizon) → `../data/SKILL.md`
- ZK verification (BLS12-381, Groth16, Circom/Noir/RISC Zero) → `../zk-proofs/SKILL.md`
- SEP/CAP standards and ecosystem links → `../standards/SKILL.md`

## Platform constraints

Contracts are Rust compiled to WebAssembly, run in a sandboxed host:

- `#![no_std]` required — use `soroban_sdk` types (`String`, `Vec`, `Map`, `Symbol`), not the Rust standard library
- 64KB compiled contract size limit — use the release profile below
- `Symbol` is limited to 32 characters; `symbol_short!()` covers up to 9
- Storage is rented: every entry has a TTL and can be archived — see [development.md](development.md#storage)
- No `delegatecall`, no classical cross-contract reentrancy — see [security.md](security.md)

## Project setup

```bash
stellar contract init my-contract   # scaffolds a Cargo workspace with contracts/
cd my-contract
```

`Cargo.toml` essentials:

```toml
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
```

## Contract anatomy

One compact example showing state, constructor, auth, TTL, and a typed error:

```rust
#![no_std]
use soroban_sdk::{contract, contracterror, contractimpl, contracttype, Address, Env};

#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Counter,
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    NotInitialized = 1,
}

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    // Runs once, atomically, at deploy time (Protocol 22+). Must be named
    // `__constructor` and return (). Does not run again on upgrade.
    pub fn __constructor(env: Env, admin: Address) {
        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Counter, &0u32);
    }

    pub fn increment(env: Env) -> Result<u32, Error> {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .ok_or(Error::NotInitialized)?;
        admin.require_auth();

        let count: u32 = env.storage().instance().get(&DataKey::Counter).unwrap_or(0);
        let count = count + 1;
        env.storage().instance().set(&DataKey::Counter, &count);

        // Extend TTL so contract state is not archived (threshold, extend-to)
        env.storage().instance().extend_ttl(100, 518400);

        Ok(count)
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}
```

Full patterns (three storage types, auth variants, cross-contract calls, events, custom types): [development.md](development.md).

## Build, deploy, invoke

```bash
# Build optimized WASM → target/wasm32v1-none/release/*.wasm
stellar contract build

# Create and fund an identity (testnet)
stellar keys generate alice --network testnet --fund

# Deploy (constructor args go after the `--`)
stellar contract deploy \
  --wasm target/wasm32v1-none/release/my_contract.wasm \
  --source-account alice \
  --network testnet \
  -- \
  --admin alice

# Invoke
stellar contract invoke \
  --id CONTRACT_ID \
  --source-account alice \
  --network testnet \
  -- \
  increment
```

To upload WASM without instantiating (e.g. for factories or upgrades), use `stellar contract upload` (the older `stellar contract install` is a deprecated alias).

## Minimal test

```rust
#![cfg(test)]
use super::*;
use soroban_sdk::{testutils::Address as _, Address, Env};

#[test]
fn test_increment() {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let contract_id = env.register(CounterContract, (admin.clone(),));
    let client = CounterContractClient::new(&env, &contract_id);

    assert_eq!(client.increment(), 1);
    assert_eq!(client.get_count(), 1);
}
```

Auth mocking, fuzzing, fork tests, and CI setup: [testing.md](testing.md).

## Before mainnet

Work through the checklists in [security.md](security.md) — authorization, reinitialization, arithmetic, storage TTLs, and cross-contract validation are the recurring failure modes.

## Documentation

- [Smart contract docs](https://developers.stellar.org/docs/build/smart-contracts)
- [Example contracts](https://github.com/stellar/soroban-examples)
- [soroban-sdk API reference](https://docs.rs/soroban-sdk)
- [Stellar CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli)
