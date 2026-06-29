# Security

Security review guide for Stellar smart contracts. Companion to [SKILL.md](SKILL.md), [development.md](development.md), and [testing.md](testing.md).

## Threat model

Assume the attacker controls:

- All arguments passed to contract functions
- Transaction ordering and timing
- All accounts except those requiring signatures
- The ability to deploy contracts that mimic your interface

## What the platform rules out

- **No `delegatecall`** — contracts cannot execute foreign bytecode in their own context; proxy-style hijacks don't exist.
- **No classical reentrancy** — execution is synchronous; the Ethereum-style cross-contract reentrancy class is absent (self-reentrancy is possible but rarely exploitable).
- **Explicit authorization** — `require_auth()` is opt-in, which means *forgetting it* is the failure mode to hunt for.

## Vulnerability classes

### 1. Missing authorization

```rust
// BAD: anyone can drain
pub fn withdraw(env: Env, to: Address, amount: i128) {
    transfer_tokens(&env, &to, amount);
}

// GOOD
pub fn withdraw(env: Env, to: Address, amount: i128) {
    let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
    admin.require_auth();
    transfer_tokens(&env, &to, amount);
}
```

Every privileged path needs `require_auth()` on the right address. Auth variants: [development.md](development.md#authorization).

### 2. Reinitialization attacks

Only relevant if you use a guarded `initialize` instead of a `__constructor` (which can't re-run):

```rust
// GOOD: refuses second call
pub fn initialize(env: Env, admin: Address) {
    if env.storage().instance().has(&DataKey::Admin) {
        panic!("already initialized");
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
}
```

### 3. Arbitrary contract calls

Calling whatever address a user passes lets an attacker substitute a contract that mimics the interface:

```rust
// GOOD: allowlist external contracts
pub fn swap(env: Env, token: Address, amount: i128) {
    let allowed: Vec<Address> = env.storage().instance().get(&DataKey::AllowedTokens).unwrap();
    if !allowed.contains(&token) {
        panic!("token not allowed");
    }
    let client = token::Client::new(&env, &token);
    // ...
}
```

### 4. Integer overflow/underflow

`overflow-checks = true` in the release profile catches overflows at runtime (panic), but explicit checked math fails cleaner and survives profile mistakes:

```rust
let new_balance = balance.checked_add(amount).expect("overflow");
```

Also validate sign and range on inputs (`amount <= 0` checks) — `i128` amounts can be negative.

### 5. Storage key collisions

Untyped keys can silently overwrite unrelated data. Always use a `#[contracttype]` key enum — see [development.md](development.md#typed-storage-keys).

### 6. Check-then-act races

State can change between transactions. Do checks and state changes atomically within one invocation, and take slippage bounds (`min_out`) from the caller:

```rust
pub fn swap(env: Env, user: Address, amount_in: i128, min_out: i128) {
    user.require_auth();
    let amount_out = calculate_output(amount_in);
    if amount_out < min_out {
        panic!("slippage exceeded");
    }
    // update all state in this same invocation
}
```

### 7. TTL/archival failures

If critical state expires, the contract breaks (or worse, behaves as if state never existed). Extend TTLs in hot paths and monitor entry TTLs in production — see [development.md](development.md#ttl-management).

### 8. Trusting cross-contract return values

Validate data from external contracts — allowlist oracles, sanity-check magnitudes, enforce freshness:

```rust
let price: i128 = oracle_client.get_price(&asset);
if price <= 0 || price > MAX_REASONABLE_PRICE {
    panic!("invalid price");
}
```

## Classic-side risks (for contracts touching assets)

- **Trustline spoofing**: display and verify full asset code + issuer; honor curated lists (`stellar.toml`).
- **Clawback**: assets with `auth_clawback_enabled` can be seized by the issuer — check issuer flags before treating balances as final.
- Asset semantics live in `../assets/SKILL.md`.

## Checklists

### Contract

- [ ] All privileged functions require appropriate authorization
- [ ] Initialization can only happen once (or uses `__constructor`)
- [ ] External contract calls validated/allowlisted
- [ ] Arithmetic checked; input signs and ranges validated
- [ ] Storage keys typed and collision-free
- [ ] Critical TTLs extended proactively; archival behavior considered
- [ ] Events emitted for auditable state changes
- [ ] Upgrade path gated, tested (happy + failure), and replay-safe
- [ ] Emergency controls (pause) and incident runbook defined for value-bearing contracts

### Client-side

- [ ] Network passphrase validated before signing
- [ ] Transactions simulated before submission
- [ ] Operation details displayed clearly; confirmation for high-value actions
- [ ] Contract addresses verified against known deployments
- [ ] Trustline status checked before transfers

## Tooling

**Static analysis**

- [Scout](https://github.com/CoinFabrik/scout-soroban) (CoinFabrik): `cargo install cargo-scout-audit && cargo scout-audit` — 20+ detectors (missing overflow checks, unprotected WASM update, unrestricted transfers, unsafe unwrap, DoS-unbounded ops). SARIF output for CI; VSCode extension available.
- [Security Detectors SDK](https://github.com/OpenZeppelin/soroban-security-detectors-sdk) (OpenZeppelin): pre-built detectors (`auth_missing`, `unchecked_ft_transfer`, improper TTL extension) plus a framework for writing custom ones.

**Formal verification**

- [Certora Sunbeam](https://docs.certora.com/en/latest/docs/sunbeam/index.html): specs as Rust macros (`cvlr_assert!`), operates on WASM bytecode.
- [Komet](https://docs.runtimeverification.com/komet) (Runtime Verification): property tests + formal verification via KWasm semantics.

**Monitoring**: [OpenZeppelin Monitor](https://www.openzeppelin.com/news/monitor-and-relayers-are-now-open-source) — self-hosted contract monitoring with Stellar support.

**Knowledge base**: [sorobansecurity.com](https://sorobansecurity.com) — searchable audit reports and vulnerability database.

## Audits and bounties

- **[Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank)** — SDF-subsidized audits for SCF-funded protocols ($3M+ across 43+ audits to date). Partner firms include OtterSec, Veridise, Runtime Verification, CoinFabrik, Certora, Zellic, Code4rena. Follow-up audits trigger at TVL milestones.
- **[Immunefi — Stellar](https://immunefi.com/bug-bounty/stellar/)** — up to $250K for core/SDK/CLI vulnerabilities (PoC required, local forks only).
- **[Immunefi — OpenZeppelin on Stellar](https://immunefi.com/bug-bounty/openzeppelin-stellar/)** — up to $25K for the audited contracts library.

Before requesting an audit: run the static analyzers, complete the checklists above, document your threat model and trust assumptions, and have the test suite from [testing.md](testing.md) green — auditors' time is better spent on logic than on lint.
