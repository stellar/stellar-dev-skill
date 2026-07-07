# Development Patterns

Core and advanced patterns for Stellar smart contracts. For setup and the basic workflow, start at [SKILL.md](SKILL.md); for tests see [testing.md](testing.md); for security review see [security.md](security.md).

## Architecture

Contracts run as WebAssembly guests in a sandboxed host. The host provides storage, crypto, and cross-contract calls; guest code references host objects via handles, not direct memory. Practical consequences:

- `#![no_std]` — use `soroban_sdk` collections and strings
- 64KB compiled size limit (see [Contract size](#contract-size) below)
- Rust is the supported language. Community alternatives (AssemblyScript, Solidity via Solang) exist but are not production-ready — see [migration docs](https://developers.stellar.org/docs/learn/migrate).

## Storage

Three storage types with different costs and lifetimes. Choosing wrong is a top source of bugs and fee waste:

| Type | Lifetime | Use for |
|------|----------|---------|
| `instance()` | Tied to the contract instance, shared TTL | Admin address, global config, small global state |
| `persistent()` | Per-key TTL, archived when expired but **restorable** | User balances, anything that must survive |
| `temporary()` | Per-key TTL, deleted when expired, **not restorable** | Caches, session data, short-lived flags |

```rust
env.storage().instance().set(&DataKey::Admin, &admin);
env.storage().persistent().set(&DataKey::Balance(user), &balance);
env.storage().temporary().set(&DataKey::Cache(key), &value);
```

### TTL management

Every entry has a TTL (in ledgers, ~5s each) and is archived when it expires. Extend proactively in functions that touch the data:

```rust
const MIN_TTL: u32 = 17280;     // ~1 day
const EXTEND_TO: u32 = 518400;  // ~30 days

// extend_ttl(threshold, extend_to): only extends if TTL < threshold
env.storage().instance().extend_ttl(MIN_TTL, EXTEND_TO);
env.storage().persistent().extend_ttl(&DataKey::Balance(user), MIN_TTL, EXTEND_TO);
```

Archived persistent entries can be restored with a `RestoreFootprint` operation, but that costs an extra transaction — design TTL extension into hot paths instead. Details: [state archival docs](https://developers.stellar.org/docs/learn/fundamentals/contract-development/storage/state-archival).

### Typed storage keys

Always use a `#[contracttype]` enum for keys — ad-hoc symbols invite collisions:

```rust
#[contracttype]
#[derive(Clone)]
pub enum DataKey {
    Admin,
    Balance(Address),
    Allowance(Address, Address), // (owner, spender)
}
```

## Data types

```rust
use soroban_sdk::{Address, Bytes, BytesN, Map, String, Symbol, Vec};

let addr: Address = env.current_contract_address();
let sym: Symbol = symbol_short!("transfer");        // ≤9 chars; Symbol max is 32
let s: String = String::from_str(&env, "hello");
let hash: BytesN<32> = env.crypto().sha256(&bytes).into();
let v: Vec<u32> = vec![&env, 1, 2, 3];
let m: Map<Symbol, u32> = Map::new(&env);
```

Custom types derive `#[contracttype]`:

```rust
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TokenMetadata {
    pub name: String,
    pub symbol: Symbol,
    pub decimals: u32,
}
```

## Authorization

Authorization is opt-in and explicit. Call `require_auth()` on every address whose consent the operation needs:

```rust
pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
    from.require_auth();
    // or bind the auth to specific arguments:
    // from.require_auth_for_args((&to, amount).into_val(&env));
    // ...
}
```

Admin pattern:

```rust
fn require_admin(env: &Env) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
}
```

Authorization semantics (sub-invocations, custom accounts): [auth docs](https://developers.stellar.org/docs/learn/fundamentals/contract-development/authorization).

## Constructors

`__constructor` runs once, atomically, at deploy time (Protocol 22+). Prefer it over a separate `initialize` function — it removes the front-running window between deploy and init:

```rust
pub fn __constructor(env: Env, admin: Address, initial_value: u32) {
    env.storage().instance().set(&DataKey::Admin, &admin);
    env.storage().instance().set(&DataKey::Value, &initial_value);
}
```

Rules: exact name `__constructor`, returns `()`, runs only at creation (not on upgrade), failure aborts the deployment atomically. Pass args at deploy time after the `--` separator (see [SKILL.md](SKILL.md#build-deploy-invoke)).

If you must support a guarded `initialize` instead (pre-Protocol-22 targets), check-and-set an `Initialized` flag — see [security.md](security.md#2-reinitialization-attacks).

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

For Stellar assets, use the built-in SAC client — every asset has a Stellar Asset Contract:

```rust
use soroban_sdk::token::Client as TokenClient;

let token = TokenClient::new(&env, &asset_contract_id);
token.transfer(&from, &to, &amount);
```

SAC details and asset interop: `../assets/SKILL.md`. Validate addresses you call — see [security.md](security.md#3-arbitrary-contract-calls).

## Events

```rust
use soroban_sdk::contractevent;

#[contractevent(topics = ["transfer"])]
pub struct TransferEvent {
    pub from: Address,
    pub to: Address,
    pub amount: i128,
}

// in a contract function:
TransferEvent { from, to, amount }.publish(&env);
```

Emit events for every state change you'll want to index or audit — events are much cheaper than storing queryable state.

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

Returning `Result` gives callers (and clients generated for tests) typed errors via `try_` methods. Panics abort with less information — reserve them for invariant violations.

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

- Upload the new WASM first (`stellar contract upload`), pass its hash here.
- Add a dedicated `migrate` entrypoint for storage migrations; make it idempotent and monotonic (`new_version > current_version`).
- `__constructor` does not re-run on upgrade.
- SEP-0049 standardizes upgradeable-contract interfaces; OpenZeppelin's [stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts) ships an audited implementation.

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

- Addresses are deterministic per (deployer, salt) — derive salts intentionally.
- Authorize who may deploy; emit an event per deployment so instances are indexable.
- Keep factory logic separate from instance business logic.

## Governance

For sensitive actions (upgrades, config changes), prefer a timelock: `propose_*` stores the pending action plus an execute-after ledger, `execute_*` enforces the delay, `cancel_*` lets governance abort. For multisig, separate proposer/approver/executor roles, store proposal state in persistent storage, and prevent replay (unique proposal IDs, expiry semantics, explicit events).

## DeFi and compliance patterns

Condensed design rules — the details are application-specific:

- **Vaults**: track `total_assets`/`total_shares`, round conservatively on mint/redeem, include pause controls.
- **Pools/AMMs**: define the invariant and fee accounting precisely; slippage-check every user-facing swap.
- **Oracles**: enforce freshness bounds, prefer multi-source/median feeds, add circuit breakers.
- **Regulated tokens**: isolate allowlist/denylist and freeze/forced-transfer logic in dedicated entrypoints with strong auth, emit policy-decision events, never store PII on-chain.

Worked examples: [soroban-examples](https://github.com/stellar/soroban-examples) (liquidity pool, atomic swap, timelock, single-offer) and the [DeFi tutorials](https://developers.stellar.org/docs/build/apps/guestbook).

## Contract size

The 64KB limit is real and the release profile in [SKILL.md](SKILL.md#project-setup) is mandatory. If you still exceed it:

```bash
ls -la target/wasm32v1-none/release/*.wasm   # check size
cargo install cargo-bloat
cargo bloat --release --target wasm32v1-none # find heavy deps
```

Then: split the contract, drop heavy dependencies, prefer `symbol_short!`, avoid large static data.

## Resource optimization

Fees are multidimensional (CPU instructions, ledger reads/writes, bytes, events, rent):

- Minimize storage reads/writes; batch where possible
- Avoid unbounded loops over user-controlled collections
- Reduce cross-contract calls in hot paths
- Use events instead of storage for data that only needs off-chain visibility
- Profile with `stellar contract invoke ... --send=no` before optimizing blind

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `contract exceeds maximum size` | WASM > 64KB | See [Contract size](#contract-size) |
| `cannot find macro println` / `std` errors | Missing `#![no_std]` | Add as first line of `lib.rs`; use SDK types |
| Calls fail after inactivity, data "missing" | Storage TTL expired → archived | Extend TTLs proactively; restore archived entries |
| Temporary data vanished | Wrong storage type | Use `persistent()` for data that must survive |
| `Error: identity "alice" not found` | CLI identity missing | `stellar keys generate alice --network testnet --fund` |
| `invalid argument format` on invoke | Wrong CLI arg syntax | Plain strings for addresses; JSON for complex types |
| `transaction simulation failed` | Soroban tx not simulated/assembled | Simulate, then `assembleTransaction` before signing |
| `tx_bad_auth` | Wrong network passphrase or signer | Match passphrase to network; check signing identity |
| `tx_bad_seq` | Stale sequence number | Reload the account before building the tx |

Client-side issues (wallet detection, trustlines, transaction building from JS) are covered in `../dapp/SKILL.md` and `../data/SKILL.md`.
