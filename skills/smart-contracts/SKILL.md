---
name: smart-contracts
description: Stellar smart contract development (Rust, soroban-sdk). Entry point with project setup, contract anatomy, and build/deploy workflow, routing to three companion files in this directory — development.md (storage/TTL, authorization, cross-contract calls, tokens, events, errors, upgrades, fees, troubleshooting), testing.md (unit, fuzz, property, fork, mutation, integration), and security.md (vulnerability classes, checklists, tooling, audits). Use when writing, testing, reviewing, securing, debugging, or shipping Stellar smart contracts, including anything the user calls "Soroban" — Soroban contracts, soroban-sdk, Soroban auth/storage/TTL errors, SEP-41 tokens, or SAC integration from contract code.
user-invocable: true
argument-hint: "[contract task]"
---

# Stellar Smart Contracts

Guide for building Stellar smart contracts in Rust. Smart contracts on Stellar were formerly branded "Soroban" — the platform name is retired, but the Rust SDK (`soroban-sdk`) and several tool names keep the prefix.

This file covers setup and the core workflow. The deep dives live alongside it — **read the file that matches the task**:

| Task | File |
|------|------|
| Storage/TTL, authorization, constructors, cross-contract calls, tokens, events, errors, upgrades, factories, governance/DeFi patterns, fees/resources, troubleshooting | [development.md](development.md) |
| Unit, integration, fuzz, property, fork, and mutation testing | [testing.md](testing.md) |
| Security review, vulnerability classes, checklists, audit prep, tooling | [security.md](security.md) |

## When to use this skill
- Writing a Stellar smart contract in Rust
- Setting up contract tests (any layer)
- Reviewing a contract for security issues
- Architecting upgradeable contracts, factories, custom accounts, or DeFi primitives
- Debugging a contract-specific error (auth, storage, archival, resource limits)

## Related skills
- Asset issuance, trustlines, and SAC deployment → `../assets/SKILL.md`
- Frontend/wallets that call your contract → `../dapp/SKILL.md`
- Chain data queries (RPC/Horizon) → `../data/SKILL.md`
- ZK verification (BLS12-381, Groth16, Circom/Noir/RISC Zero) → `../zk-proofs/SKILL.md`
- SEP/CAP standards and ecosystem links → `../standards/SKILL.md`

## Versions

This skill was written against **protocol 27** (`soroban-sdk` v27, `rs-soroban-env` v27, `stellar-cli` v27). Version numbers in examples are illustrative — resolve the current ones from these sources rather than trusting any doc:

