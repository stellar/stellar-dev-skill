# Testing

Testing strategy for Stellar smart contracts, from fast native unit tests to mainnet-fork tests. Companion to [SKILL.md](SKILL.md), [development.md](development.md), and [security.md](security.md).

Layers, fastest first:

1. **Unit tests** — native Rust with `soroban-sdk` testutils (not WASM, full debugger support)
2. **Local integration** — Stellar Quickstart container
3. **Testnet** — public network rehearsal
4. **Fork tests** — replay against real ledger state

## Unit testing

```rust
// src/test.rs — a separate file included from lib.rs with `mod test;`
// (the layout `stellar contract init` scaffolds). The inner `#![cfg(test)]`
// gates this whole module; don't paste it into lib.rs itself.
#![cfg(test)]
extern crate std;  // contracts are no_std; tests can still use std explicitly
use soroban_sdk::{
    testutils::{Address as _, MockAuth, MockAuthInvoke},
    Address, Env, IntoVal,
};
use crate::{Contract, ContractClient};

#[test]
fn test_basic() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());      // () = no constructor args
    let client = ContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    client.set_owner(&user);
    assert_eq!(client.get_value(), 0);
}
```

`env.register` takes constructor args as its second parameter — `env.register(Contract, (admin.clone(),))` for a contract with `__constructor(env, admin)`. Use `env.register_at(&address, Contract, args)` to pin a specific address.

**Resource limits are enforced in tests** (SDK 25+): `Env::default()` applies mainnet CPU/memory limits to invocations, so a contract that would blow the budget in production fails in unit tests — that's a feature. For deliberately heavy tests: `env.cost_estimate().disable_resource_limits()`; to read consumption, `env.cost_estimate().resources()`.

### Authorization

`mock_all_auths()` approves everything — convenient, but it can hide missing `require_auth` calls. Always pair it with `env.auths()` assertions, or mock specific auths:

```rust
#[test]
fn test_auth() {
    let env = Env::default();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);
    let other = Address::generate(&env);
    // Approve only this specific invocation
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
    assert!(!env.auths().is_empty());  // verify auth was actually required
}
```

`env.auths()` returns `(Address, AuthorizedInvocation)` pairs **for the most recent invocation only** — any later client call (even a read) resets it, so assert immediately after the call under test. Assert the exact tree (function, args, sub-invocations) on security-critical paths so a dropped `require_auth` fails the test. If a contract authorizes calls below the entry point (e.g. via `authorize_as_current_contract`), use `mock_all_auths_allowing_non_root_auth()`.

### Time and ledger state

```rust
env.ledger().set_timestamp(1000);          // for vesting/timelock logic
env.ledger().set_sequence_number(1000);
// ... act, then advance:
env.ledger().set_timestamp(2500);
```

### Events

Events defined with `#[contractevent]` compare directly against emitted XDR:

```rust
use soroban_sdk::{testutils::Events as _, Event as _};

let expected = Transfer { from: from.clone(), to: to.clone(), amount: 100 };
assert_eq!(
    env.events().all(),
    std::vec![expected.to_xdr(&env, &contract_id)],
);
```

`env.events().all()` returns the events of the **most recent invocation** as `ContractEvents` (like `env.auths()`, it resets on every call — assert right after the call under test); `event.to_xdr(&env, &contract_id)` builds the expected `xdr::ContractEvent` from the struct.

### Storage TTL

```rust
use soroban_sdk::testutils::storage::Persistent as _;  // get_ttl lives on testutils traits

let ttl: u32 = env.as_contract(&contract_id, || {
    env.storage().persistent().get_ttl(&DataKey::MyData)
});
assert!(ttl > 0);
```

### Cross-contract

Register a real dependency from its WASM and test the interaction:

```rust
mod token { soroban_sdk::contractimport!(file = "token.wasm"); }

let token_id = env.register(token::WASM, ());
let vault_id = env.register(VaultContract, ());
// drive both through their typed clients
```

## Local network

```bash
stellar container start local     # or: docker run --rm -it -p 8000:8000 stellar/quickstart:latest --local
stellar keys generate test-account --network local --fund
stellar contract deploy --wasm target/wasm32v1-none/release/contract.wasm \
  --source-account test-account --network local
```

Endpoints: RPC `http://localhost:8000/soroban/rpc`, Horizon `http://localhost:8000`, passphrase `"Standalone Network ; February 2017"`.

## Testnet

```bash
stellar keys generate my-key --network testnet --fund
stellar contract deploy --wasm ... --source-account my-key --network testnet
```

- RPC: `https://soroban-testnet.stellar.org` · Horizon: `https://horizon-testnet.stellar.org`
- Passphrase: `"Test SDF Network ; September 2015"` · Friendbot: `https://friendbot.stellar.org`
- **Testnet resets quarterly** — everything is deleted. Script your deployments; never treat testnet state as durable.
- Testnet runs the next protocol version before mainnet — it's where you verify against an upcoming upgrade.

## Integration tests

