# Development Patterns

Core and advanced patterns for Stellar smart contracts. For setup and the basic workflow, start at [SKILL.md](SKILL.md); for tests see [testing.md](testing.md); for security review see [security.md](security.md).

## Execution model

Contracts run as WebAssembly guests in a sandboxed host inside stellar-core. Each transaction gets its own host environment; each contract invoked (directly or nested) runs in its own guest VM inside that host. The host provides storage, crypto, auth, and cross-contract calls; guest code references host objects (`Vec`, `Map`, `Bytes`, `String`, `Address`, …) via integer handles — the host does the actual work and meters every step. Practical consequences:

- `#![no_std]` — use `soroban_sdk` collections and strings; Rust is the supported language
- **A transaction is the atomicity boundary.** Returned errors, panics, missing auth, and budget exhaustion roll back *all* ledger changes, including writes made by nested calls before the failure. A caller can catch a callee's error (via `try_` client methods) and continue.
- **Reentrancy is blocked by the host.** A contract cannot be re-entered directly or indirectly through normal calls. External calls are still failure/budget/side-effect boundaries — order state updates deliberately.
- Contract state lives in storage, never in the `#[contract]` struct — `#[contract] pub struct Foo { x: i128 }` does not persist `x`.
- Everything a contract can reach hangs off `Env`: `storage()`, `events()`, `crypto()`, `ledger()`, `deployer()`, `prng()`, `current_contract_address()`, `invoke_contract()`. There is no I/O, no networking, no clock other than `env.ledger().timestamp()`.
- `env.prng()` is seeded from ledger state and **predictable** — never use it for keys, auth, or high-stakes randomness.

## Storage

Three storage types with different costs and lifetimes. Choosing wrong is a top source of bugs and fee waste:

| Type | Lifetime | Expiry behavior | Use for |
|------|----------|-----------------|---------|
| `instance()` | One TTL shared with the contract instance | Archived with the contract, restorable | Admin address, config, small global state |
| `persistent()` | Per-key TTL | **Archived**, restorable | User balances, anything that must survive |
| `temporary()` | Per-key TTL | **Deleted permanently** | Caches, time-bounded data, oracle prices |

```rust
env.storage().instance().set(&DataKey::Admin, &admin);
env.storage().persistent().set(&DataKey::Balance(user), &balance);
env.storage().temporary().set(&DataKey::Quote(pair), &price);
```

All three support `get`, `set`, `has`, `remove`, `update`, `try_update`, and `extend_ttl`. Instance storage is a single ledger entry shared with the contract instance: cheap to keep all globals warm together (one `extend_ttl` bumps everything), but capped at the network's max entry size (**64KB serialized** on mainnet) — never put per-user or unbounded data there.

### TTL management

Every entry has a TTL counted in ledgers (~5s each, 17,280/day) and is archived (persistent/instance) or deleted (temporary) when it expires. Mainnet floors and ceiling (network-configured): new persistent entries start with ~120 days of TTL, temporary entries ~1 day, and no entry can exceed ~180 days (3,110,400 ledgers).

```rust
const DAY_IN_LEDGERS: u32 = 17280;
const BUMP_THRESHOLD: u32 = 30 * DAY_IN_LEDGERS;
const BUMP_TO: u32 = 120 * DAY_IN_LEDGERS;

// extend_ttl(threshold, extend_to): no-op unless current TTL < threshold,
// then sets TTL to extend_to. Idempotent and floor-only — never shortens.
env.storage().instance().extend_ttl(BUMP_THRESHOLD, BUMP_TO);
env.storage().persistent().extend_ttl(&DataKey::Balance(user), BUMP_THRESHOLD, BUMP_TO);
```

Extending on every write to an entry ("active users pay for their own state") is the standard pattern for per-user data; extending instance TTL at the top of busy entry points keeps globals alive. Rent is charged at invocation time.

Protocol 26 added bounded variants for persistent and instance storage — useful when callers shouldn't be able to force arbitrary rent costs: `extend_ttl_with_limits(&key, extend_to, min_extension, max_extension)`.

Two facts that surprise people:

- **Anyone can extend any entry's TTL** via the `ExtendFootprintTTLOp` transaction operation, no contract auth involved. Benevolent keep-alive services are possible — and TTL expiry is **not a security mechanism**. If data must become invalid after a deadline, store the deadline in the value and check it.
- **Archived is not gone.** Since protocol 23, archived persistent entries declared in a transaction's read-write footprint are restored automatically (you re-pay the storage rent); the CLI and SDKs handle this during simulation. Temporary entries have no such path — expired means deleted.

Contract code should still never assume an entry it wrote is present later: use `get(...).unwrap_or(default)` or `has()` checks in flows where absence is meaningful.

### Typed storage keys

Always use a `#[contracttype]` enum for keys — it centralizes the schema, prevents collisions, and adding variants is the forward-compatible way to grow storage:

```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address), // (owner, spender)
}
```

Keep keys fine-grained (`Balance(Address)` per user, not one giant `Map`). Every transaction declares its read/write footprint upfront; transactions touching the same read-write entry serialize, while fine-grained keys let unrelated transactions run in parallel — and a giant map forces every caller to pay to read all of it.

### Choosing storage — decision tree

1. Must survive indefinitely even if untouched? → `persistent()`
2. Inherently time-bounded, and "expired" may equal "gone"? → `temporary()` (cheapest)
3. Global, small, read on most invocations? → `instance()`
4. Per-user or unbounded in count? → never `instance()`; `persistent()` if durable, `temporary()` if ephemeral

## Data types

```rust
use soroban_sdk::{symbol_short, vec, Address, Bytes, BytesN, Map, String, Symbol, Vec, U256, I256};

let addr: Address = env.current_contract_address();
let sym: Symbol = symbol_short!("transfer");        // ≤9 chars; Symbol max is 32
let s: String = String::from_str(&env, "hello");
let hash: BytesN<32> = env.crypto().sha256(&bytes).into();
let v: Vec<u32> = vec![&env, 1, 2, 3];
let m: Map<Symbol, u32> = Map::new(&env);
```

- `i128` is the canonical token amount type (SEP-41). It admits negatives — validate `amount >= 0` on inputs.
- 256-bit math: `U256`/`I256` with `checked_add/sub/mul/pow/div/rem_euclid/shl/shr` returning `Option` (protocol 26+).
- `MuxedAddress` distinguishes sub-accounts of one address (exchanges, custodians); token `transfer` accepts it for the destination and a plain `Address` converts into it.
- `Timepoint` and `Duration` exist for time values; `env.ledger().timestamp()` is a `u64` in seconds.

