# Security

Security review guide for Stellar smart contracts. Companion to [SKILL.md](SKILL.md), [development.md](development.md), and [testing.md](testing.md).

## Threat model

Assume the attacker controls:

- All arguments passed to contract functions
- Transaction ordering and timing
- All accounts except those requiring signatures
- The ability to deploy contracts that mimic your interface
- The shape of on-chain state they can legally create (entry counts, TTLs — they can even extend your entries' TTLs)

## What the platform rules out

- **No `delegatecall`** — contracts cannot execute foreign bytecode in their own context; proxy-style hijacks don't exist.
- **No reentrancy** — the host blocks reentrant calls, direct or indirect, on normal cross-contract paths. External calls remain failure/budget/side-effect boundaries — still order state updates deliberately.
- **Host-managed auth replay protection** — nonces and expirations on authorization entries are enforced by the host, not by your code.
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

Every privileged path needs `require_auth()` on the right address — and "right" means the address with policy authority, loaded from storage, not a caller-supplied parameter (`who.require_auth()` on an arbitrary `who` proves nothing). Auth variants: [development.md](development.md#authorization).

### 2. Auth replay through middleware (missing outer `require_auth`)

The cross-contract variant of #1, and the most common real-world auth bug:

```rust
// BAD: never auths `user` here
pub fn settle(env: Env, user: Address, amount: i128) {
    token_client.transfer(&user, &recipient, &amount);
}
```

If `user` has pre-signed an auth tree that includes the inner `token.transfer`, *anyone* can call `settle(user, ...)` and consume it. Re-authorize at **every** layer that exercises an address's authority, not just the deepest call. Review rule: for each entry point, enumerate every `Address` argument and ask whose authority each state change consumes. Auth-tree semantics: [development.md](development.md#auth-trees-and-cross-contract-propagation).

### 3. Reinitialization attacks

Only relevant if you use a guarded `initialize` instead of a `__constructor` (which can't re-run):

```rust
// GOOD: refuses second call
pub fn initialize(env: Env, admin: Address) {
    if env.storage().instance().has(&DataKey::Admin) {
        panic_with_error!(&env, Error::AlreadyInitialized);
    }
    env.storage().instance().set(&DataKey::Admin, &admin);
}
```

Without the guard, anyone can call `initialize` first (or again) and capture admin.

### 4. Arbitrary contract calls

Calling whatever address a user passes lets an attacker substitute a contract that mimics the interface:

```rust
// GOOD: allowlist external contracts
pub fn swap(env: Env, token: Address, amount: i128) {
    let allowed: Vec<Address> = env.storage().instance().get(&DataKey::AllowedTokens).unwrap();
    if !allowed.contains(&token) {
        panic_with_error!(&env, Error::TokenNotAllowed);
    }
    let client = TokenClient::new(&env, &token);
    // ...
}
```

A user-supplied contract address is arbitrary code: it can fail, trap, burn budget, emit misleading events, or call other contracts (it just can't re-enter you).

### 5. Integer overflow/underflow

`overflow-checks = true` in the release profile catches overflows at runtime (panic), but explicit checked math fails cleaner and survives profile mistakes:

```rust
let new_balance = balance.checked_add(amount).expect("overflow");
```

Also validate sign and range on inputs — `i128` amounts can be negative, and `transfer(from, to, -1000)` is a withdrawal from `to` if unchecked. For 256-bit types, use the `checked_*` methods (protocol 26+).

### 6. Storage key collisions

Untyped keys can silently overwrite unrelated data. Always use a `#[contracttype]` key enum — see [development.md](development.md#typed-storage-keys).

### 7. Check-then-act races

State can change between transactions. Do checks and state changes atomically within one invocation, and take slippage bounds (`min_out`) from the caller:

```rust
pub fn swap(env: Env, user: Address, amount_in: i128, min_out: i128) {
    user.require_auth();
    let amount_out = calculate_output(amount_in);
    if amount_out < min_out {
        panic_with_error!(&env, Error::SlippageExceeded);
    }
    // update all state in this same invocation
}
```

The token-allowance variant: `approve` overwrites, so reducing a non-zero allowance can be front-run (spend old, then spend new). Approve to 0 first, or use exact-amount auth instead of standing allowances.

### 8. TTL and archival failures

Two distinct failure modes:

- **Critical state expires**: a temporary entry silently disappears (permanently), or persistent entries archive and add restoration friction. Extend TTLs in hot paths; monitor entry TTLs in production — see [development.md](development.md#ttl-management).
- **TTL used as a security mechanism**: anyone can extend any entry's TTL via `ExtendFootprintTTLOp`, so "this entry expires, therefore the permission ends" is broken by design. Store an explicit deadline in the value and check it.

### 9. Trusting cross-contract return values

Validate data from external contracts — allowlist oracles, sanity-check magnitudes, enforce freshness:

```rust
let price: i128 = oracle_client.get_price(&asset);
if price <= 0 || price > MAX_REASONABLE_PRICE {
    panic_with_error!(&env, Error::InvalidPrice);
}
```

### 10. Resource exhaustion / fee griefing

A function whose worst-case cost on attacker-shaped input exceeds network limits is a denial of service on legitimate users. Hunt for: loops bounded by user-controlled collections or entry counts, per-iteration storage reads or events, unbounded signature counts in `__check_auth`. Cap iteration counts explicitly and keep footprints small — limits and costs: [development.md](development.md#fees-and-resource-limits).

### 11. Custom account (`__check_auth`) pitfalls

- Verify `signature_payload` itself — verifying any other message authorizes arbitrary calls.
- Enforce policies from `auth_contexts` (spend limits, function allowlists); ignoring it makes "policy" wallets decorative.
- CAP-71 delegation: `get_delegated_signers()` returns **unsanitized** user input — verify each address is actually a registered delegate before calling `delegate_auth`.
- Details: [development.md](development.md#custom-accounts-__check_auth).

## Token-consumer review (AMMs, vaults, escrows, lenders)

Any contract that takes a token address must assume it may be native XLM's SAC, a wrapped classic asset's SAC, or a custom contract:

- [ ] Which tokens are accepted — allowlisted or permissionless? (Permissionless ⇒ class #4 applies)
- [ ] Decimals handled? Query and store at registration; never assume 7.
- [ ] Received amount re-checked after `transfer` where it matters? (Fee-on-transfer or non-standard tokens deliver less than requested)
- [ ] SAC/classic quirks survivable — recipient missing a trustline, `AUTH_REQUIRED` assets, frozen accounts, issuer clawback? (Semantics: [development.md](development.md#tokens-from-the-contract-side))
- [ ] `transfer_from` flows: does UX coordinate the allowance, and does the code auth the `spender` (not `from`)?
- [ ] Standard token event shapes emitted, so indexers/wallets see the flows?

## Checklists

### Contract

- [ ] All privileged functions require appropriate authorization, loaded from storage
- [ ] Every layer using an address's authority re-auths it (no middleware replay)
- [ ] Initialization can only happen once (or uses `__constructor`)
- [ ] External contract calls validated/allowlisted; return values sanity-checked
- [ ] Arithmetic checked; input signs and ranges validated
- [ ] Storage keys typed and collision-free
- [ ] Critical TTLs extended proactively; no TTL-as-security assumptions
- [ ] Loops and footprints bounded on attacker-shaped input
- [ ] Events emitted for auditable state changes (and error codes never renumbered)
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
