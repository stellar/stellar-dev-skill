# Advanced Soroban Patterns

## When to use this guide
Use this guide when you need:
- Factory patterns for deploying multiple contracts
- Upgradeable contract patterns (SEP-0049)
- Governance and multi-sig patterns
- DeFi primitives (vaults, oracles, liquidity pools)
- Gas/resource optimization strategies
- Compliance and regulated token patterns

## Deployment Patterns

### Deploying Contracts via CLI
Contracts are typically deployed using the Stellar CLI, not from other contracts.

```bash
# Deploy with constructor arguments (Protocol 22+)
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source alice \
  --network testnet \
  -- \
  --admin alice \
  --initial_value 100

# Deploy without constructor
stellar contract deploy \
  --wasm target/wasm32-unknown-unknown/release/my_contract.wasm \
  --source alice \
  --network testnet
```

### Cross-Contract Communication Pattern
Instead of factory patterns, Soroban contracts typically communicate via imported clients.

```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, Address, Env};

// Import another contract to call it
mod other_contract {
    soroban_sdk::contractimport!(
        file = "../other/target/wasm32-unknown-unknown/release/other.wasm"
    );
}

#[contract]
pub struct MyContract;

#[contractimpl]
impl MyContract {
    pub fn call_other(env: Env, other_address: Address, value: i128) -> i128 {
        // Create client for the other contract
        let client = other_contract::Client::new(&env, &other_address);

        // Call method on other contract
        client.some_method(&value)
    }
}
```

## Upgradeable Contracts (SEP-0049)

Soroban contracts are **mutable by default** - they can upgrade their WASM bytecode. This differs from Ethereum where upgrades require proxy patterns.

### Versioning with Contract Metadata
```rust
#![no_std]
use soroban_sdk::{contract, contractimpl, contractmeta, Env};

// Store version in contract metadata (SEP-0049 recommended)
contractmeta!(key = "binver", val = "1.2.0");

#[contract]
pub struct MyContract;
```

### Basic Upgrade Pattern
```rust
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env};

#[contractimpl]
impl MyContract {
    /// Upgrade contract WASM. Only callable by admin.
    pub fn upgrade(env: Env, new_wasm_hash: BytesN<32>) {
        // Verify caller is admin
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        // Update the contract's WASM code
        env.deployer().update_current_contract_wasm(new_wasm_hash);
    }
}
```

### Migration Pattern
Handle storage layout changes after upgrades.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
pub enum DataKey {
    Admin,
    Version,
    MigrationComplete,
    // V2 adds new storage keys
    NewFeatureEnabled,
}

#[contractimpl]
impl MyContract {
    /// Migrate storage after upgrade. Call once after upgrade.
    pub fn migrate(env: Env, new_version: u32) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let current_version: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Version)
            .unwrap_or(1);

        if new_version <= current_version {
            panic!("already migrated to this version");
        }

        // Perform migration based on version
        if current_version < 2 && new_version >= 2 {
            // V1 -> V2 migration
            env.storage().instance().set(&DataKey::NewFeatureEnabled, &false);
        }

        env.storage().instance().set(&DataKey::Version, &new_version);
    }
}
```

### Atomic Upgrade + Migrate (Upgrader Contract)
Use a separate contract to perform upgrade and migration atomically (SEP-0049 recommended).

```rust
use soroban_sdk::{contract, contractimpl, Address, BytesN, Env, Symbol, Vec, Val};

mod upgradeable {
    soroban_sdk::contractimport!(file = "../target/wasm32-unknown-unknown/release/upgradeable.wasm");
}

#[contract]
pub struct Upgrader;

#[contractimpl]
impl Upgrader {
    pub fn upgrade_and_migrate(
        env: Env,
        contract_address: Address,
        operator: Address,
        new_wasm_hash: BytesN<32>,
        migration_args: Vec<Val>,
    ) {
        operator.require_auth();

        let client = upgradeable::Client::new(&env, &contract_address);

        // Step 1: Upgrade the contract
        client.upgrade(&new_wasm_hash);

        // Step 2: Call migrate in same transaction (atomic)
        let migrate_fn = Symbol::new(&env, "migrate");
        env.invoke_contract::<()>(&contract_address, &migrate_fn, migration_args);
    }
}
```

### Making Contracts Immutable
To make a contract permanently non-upgradeable, simply don't include an upgrade function.

```rust
// This contract has NO upgrade function - it's immutable
#[contract]
pub struct ImmutableContract;