Custom types derive `#[contracttype]` and work as storage keys/values, arguments, and return values:

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub collateral: i128,
    pub debt: i128,
    pub last_update: u64,
}
```

Keep type names unique within a contract — all types crossing the ABI are exported flat into the contract spec.

## Authorization

Authorization is host-mediated and explicit. Call `require_auth()` on every address whose consent the operation needs:

```rust
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    // or bind the auth to specific arguments instead of all of them:
    // from.require_auth_for_args((&to, amount).into_val(&env));
    // ...
}
```

`require_auth()` asks the host: did `from` authorize *this contract, this function, these exact arguments* in this transaction? `require_auth_for_args` narrows the signed payload to the args you pass — useful for partial commitments (sign a max amount, contract enforces `actual <= max`).

**When to require auth** — for each `Address` parameter, ask whether the call spends, reduces, or reconfigures something that address owns. Reading public data: no auth. Crediting a balance: no auth. Debiting, approving, changing settings, or *consuming the address's authority in a downstream call*: auth required. The right address matters more than the call itself — `who.require_auth()` on a user-supplied `who` proves the caller controls `who`, not that `who` is allowed to do anything (load the admin from storage and auth *that* for privileged paths):

```rust
fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}
```

### Auth trees and cross-contract propagation

A user signs a **tree of invocations**, not a single call: "I authorize `A.foo(args)`, and within it, `B.bar(args)`". `require_auth` deep in the call stack passes only if the actual call path and arguments match the signed tree, and each tree node matches at most once per transaction. Implications:

- Auth does not cascade. `U` authorizing `A.foo` does not let every contract `A` calls claim `U`'s auth — the client must include inner calls (e.g. `token.transfer`) in the signed tree. SDKs build the tree automatically from simulation.
- Refactoring your call graph (moving a token call from one helper contract to another) changes the tree shape and silently breaks integrations that sign the old shape.
- **Re-auth at every layer that uses an address's authority.** If `deposit(user, amount)` calls `token.transfer(&user, ...)` but never calls `user.require_auth()`, anyone can call `deposit(victim, ...)` and consume a pre-signed inner auth. This is the most common real-world auth bug.

Contracts as callers have one special rule: when contract A directly calls B, B may `require_auth` A's address — the direct call is the authorization. That covers B's immediate invocation only. If B will make a *deeper* call requiring A's auth, A must pre-authorize it:

```rust
// In contract A, before calling B (which will call token.transfer from A's address):
env.authorize_as_current_contract(vec![&env, InvokerContractAuthEntry::Contract(SubContractInvocation {
    context: ContractContext {
        contract: token_id.clone(),
        fn_name: Symbol::new(&env, "transfer"),
        args: (a_address, b_address, amount).into_val(&env),
    },
    sub_invocations: vec![&env],
})]);
b_client.do_thing(...);
```

Replay protection (nonces, expiration) is handled by the host for normal `require_auth` flows — contracts don't track nonces. Stellar accounts satisfy auth at their **medium** threshold.

### Custom accounts (`__check_auth`)

A contract address can act as an account (smart wallet, multisig, passkey wallet) by implementing `CustomAccountInterface`. The host calls `__check_auth` to evaluate the account's policy whenever that contract address is required to authorize something:

```rust
use soroban_sdk::{auth::{Context, CustomAccountInterface}, crypto::Hash};

#[contractimpl]
impl CustomAccountInterface for MyAccount {
    type Signature = BytesN<64>;
    type Error = AccError;

    fn __check_auth(
        env: Env,
        signature_payload: Hash<32>,   // host-computed digest of what is being authorized
        signature: BytesN<64>,          // your artifact type — anything #[contracttype]
        auth_contexts: Vec<Context>,    // the calls this auth would cover
    ) -> Result<(), AccError> {
        let pk: BytesN<32> = env.storage().instance().get(&DataKey::Owner).unwrap();
        env.crypto().ed25519_verify(&pk, &signature_payload.into(), &signature);
        // optionally enforce policy from auth_contexts: spend limits, function allowlists…
        Ok(())
    }
}
```

Rules: always verify `signature_payload` (verifying anything else authorizes arbitrary calls); use `auth_contexts` to enforce policies (each `Context::Contract` carries contract, fn_name, args); never `require_auth` the account's own address inside `__check_auth` (it's evaluating auth, not consuming it); keep it lean — its cost is added to every transaction the account signs.

Protocol 27 (CAP-71) adds **auth delegation** for modular accounts: inside `__check_auth`, `env.custom_account().get_delegated_signers()` returns the delegate addresses the transaction supplied (unsanitized — check they are registered delegates of this account), and `env.custom_account().delegate_auth(&addr)` forwards the current authorization check to that G- or C-address. This lets an account delegate authentication to signer contracts without a separate auth entry per delegate; delegation can nest.

Auth semantics reference: [authorization docs](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization).

## Constructors

`__constructor` runs once, atomically, at deploy time. Prefer it over a separate `initialize` function — it removes the front-running window between deploy and init:

```rust
pub fn __constructor(env: Env, admin: Address, initial_value: u32) {
    env.storage().instance().set(&DataKey::Admin, &admin);
    env.storage().instance().set(&DataKey::Value, &initial_value);
}
```

Rules: exact name `__constructor`; runs only at creation (not on upgrade); failure aborts the deployment atomically; pass args at deploy time after the `--` separator (see [SKILL.md](SKILL.md#build-deploy-invoke)). A contract deployed without a constructor can't retroactively gain one, so plan initialization at deploy time.

If you must support a guarded `initialize` instead (legacy patterns), check-and-set an `Initialized` flag — see [security.md](security.md#3-reinitialization-attacks).

## Cross-contract calls

Import another contract's WASM to get a typed client:

```rust
mod token_contract {
    soroban_sdk::contractimport!(
        file = "../token/target/wasm32v1-none/release/token.wasm"
    );
}