- **`soroban-sdk` major version tracks the protocol version** (SDK 27 ↔ protocol 27). This rule outlives any specific release.
- Latest SDK release: [crates.io/crates/soroban-sdk](https://crates.io/crates/soroban-sdk) (or `cargo add soroban-sdk`, which resolves it). Pre-releases (`-rc.x`) exist only during a protocol rollout and must be pinned with the exact version string; [GitHub releases](https://github.com/stellar/rs-soroban-sdk/releases) lists them with changelogs.
- Networks upgrade by validator vote, testnet before mainnet — pin the SDK major matching the network you deploy to. Live protocol version: RPC `getVersionInfo` or [Stellar Lab](https://lab.stellar.org).
- Numeric network limits quoted here are mainnet settings at time of writing; they change by vote — [Stellar Lab's Network Limits page](https://lab.stellar.org/network-limits) and `stellar network settings --network mainnet` show the live values.

## Platform constraints

Contracts are Rust compiled to WebAssembly, run in a sandboxed host:

- `#![no_std]` required — use `soroban_sdk` types (`String`, `Vec`, `Map`, `Symbol`), not the Rust standard library
- Compile for the **`wasm32v1-none`** target (Rust ≥ 1.84) — the only Wasm target the Stellar runtime supports
- 128KB compiled contract size limit (network-configured)
- `Symbol` is limited to 32 characters (`a-zA-Z0-9_`); `symbol_short!()` covers up to 9
- Storage is rented: every entry has a TTL and can be archived — see [development.md](development.md#storage)
- No `delegatecall`, and cross-contract reentrancy is blocked by the host — see [security.md](security.md)
- No I/O, no networking, no clock beyond the ledger timestamp — everything a contract can do hangs off `Env`

## Project setup

```bash
stellar contract init my-contract   # scaffolds a Cargo workspace with contracts/
cd my-contract
rustup target add wasm32v1-none     # once per toolchain
```

`Cargo.toml` essentials (what `stellar contract init` generates):

```toml
[lib]
crate-type = ["lib", "cdylib"]   # lib is needed for tests and fuzzing

[dependencies]
soroban-sdk = "27.0.0-rc.1"  # protocol 27; pre-releases need the exact version string.
                             # Mainnet is on protocol 26 at the time of writing — use "26" there
                             # until the network upgrades. Check crates.io for the latest.

[dev-dependencies]
soroban-sdk = { version = "27.0.0-rc.1", features = ["testutils"] }  # match above

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

One compact example showing state, constructor, auth, TTL, a typed error, and an event:

```rust
#![no_std]
use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, Address, Env,
};

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

// Emitted as topics ("incremented", by) with data {count} — #[topic] fields
// become topics, the rest go in the data payload.
#[contractevent]
pub struct Incremented {
    #[topic]
    pub by: Address,
    pub count: u32,
}

#[contract]
pub struct CounterContract;

#[contractimpl]
impl CounterContract {
    // Runs once, atomically, at deploy time. Must be named `__constructor`.
    // Does not run again on upgrade.
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
        env.storage().instance().extend_ttl(120 * 17280, 180 * 17280);

        Incremented { by: admin, count }.publish(&env);
        Ok(count)
    }

    pub fn get_count(env: Env) -> u32 {
        env.storage().instance().get(&DataKey::Counter).unwrap_or(0)
    }
}
```

Full patterns (three storage types, auth variants, cross-contract calls, tokens, custom types): [development.md](development.md).

## Build, deploy, invoke

```bash
# Build optimized WASM → target/wasm32v1-none/release/*.wasm
# (optimization is on by default; --optimize=false to disable)
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

## Verify your build

Nothing on-chain ties a deployed WASM to its source. [SEP-0055](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0055.md) (Draft) closes that gap: build in GitHub Actions, stamp the source repository into the WASM's `contractmetav0` section, and publish a [GitHub build attestation](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds) over the binary — anyone can then walk from the on-chain WASM hash back to the commit and the workflow run that produced it. Verifiers read the attestation from `api.github.com/repos/<owner>/<repo>/attestations/sha256:<wasm-hash>` unauthenticated, so the source repository has to be public for that "anyone" to hold; on a private repo the provenance exists but no user can check it. Make it a standard step before **any** mainnet deploy; it costs one workflow file, so there's no reason to reserve it for user-facing contracts.

Two metadata entries carry it (`stellar contract build --meta key=value`, read back with `stellar contract info meta --wasm <file>`):

- `source_repo=github:<owner>/<repo>` — where the source lives
- `home_domain=<domain>` — domain serving your SEP-1 `stellar.toml`, for org/token lookup (optional; bare domain, no scheme or path)

[soroban-build-workflow](https://github.com/stellar-expert/soroban-build-workflow) does the whole job — build with the metadata, optimize, attest, publish a release with the WASM attached, and register the build with stellar.expert's contract validation.

Resolve its version yourself instead of copying a pin out of any documentation, this file included. Pins go stale, and the newest tag in that repo is not always a published release:

```bash
gh release view --repo stellar-expert/soroban-build-workflow --json tagName  # latest release
gh api repos/stellar-expert/soroban-build-workflow/commits/<tag> --jq .sha   # its commit
```

Read that release's `release.yml` before wiring it in — it should check out the tagged commit, build from source, and attest the same file it uploads. If it doesn't, stop and tell the user rather than pinning it anyway. Then pin the full commit SHA, not the tag: tags are mutable, and this workflow runs with your repository token, OIDC, and attestation permissions.

```yaml
# .github/workflows/release.yml — verified build on every version tag
name: Build and Release
on:
  push:
    tags: ["v*"]

permissions:            # inherited by the called workflow, which cannot elevate them
  contents: write       # create the release, attach the WASM
  id-token: write       # sign the attestation
  attestations: write   # publish it

jobs:
  release:
    # full SHA of the release you just reviewed; keep the version in the comment
    uses: stellar-expert/soroban-build-workflow/.github/workflows/release.yml@<commit-sha>  # vX.Y.Z
    with:
      release_name: ${{ github.ref_name }}
      home_domain: example.com   # optional
      package: my-contract       # optional — omit to build the working directory
    secrets:
      release_token: ${{ secrets.GITHUB_TOKEN }}   # created by GitHub, nothing to configure
```

Then deploy **the WASM attached to that release**, not a local rebuild — compilation environments vary, and a hash that differs by one byte matches no attestation.

The result shows up in [Stellar Lab's contract explorer](https://developers.stellar.org/docs/tools/lab/smart-contracts/contract-explorer#build-info) and on stellar.expert. Be precise with users about what it proves: a specific workflow run built this binary from this commit. It says nothing about whether that code is safe or was ever reviewed.

## Minimal test

```rust
// src/test.rs — included from lib.rs with `mod test;`
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

Auth mocking, event assertions, fuzzing, fork tests, and CI setup: [testing.md](testing.md).

## Before mainnet

Work through the checklists in [security.md](security.md) — authorization, reinitialization, arithmetic, storage TTLs, and cross-contract validation are the recurring failure modes. Ship the deploy through a [verified build](#verify-your-build) so the on-chain WASM hash traces back to a reviewable commit.

## Documentation

- [Smart contract docs](https://developers.stellar.org/docs/build/smart-contracts)
- [Example contracts](https://github.com/stellar/soroban-examples)
- [soroban-sdk API reference](https://docs.rs/soroban-sdk)
- [Stellar CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli)