#[contractimpl]
impl ImmutableContract {
    pub fn initialize(env: Env, admin: Address) {
        // ... initialization logic
        // No upgrade() function = permanently immutable
    }
}
```

### Upgrade Safety Checklist (SEP-0049)
1. **Version tracking**: Store version in metadata (`binver`) and storage
2. **One-time migration**: Ensure `migrate()` can only run once per version
3. **Access control**: Only admin can trigger upgrades
4. **Rollback strategy**: Plan how to fix issues if upgrade goes wrong
5. **No constructor reliance**: Constructor won't run on upgrade
6. **Preserve upgrade capability**: New WASM must include upgrade function (unless intentionally making immutable)
7. **Storage compatibility**: New contract must handle old storage layout

## Governance Patterns

### Time-locked Operations
Delay sensitive operations to allow review.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env};

#[contracttype]
#[derive(Clone)]
pub struct PendingUpgrade {
    pub wasm_hash: BytesN<32>,
    pub execute_after: u64, // ledger sequence
    pub proposer: Address,
}

#[contracttype]
pub enum DataKey {
    Admin,
    PendingUpgrade,
    TimelockDelay, // in ledgers (~5 sec each)
}

const DEFAULT_DELAY: u64 = 17280; // ~1 day

#[contractimpl]
impl TimelockContract {
    /// Propose an upgrade (starts timelock)
    pub fn propose_upgrade(env: Env, wasm_hash: BytesN<32>) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        let delay: u64 = env
            .storage()
            .instance()
            .get(&DataKey::TimelockDelay)
            .unwrap_or(DEFAULT_DELAY);

        let pending = PendingUpgrade {
            wasm_hash,
            execute_after: env.ledger().sequence() + delay,
            proposer: admin,
        };

        env.storage().instance().set(&DataKey::PendingUpgrade, &pending);
    }

    /// Execute upgrade after timelock expires
    pub fn execute_upgrade(env: Env) {
        let pending: PendingUpgrade = env
            .storage()
            .instance()
            .get(&DataKey::PendingUpgrade)
            .expect("no pending upgrade");

        if env.ledger().sequence() < pending.execute_after {
            panic!("timelock not expired");
        }

        env.deployer().update_current_contract_wasm(pending.wasm_hash);
        env.storage().instance().remove(&DataKey::PendingUpgrade);
    }

    /// Cancel pending upgrade
    pub fn cancel_upgrade(env: Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();

        env.storage().instance().remove(&DataKey::PendingUpgrade);
    }
}
```

### Multi-Signature Pattern
Require multiple approvals for sensitive operations.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, BytesN, Env, Map, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Proposal {
    pub id: u64,
    pub action: ProposalAction,
    pub approvals: Vec<Address>,
    pub executed: bool,
}

#[contracttype]
#[derive(Clone)]
pub enum ProposalAction {
    Upgrade(BytesN<32>),
    Transfer { to: Address, amount: i128 },
    AddSigner(Address),
    RemoveSigner(Address),
    ChangeThreshold(u32),
}

#[contracttype]
pub enum DataKey {
    Signers,
    Threshold,
    ProposalCount,
    Proposal(u64),
}

