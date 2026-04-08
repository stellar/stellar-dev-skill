# Advanced Soroban Patterns

## When to use this guide
Use this guide for higher-complexity contract architecture:
- Upgrades and migrations
- Factory/deployer systems
- Governance and timelocks
- DeFi primitives (vaults, pools, oracles)
- Regulated token/compliance workflows
- Resource and storage optimization

Use `contracts-soroban.md` for core contract syntax and day-to-day patterns.

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

## Related docs
- Core contract development: `contracts-soroban.md`
- Security checks: `security.md`
- Testing approach: `testing.md`
- Standards references: `standards-reference.md`