pub fn deposit(env: Env, user: Address, token: Address, amount: i128) {
    user.require_auth();
    let token_client = token_contract::Client::new(&env, &token);
    token_client.transfer(&user, &env.current_contract_address(), &amount);
}
```

For anything implementing the standard token interface (including every Stellar asset via its SAC), the SDK ships a client — no import needed:

```rust
use soroban_sdk::token::TokenClient;

let token = TokenClient::new(&env, &token_address);
token.transfer(&from, &to, &amount);
```

Untyped dynamic calls exist for when the interface isn't known at compile time: `env.invoke_contract::<i128>(&target, &symbol, args)`. Errors from a callee bubble up and abort unless you call through `try_` client methods. There is no `msg.sender` — pass the acting `Address` explicitly and `require_auth` it (see [Authorization](#authorization) for how auth traverses call trees).

## Events

Define events with the `#[contractevent]` macro (the older `env.events().publish(topics, data)` is deprecated):

```rust
use soroban_sdk::contractevent;

// Topics: ("transfer", from, to) — the name (snake-cased) is the first topic by
// default, #[topic] fields follow in order. Non-topic fields form the data payload.
#[contractevent]
pub struct Transfer {
    #[topic]
    pub from: Address,
    #[topic]
    pub to: Address,
    pub amount: i128,
}

// in a contract function:
Transfer { from, to, amount }.publish(&env);
```

Customize with `#[contractevent(topics = ["custom", "prefix"])]` (replaces the name topic) and `data_format = "map" | "vec" | "single-value"` (default `map`; `single-value` for a lone data field, which is what SEP-41 token events use). Topics are how indexers filter — put the event name and participant addresses there, payload in the data.

Emit events for every state change you'll want to index or audit — events are much cheaper than storing queryable state. But they're ephemeral: RPC providers typically retain ~7 days, so anything needed long-term must be derivable from on-chain state. Diagnostic events (`log!`) are off by default on nodes and not part of consensus — never rely on them for logic.

## Error handling

```rust
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ContractError {
    NotInitialized = 1,
    InsufficientBalance = 2,
    InvalidAmount = 3,
}

pub fn transfer(env: Env, from: Address, to: Address, amount: i128) -> Result<(), ContractError> {
    if amount <= 0 {
        return Err(ContractError::InvalidAmount);
    }
    // ...
    Ok(())
}
```

- Returning `Result` gives callers typed errors: generated clients expose both `foo()` (panics on error) and `try_foo()` returning `Result<Result<T, E>, InvokeError>` — `Ok(Err(e))` is your typed error, outer `Err` is a host-level failure (budget, bad auth, type mismatch).
- When panicking, use `panic_with_error!(&env, Error::X)`, not bare `panic!("msg")` — bare panics surface as opaque host errors clients can't match on.
- Error codes are public ABI. Never renumber across upgrades.
- An `Err` return or panic rolls back **all** state changes of the invocation, including nested calls' writes.

## Tokens from the contract side

Token semantics are load-bearing for any contract that moves funds. The interface is SEP-41; every classic Stellar asset also exposes it through its Stellar Asset Contract (SAC), so "token address" may mean a custom contract, a wrapped classic asset, or native XLM.

```rust
use soroban_sdk::token::{TokenClient, StellarAssetClient};

let token = TokenClient::new(&env, &token_addr);          // SEP-41: balance, transfer,
token.transfer(&from, &to, &amount);                      // approve, transfer_from, burn…

let sac = StellarAssetClient::new(&env, &sac_addr);       // SAC admin surface:
sac.mint(&to, &amount);                                   // mint, clawback, set_admin,
                                                          // set_authorized, trust (p26+)
```

What to internalize:

- Amounts are `i128`; reject negatives explicitly. `transfer`'s destination is a `MuxedAddress` (an `Address` converts into it), letting exchanges attach sub-account IDs.
- Auth pattern: `transfer`/`approve`/`burn` auth `from`; `transfer_from`/`burn_from` auth the `spender` (the allowance pre-authorized the `from` side). Reads need no auth. `mint`/`clawback`/`set_admin`/`set_authorized`/`trust` are SAC/admin surface, not SEP-41.
- **Allowances expire**: `approve(from, spender, amount, expiration_ledger)`. Convention is temporary storage keyed `(from, spender)` with TTL matching the expiration. Re-approving overwrites — the classic race applies (spender can front-run an allowance reduction and spend old + new); mitigate by approving to 0 first or using exact-amount auth instead of standing allowances.
- **SAC carries classic-asset semantics into contracts**: account (`G...`) balances live in trustlines (missing or unauthorized trustline → transfer fails; 64-bit balance cap), contract (`C...`) balances live in contract storage (full i128). Issuer flags apply — `AUTH_REQUIRED`, freezes via `AUTH_REVOCABLE`, clawback. Transfers to the issuer burn; from the issuer mint. A protocol that accepts arbitrary token addresses must survive all of this — see [security.md](security.md) for the token-consumer review checklist.
- Emit the standard token event shapes exactly — wallets and indexers depend on them (`soroban-token-sdk` ships these as ready-made `#[contractevent]` structs):

| Event | Topics | Data |
|---|---|---|
| `transfer` | `("transfer", from, to)` | `amount: i128`, or map `{to_muxed_id, amount}` for muxed destinations |
| `approve` | `("approve", from, spender)` | vec `[amount: i128, expiration_ledger: u32]` |
| `mint` | `("mint", to)` | `amount`, or map `{to_muxed_id, amount}` |
| `burn` | `("burn", from)` | `amount` |
| `clawback` | `("clawback", from)` | `amount` |

  The SAC emits these same shapes with one addition: the SEP-0011 asset string (`CODE:ISSUER` or `native`) as a trailing topic.