#[contractimpl]
impl MultisigContract {
    pub fn initialize(env: Env, signers: Vec<Address>, threshold: u32) {
        if env.storage().instance().has(&DataKey::Signers) {
            panic!("already initialized");
        }
        if threshold as usize > signers.len() || threshold == 0 {
            panic!("invalid threshold");
        }

        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::ProposalCount, &0u64);
    }

    pub fn propose(env: Env, proposer: Address, action: ProposalAction) -> u64 {
        proposer.require_auth();
        Self::require_signer(&env, &proposer);

        let mut count: u64 = env.storage().instance().get(&DataKey::ProposalCount).unwrap();
        count += 1;

        let proposal = Proposal {
            id: count,
            action,
            approvals: Vec::new(&env),
            executed: false,
        };

        env.storage().persistent().set(&DataKey::Proposal(count), &proposal);
        env.storage().instance().set(&DataKey::ProposalCount, &count);

        count
    }

    pub fn approve(env: Env, signer: Address, proposal_id: u64) {
        signer.require_auth();
        Self::require_signer(&env, &signer);

        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found");

        if proposal.executed {
            panic!("already executed");
        }

        // Check not already approved by this signer
        for approved in proposal.approvals.iter() {
            if approved == signer {
                panic!("already approved");
            }
        }

        proposal.approvals.push_back(signer);
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);
    }

    pub fn execute(env: Env, proposal_id: u64) {
        let mut proposal: Proposal = env
            .storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .expect("proposal not found");

        if proposal.executed {
            panic!("already executed");
        }

        let threshold: u32 = env.storage().instance().get(&DataKey::Threshold).unwrap();
        if (proposal.approvals.len() as u32) < threshold {
            panic!("not enough approvals");
        }

        proposal.executed = true;
        env.storage().persistent().set(&DataKey::Proposal(proposal_id), &proposal);

        // Execute the action
        match proposal.action {
            ProposalAction::Upgrade(wasm_hash) => {
                env.deployer().update_current_contract_wasm(wasm_hash);
            }
            ProposalAction::ChangeThreshold(new_threshold) => {
                env.storage().instance().set(&DataKey::Threshold, &new_threshold);
            }
            // Handle other actions...
            _ => {}
        }
    }

    fn require_signer(env: &Env, addr: &Address) {
        let signers: Vec<Address> = env.storage().instance().get(&DataKey::Signers).unwrap();
        let mut is_signer = false;
        for s in signers.iter() {
            if &s == addr {
                is_signer = true;
                break;
            }
        }
        if !is_signer {
            panic!("not a signer");
        }
    }
}
```

## DeFi Patterns

### Vault Pattern (SEP-0056 style)
Tokenized vault for yield-bearing deposits.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
pub enum DataKey {
    Asset,           // underlying asset address
    TotalShares,
    TotalAssets,
    Shares(Address), // user shares
}

#[contractimpl]
impl Vault {
    pub fn deposit(env: Env, user: Address, assets: i128) -> i128 {
        user.require_auth();

        let asset_addr: Address = env.storage().instance().get(&DataKey::Asset).unwrap();
        let token = token::Client::new(&env, &asset_addr);

        // Transfer assets to vault
        token.transfer(&user, &env.current_contract_address(), &assets);

        // Calculate shares to mint
        let shares = Self::convert_to_shares(&env, assets);

        // Update state
        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let mut total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);
        let mut user_shares: i128 = env.storage().persistent().get(&DataKey::Shares(user.clone())).unwrap_or(0);

        total_shares += shares;
        total_assets += assets;
        user_shares += shares;

        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalAssets, &total_assets);
        env.storage().persistent().set(&DataKey::Shares(user), &user_shares);

        shares
    }

    pub fn withdraw(env: Env, user: Address, shares: i128) -> i128 {
        user.require_auth();

        let user_shares: i128 = env.storage().persistent().get(&DataKey::Shares(user.clone())).unwrap_or(0);
        if user_shares < shares {
            panic!("insufficient shares");
        }

        // Calculate assets to return
        let assets = Self::convert_to_assets(&env, shares);

        // Update state
        let mut total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap();
        let mut total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap();

        total_shares -= shares;
        total_assets -= assets;

        env.storage().instance().set(&DataKey::TotalShares, &total_shares);
        env.storage().instance().set(&DataKey::TotalAssets, &total_assets);
        env.storage().persistent().set(&DataKey::Shares(user.clone()), &(user_shares - shares));

        // Transfer assets to user
        let asset_addr: Address = env.storage().instance().get(&DataKey::Asset).unwrap();
        let token = token::Client::new(&env, &asset_addr);
        token.transfer(&env.current_contract_address(), &user, &assets);

        assets
    }

    fn convert_to_shares(env: &Env, assets: i128) -> i128 {
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);

        if total_shares == 0 || total_assets == 0 {
            assets // 1:1 for first deposit
        } else {
            (assets * total_shares) / total_assets
        }
    }

    fn convert_to_assets(env: &Env, shares: i128) -> i128 {
        let total_shares: i128 = env.storage().instance().get(&DataKey::TotalShares).unwrap_or(0);
        let total_assets: i128 = env.storage().instance().get(&DataKey::TotalAssets).unwrap_or(0);

        if total_shares == 0 {
            0
        } else {
            (shares * total_assets) / total_shares
        }
    }
}
```