TypeScript, against local or testnet (the same flow a frontend uses — simulate, assemble, sign, send):

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const rpc = new StellarSdk.rpc.Server(process.env.RPC_URL!);
const account = await rpc.getAccount(keypair.publicKey());
const contract = new StellarSdk.Contract(contractId);

const tx = new StellarSdk.TransactionBuilder(account, { fee: "100", networkPassphrase })
  .addOperation(contract.call("initialize", StellarSdk.Address.fromString(keypair.publicKey()).toScVal()))
  .setTimeout(30)
  .build();

const sim = await rpc.simulateTransaction(tx);
const prepared = StellarSdk.rpc.assembleTransaction(tx, sim).build();
prepared.sign(keypair);
const result = await rpc.sendTransaction(prepared);
```

In Rust, gate network-dependent tests behind `#[ignore]` and run them with `cargo test -- --ignored` in environments where the network is up.

## Fuzz testing

All `#[contracttype]` types implement `SorobanArbitrary` under the `testutils` feature, so fuzzing works out of the box with `cargo-fuzz`:

```bash
rustup install nightly
cargo install --locked cargo-fuzz
cargo fuzz init
```

The default scaffold's `crate-type = ["lib", "cdylib"]` already exposes the lib target fuzzing needs; add `soroban-sdk = { version = "...", features = ["testutils"] }` to `fuzz/Cargo.toml`.

```rust
// fuzz/fuzz_targets/fuzz_deposit.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use soroban_sdk::{testutils::Address as _, Address, Env};
use my_contract::{Contract, ContractClient};

fuzz_target!(|amount: i128| {
    let env = Env::default();
    env.mock_all_auths();
    let contract_id = env.register(Contract, ());
    let client = ContractClient::new(&env, &contract_id);
    let user = Address::generate(&env);

    let _ = client.try_deposit(&user, &amount);  // must never panic unexpectedly
});
```

Run with `cargo +nightly fuzz run fuzz_deposit`. For token contracts there's a reusable harness: [soroban-token-fuzzer](https://github.com/brson/soroban-token-fuzzer). Docs: [fuzzing guide](https://developers.stellar.org/docs/build/guides/testing/fuzzing).

## Property-based testing

`proptest` + `SorobanArbitrary` runs in plain `cargo test` — use it to lock in invariants found by fuzzing:

```rust
proptest! {
    #[test]
    fn deposit_then_withdraw_preserves_balance(amount in 1i128..=i128::MAX) {
        // setup as usual...
        client.deposit(&user, &amount);
        client.withdraw(&user, &amount);
        prop_assert_eq!(client.balance(&user), 0);
    }
}
```

Workflow: fuzz interactively to find deep bugs → convert findings to proptest regressions for CI.

## Snapshots, fork tests, mutation tests

Three techniques worth knowing; each is one command plus a doc link:

- **Test snapshots**: every test writes a JSON snapshot of events + final ledger state to `test_snapshots/`. Commit them — diffs expose unintended behavioral changes. (Disable per-env with `Env::new_with_config` if they're noise.) [Docs](https://developers.stellar.org/docs/build/guides/testing/differential-tests-with-test-snapshots)
- **Fork testing**: `stellar snapshot create --address C... --output json --out snapshot.json`, then `Env::from_ledger_snapshot_file("snapshot.json")` to test against real network state. Also useful for upgrade rehearsals: `stellar contract fetch --id C... --out-file deployed.wasm`, register both old and new versions, compare behavior. [Docs](https://developers.stellar.org/docs/build/guides/testing/fork-testing)
- **Mutation testing**: `cargo install --locked cargo-mutants && cargo mutants` — mutates your source and reports `MISSED` where tests didn't notice. [Docs](https://developers.stellar.org/docs/build/guides/testing/mutation-testing)

## Resource profiling

```bash
stellar contract invoke --id CONTRACT_ID --source-account alice --network testnet \
  --send=no -- function_name --arg value
```

Simulation reports CPU instructions, ledger reads/writes, and fees without submitting. In unit tests, `env.cost_estimate().resources()` gives the same numbers programmatically.

## CI

```yaml
name: Test contracts
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: rustup target add wasm32v1-none
      - run: cargo test
      - run: cargo build --release --target wasm32v1-none
```

For integration jobs, run `stellar/quickstart` as a service container and deploy with the CLI (`cargo install stellar-cli --locked`).

## Checklist

- [ ] Unit tests cover all public functions, including error paths (`try_` methods)
- [ ] Edge cases: zero amounts, max values, empty state
- [ ] Authorization verified with `env.auths()` or specific `mock_auths`
- [ ] Events asserted (`event.to_xdr` comparison)
- [ ] Storage TTL behavior validated
- [ ] Cross-contract interactions tested against real WASM
- [ ] Fuzz targets for value-moving paths (deposit, withdraw, swap)
- [ ] Property tests for invariants
- [ ] Test snapshots committed
- [ ] Integration test against local network in CI
- [ ] Testnet rehearsal before mainnet