Custom token implementations, asset issuance, and SAC deployment: `../assets/SKILL.md`. Interface spec: [SEP-41](https://stellar.org/protocol/sep-41), [token interface docs](https://developers.stellar.org/docs/tokens/token-interface).

## Upgradeability

Decide early whether the contract is mutable. If yes, gate the upgrade behind admin/governance auth and track versions:

```rust
contractmeta!(key = "binver", val = "1.0.0");

pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    env.deployer().update_current_contract_wasm(new_wasm_hash);
}
```

- Upload the new WASM first (`stellar contract upload`), pass its hash here. The contract address and all storage survive; only the executable changes. `__constructor` does not re-run.
- **Storage schema is your problem.** New code reading an old key with a changed `#[contracttype]` shape fails to decode. Patterns: store a schema version and branch on it; add enum variants rather than reshaping existing ones; ship an idempotent, admin-gated `migrate` entrypoint enforcing `new_version > current_version`.
- SEP-0049 standardizes upgradeable-contract interfaces; OpenZeppelin's [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) ships audited implementations.

## Factories

```rust
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

- Addresses are deterministic per (deployer, salt) — `deployed_address()` computes one without deploying; derive salts intentionally.
- Authorize who may deploy; emit an event per deployment so instances are indexable.
- Keep factory logic separate from instance business logic.

## Governance

For sensitive actions (upgrades, config changes), prefer a timelock: `propose_*` stores the pending action plus an execute-after ledger, `execute_*` enforces the delay, `cancel_*` lets governance abort. For multisig, separate proposer/approver/executor roles, store proposal state in persistent storage, and prevent replay (unique proposal IDs, expiry semantics, explicit events). For signature-set policies, a custom account (`__check_auth`) is often cleaner than in-contract multisig.

## DeFi patterns

Condensed design rules — the details are application-specific:

- **Vaults**: track `total_assets`/`total_shares`, round conservatively on mint/redeem, include pause controls.
- **Pools/AMMs**: define the invariant and fee accounting precisely; slippage-check every user-facing swap.
- **Oracles**: enforce freshness bounds, prefer multi-source/median feeds, add circuit breakers.
- **Regulated tokens**: isolate allowlist/denylist and freeze/forced-transfer logic in dedicated entrypoints with strong auth, emit policy-decision events, never store PII on-chain.

Worked examples: [soroban-examples](https://github.com/stellar/soroban-examples) (liquidity pool, atomic swap, timelock, single-offer).

## Fees and resource limits

Soroban transactions pay an inclusion fee (classic surge-priced mechanic) plus a resource fee based on declared consumption: CPU instructions, ledger reads/writes (entries and bytes), transaction size, events size, and rent. Rent/events are refundable if unused; instructions and I/O are charged as declared — so submitters simulate first to size the declaration, and a transaction that exceeds its declaration fails. If actual state diverges from simulation (concurrent writes), costs can shift — leave headroom.

Current mainnet per-transaction ceilings (network-configured, change by validator vote — check the live values on [Stellar Lab's Network Limits page](https://lab.stellar.org/network-limits) or with `stellar network settings --network mainnet`):

| Resource | Limit |
|---|---|
| CPU instructions | 400M |
| Memory | 40 MB |
| Ledger entries read / written | 200 / 200 |
| Bytes read / written | 200 KB / ~129 KB |
| Transaction size | ~129 KB |
| Contract events + return value | 16 KB |
| Contract WASM size | 128 KB |
| Ledger entry size (incl. whole instance storage) | 64 KB (keys 250 B) |

Optimization rules that actually move the needle:

- Minimize distinct ledger entries touched — each read/write has a fixed cost plus bytes, and everything touched must be in the footprint whether used or not
- Avoid unbounded loops over user-controlled collections (instruction budget + fee-griefing surface; cap or restructure)
- Reduce cross-contract calls in hot paths; each is full invocation overhead
- Use events instead of storage for data that only needs off-chain visibility
- Crypto verifications are the expensive primitive in `__check_auth` — bound signature counts
- Profile before optimizing: `stellar contract invoke ... --send=no` reports instructions, I/O, and fees without submitting

## Contract size

The 128KB limit is real and the release profile in [SKILL.md](SKILL.md#project-setup) is mandatory (`stellar contract build` also optimizes the WASM by default). If you still exceed it:

```bash
ls -la target/wasm32v1-none/release/*.wasm       # check size
cargo install cargo-bloat
cargo bloat --release --target wasm32v1-none     # find heavy deps
```

Then: drop heavy dependencies (full `serde`, `regex` — stay in no_std SDK idioms), split the contract, avoid large static data.

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `contract exceeds maximum size` | WASM > 128KB | See [Contract size](#contract-size) |
| `cannot find macro println` / `std` errors | Missing `#![no_std]` | Add as first line of `lib.rs`; use SDK types |
| `can't find crate for core` targeting wasm | Missing target | `rustup target add wasm32v1-none` |
| `cargo test` fails inside `soroban-env-host` (`ed25519_dalek` trait errors) | A semver-loose transitive dep resolved to an incompatible major (e.g. ed25519-dalek 3.x, mid-2026) | Pin it back: `cargo update ed25519-dalek@3.0.0 --precise 2.2.0` |
| Calls fail after inactivity, data "missing" | Storage TTL expired → archived | Extend TTLs proactively; simulation auto-restores archived persistent entries |
| Temporary data vanished | Wrong storage type | Use `persistent()` for data that must survive |
| `Error: identity "alice" not found` | CLI identity missing | `stellar keys generate alice --network testnet --fund` |
| `invalid argument format` on invoke | Wrong CLI arg syntax | Plain strings for addresses; JSON for complex types |
| `transaction simulation failed` | Soroban tx not simulated/assembled | Simulate, then `assembleTransaction` before signing |
| Auth fails only in cross-contract flows | Signed auth tree doesn't match actual call path | Rebuild the tree from simulation; re-auth at each layer (see [Authorization](#authorization)) |
| `tx_bad_auth` | Wrong network passphrase or signer | Match passphrase to network; check signing identity |
| `tx_bad_seq` | Stale sequence number | Reload the account before building the tx |

Client-side issues (wallet detection, trustlines, transaction building from JS) are covered in `../dapp/SKILL.md` and `../data/SKILL.md`.