### Oracle Integration Pattern
Consume price feeds from oracle contracts.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Symbol};

#[contracttype]
#[derive(Clone)]
pub struct PriceData {
    pub price: i128,      // price with decimals
    pub timestamp: u64,   // ledger timestamp
    pub decimals: u32,
}

// Import oracle contract (requires the compiled WASM)
mod oracle {
    soroban_sdk::contractimport!(
        file = "../oracle/target/wasm32-unknown-unknown/release/oracle.wasm"
    );
}

#[contract]
pub struct MyDeFiContract;

#[contractimpl]
impl MyDeFiContract {
    pub fn get_collateral_value(env: Env, oracle_addr: Address, asset: Symbol, amount: i128) -> i128 {
        // Create client for oracle contract
        let oracle_client = oracle::Client::new(&env, &oracle_addr);
        let price_data: PriceData = oracle_client.get_price(&asset);

        // Check price is fresh (within last ~10 minutes)
        let max_age: u64 = 120; // ledgers
        let current_ledger = env.ledger().sequence();
        if current_ledger - price_data.timestamp > max_age {
            panic!("stale price");
        }

        // Calculate value: amount * price / 10^decimals
        let decimals_factor = 10i128.pow(price_data.decimals);
        (amount * price_data.price) / decimals_factor
    }
}
```

### Liquidity Pool (Constant Product AMM)
```rust
use soroban_sdk::{contract, contractimpl, contracttype, token, Address, Env};

#[contracttype]
pub enum DataKey {
    TokenA,
    TokenB,
    ReserveA,
    ReserveB,
    TotalLiquidity,
    Liquidity(Address),
}

const FEE_BPS: i128 = 30; // 0.3% fee

#[contractimpl]
impl LiquidityPool {
    /// Swap token A for token B
    pub fn swap_a_for_b(env: Env, user: Address, amount_in: i128, min_out: i128) -> i128 {
        user.require_auth();

        let reserve_a: i128 = env.storage().instance().get(&DataKey::ReserveA).unwrap();
        let reserve_b: i128 = env.storage().instance().get(&DataKey::ReserveB).unwrap();

        // Calculate output with fee: (amount_in * (10000 - fee) * reserve_b) / (reserve_a * 10000 + amount_in * (10000 - fee))
        let amount_in_with_fee = amount_in * (10000 - FEE_BPS);
        let numerator = amount_in_with_fee * reserve_b;
        let denominator = reserve_a * 10000 + amount_in_with_fee;
        let amount_out = numerator / denominator;

        if amount_out < min_out {
            panic!("slippage exceeded");
        }

        // Transfer tokens
        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();

        token::Client::new(&env, &token_a).transfer(&user, &env.current_contract_address(), &amount_in);
        token::Client::new(&env, &token_b).transfer(&env.current_contract_address(), &user, &amount_out);

        // Update reserves
        env.storage().instance().set(&DataKey::ReserveA, &(reserve_a + amount_in));
        env.storage().instance().set(&DataKey::ReserveB, &(reserve_b - amount_out));

        amount_out
    }

