# Stellar Security Checklist (Soroban + Classic)

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

**Prevention**: Always use `require_auth()` on the caller or an admin address. See [contracts-soroban.md](contracts-soroban.md) for full authorization patterns (direct auth, admin helpers, `require_auth_for_args`).

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
- **Blog**: https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification

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