    /// Add liquidity
    pub fn add_liquidity(env: Env, user: Address, amount_a: i128, amount_b: i128) -> i128 {
        user.require_auth();

        let reserve_a: i128 = env.storage().instance().get(&DataKey::ReserveA).unwrap_or(0);
        let reserve_b: i128 = env.storage().instance().get(&DataKey::ReserveB).unwrap_or(0);
        let total_liquidity: i128 = env.storage().instance().get(&DataKey::TotalLiquidity).unwrap_or(0);

        let liquidity: i128;
        if total_liquidity == 0 {
            // First deposit - liquidity = sqrt(amount_a * amount_b)
            liquidity = Self::sqrt(amount_a * amount_b);
        } else {
            // Proportional deposit
            let liquidity_a = (amount_a * total_liquidity) / reserve_a;
            let liquidity_b = (amount_b * total_liquidity) / reserve_b;
            liquidity = if liquidity_a < liquidity_b { liquidity_a } else { liquidity_b };
        }

        // Transfer tokens to pool
        let token_a: Address = env.storage().instance().get(&DataKey::TokenA).unwrap();
        let token_b: Address = env.storage().instance().get(&DataKey::TokenB).unwrap();

        token::Client::new(&env, &token_a).transfer(&user, &env.current_contract_address(), &amount_a);
        token::Client::new(&env, &token_b).transfer(&user, &env.current_contract_address(), &amount_b);

        // Update state
        let user_liquidity: i128 = env.storage().persistent().get(&DataKey::Liquidity(user.clone())).unwrap_or(0);
        env.storage().persistent().set(&DataKey::Liquidity(user), &(user_liquidity + liquidity));
        env.storage().instance().set(&DataKey::TotalLiquidity, &(total_liquidity + liquidity));
        env.storage().instance().set(&DataKey::ReserveA, &(reserve_a + amount_a));
        env.storage().instance().set(&DataKey::ReserveB, &(reserve_b + amount_b));

        liquidity
    }

    fn sqrt(n: i128) -> i128 {
        if n == 0 { return 0; }
        let mut x = n;
        let mut y = (x + 1) / 2;
        while y < x {
            x = y;
            y = (x + n / x) / 2;
        }
        x
    }
}
```

## Resource Optimization

### Batching Operations
Combine multiple operations to reduce transaction overhead.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env, Vec};

#[contracttype]
#[derive(Clone)]
pub struct Transfer {
    pub to: Address,
    pub amount: i128,
}

#[contractimpl]
impl BatchContract {
    /// Batch multiple transfers in one call
    pub fn batch_transfer(env: Env, from: Address, transfers: Vec<Transfer>) {
        from.require_auth();

        let token: Address = env.storage().instance().get(&DataKey::Token).unwrap();
        let token_client = token::Client::new(&env, &token);

        for transfer in transfers.iter() {
            token_client.transfer(&from, &transfer.to, &transfer.amount);
        }
    }
}
```

### Storage Optimization
```rust
// Use compact data structures
#[contracttype]
pub enum DataKey {
    // Use u32 IDs instead of full addresses when possible
    UserById(u32),
    IdByUser(Address),
    // Pack related data together
    UserData(u32), // contains balance, status, timestamp in one struct
}

// Use appropriate storage type
impl StorageOptimized {
    pub fn set_data(env: Env, key: DataKey, value: SomeData) {
        // Temporary: cheap, auto-deleted (use for caches, flags)
        env.storage().temporary().set(&DataKey::TempFlag, &true);

        // Instance: shared across contract (use for global config)
        env.storage().instance().set(&DataKey::Config, &config);

        // Persistent: per-key TTL (use for user balances, important state)
        env.storage().persistent().set(&DataKey::Balance(user), &balance);
    }
}
```

### Lazy Loading Pattern
Only load data when needed.

```rust
#[contractimpl]
impl LazyContract {
    pub fn process_if_needed(env: Env, user: Address) {
        // Check flag first (cheap read)
        let needs_processing: bool = env
            .storage()
            .temporary()
            .get(&DataKey::NeedsProcess(user.clone()))
            .unwrap_or(false);

        if !needs_processing {
            return; // Early exit, no expensive reads
        }

        // Only now load full user data (expensive)
        let user_data: UserData = env
            .storage()
            .persistent()
            .get(&DataKey::UserData(user.clone()))
            .unwrap();

        // Process...
    }
}
```

## Compliance Patterns (SEP-0057 style)

### Transfer Restrictions
Implement whitelisting for regulated tokens.

```rust
use soroban_sdk::{contract, contractimpl, contracttype, Address, Env};

#[contracttype]
pub enum DataKey {
    Admin,
    Whitelist(Address),
    TransfersPaused,
}

#[contractimpl]
impl RegulatedToken {
    /// Transfer with compliance checks
    pub fn transfer(env: Env, from: Address, to: Address, amount: i128) {
        from.require_auth();

        // Check not paused
        let paused: bool = env
            .storage()
            .instance()
            .get(&DataKey::TransfersPaused)
            .unwrap_or(false);
        if paused {
            panic!("transfers paused");
        }

        // Check both parties are whitelisted
        let from_whitelisted: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Whitelist(from.clone()))
            .unwrap_or(false);
        let to_whitelisted: bool = env
            .storage()
            .persistent()
            .get(&DataKey::Whitelist(to.clone()))
            .unwrap_or(false);

        if !from_whitelisted || !to_whitelisted {
            panic!("not whitelisted");
        }

        // Perform transfer...
        Self::do_transfer(&env, &from, &to, amount);
    }

    /// Admin: add address to whitelist
    pub fn add_to_whitelist(env: Env, address: Address) {
        Self::require_admin(&env);
        env.storage().persistent().set(&DataKey::Whitelist(address), &true);
    }

    /// Admin: remove address from whitelist
    pub fn remove_from_whitelist(env: Env, address: Address) {
        Self::require_admin(&env);
        env.storage().persistent().set(&DataKey::Whitelist(address), &false);
    }

    /// Admin: pause all transfers
    pub fn pause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::TransfersPaused, &true);
    }

    /// Admin: unpause transfers
    pub fn unpause(env: Env) {
        Self::require_admin(&env);
        env.storage().instance().set(&DataKey::TransfersPaused, &false);
    }

    fn require_admin(env: &Env) {
        let admin: Address = env.storage().instance().get(&DataKey::Admin).unwrap();
        admin.require_auth();
    }

    fn do_transfer(env: &Env, from: &Address, to: &Address, amount: i128) {
        // Implementation...
    }
}
```

### Clawback Support
Allow authorized recovery of tokens (for compliance).

```rust
#[contractimpl]
impl ClawbackToken {
    /// Clawback tokens from an address (compliance/legal requirement)
    pub fn clawback(env: Env, from: Address, amount: i128) {
        // Only clawback admin can call
        let clawback_admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::ClawbackAdmin)
            .unwrap();
        clawback_admin.require_auth();

        // Reduce balance (no auth from 'from' required)
        let mut balance: i128 = env
            .storage()
            .persistent()
            .get(&DataKey::Balance(from.clone()))
            .unwrap_or(0);

        if balance < amount {
            panic!("insufficient balance for clawback");
        }

        balance -= amount;
        env.storage().persistent().set(&DataKey::Balance(from.clone()), &balance);

        // Emit clawback event for audit trail
        ClawbackEvent(
            from: from.clone(),
            amount,
        ).publish(&env);
    }
}

```

### Burn Pattern

```rust


## Cross-Contract Call Patterns

### Callback Pattern
Handle async-style operations.

```rust
use soroban_sdk::{contract, contractimpl, Address, Env, Symbol, Val, Vec};

#[contractimpl]
impl CallbackContract {
    /// Initiate operation that will call back
    pub fn start_operation(env: Env, callback_contract: Address, callback_fn: Symbol) {
        // Do some work...
        let result: i128 = 42;

        // Call back to the initiator
        let args: Vec<Val> = Vec::from_array(&env, [result.into_val(&env)]);
        env.invoke_contract::<()>(&callback_contract, &callback_fn, args);
    }
}

#[contractimpl]
impl CallerContract {
    pub fn initiate(env: Env, target: Address) {
        let callback_client = CallbackContractClient::new(&env, &target);
        callback_client.start_operation(
            &env.current_contract_address(),
            &Symbol::new(&env, "on_complete"),
        );
    }

    /// Called by the target contract when operation completes
    pub fn on_complete(env: Env, result: i128) {
        // Verify caller is the expected contract
        // Handle result...
    }
}
```

## Related Standards

| Standard | Description | Status |
|----------|-------------|--------|
| [SEP-0046](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md) | Contract Meta | Active |
| [SEP-0048](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md) | Contract Interface Specification | Active |
| [SEP-0049](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0049.md) | Upgradeable Contracts | Draft |
| [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) | Tokenized Vault Standard | Draft |
| [SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md) | T-REX (Regulated Tokens) | Draft |
| [CAP-0058](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0058.md) | Constructors for Soroban | Final (Protocol 22) |
