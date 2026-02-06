# Stellar Standards Reference (SEPs & CAPs)

## When to use this guide
Use this guide when you need:
- Understanding which SEPs apply to your use case
- Protocol-level capabilities from specific CAPs
- Interface specifications for interoperability
- Compliance with ecosystem standards

## SEPs for Smart Contracts

### Active/Final SEPs

| SEP | Title | Description | Use When |
|-----|-------|-------------|----------|
| [SEP-0041](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) | Soroban Token Interface | Standard token interface (balance, transfer, approve, allowance) | Building fungible tokens on Soroban |
| [SEP-0046](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md) | Contract Meta | Metadata storage in WASM custom sections | Adding version info, build metadata to contracts |
| [SEP-0048](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md) | Contract Interface Specification | XDR schema for contract interfaces (`contractspecv0`) | Auto-generated clients, tooling, block explorers |

### Draft SEPs (Emerging Standards)

| SEP | Title | Description | Use When |
|-----|-------|-------------|----------|
| [SEP-0044](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0044.md) | Token Memo Extension | Add memo support to token transfers | Compliance, exchange integration |
| [SEP-0045](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) | Web Auth for Contract Accounts | SEP-10 authentication for smart wallets | Passkey/smart wallet authentication |
| [SEP-0047](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0047.md) | Contract Interface Discovery | Discover which SEPs a contract implements | Building interoperable tooling |
| [SEP-0049](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0049.md) | Upgradeable Contracts | Guidelines for safe contract upgrades | Planning upgrade strategy |
| [SEP-0050](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) | Non-Fungible Tokens | NFT standard for Soroban | Building NFT collections |
| [SEP-0055](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0055.md) | Contract Build Verification | Verify contract source matches deployed WASM | Audit, trust verification |
| [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) | Tokenized Vault Standard | ERC-4626 style yield-bearing vaults | DeFi yield products |
| [SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md) | T-REX (Regulated Tokens) | Security tokens with compliance features | Regulated securities, KYC tokens |

---

## CAPs for Smart Contracts

### Soroban Core System (Protocol 20)

| CAP | Title | Key Concepts |
|-----|-------|--------------|
| [CAP-0046](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046.md) | Soroban Overview | Smart contract system architecture |
| [CAP-0046-01](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-01.md) | WASM Runtime | WebAssembly execution environment |
| [CAP-0046-02](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-02.md) | Contract Lifecycle | Deploy, invoke, update, archival |
| [CAP-0046-03](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-03.md) | Host Functions | Crypto, storage, cross-contract calls |
| [CAP-0046-05](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-05.md) | Smart Contract Data | Storage types, TTL, archival |
| [CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md) | Stellar Asset Contract (SAC) | Bridge classic assets to Soroban |
| [CAP-0046-07](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-07.md) | Fee & Resource Model | Compute, storage, bandwidth costs |
| [CAP-0046-08](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-08.md) | Events | Contract event emission |
| [CAP-0046-10](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-10.md) | Budget Metering | Resource limits and metering |
| [CAP-0046-11](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-11.md) | Authorization Framework | `require_auth()`, custom accounts |
| [CAP-0046-12](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-12.md) | State Archival | TTL management, restoration |

### Protocol 21 Enhancements

| CAP | Title | Description |
|-----|-------|-------------|
| [CAP-0051](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0051.md) | Secp256r1 Verification | WebAuthn/Passkey signature verification |
| [CAP-0053](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0053.md) | TTL Extension Functions | Separate instance/code TTL extension |
| [CAP-0054](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0054.md) | VM Cost Model | Refined WASM instantiation costs |
| [CAP-0055](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0055.md) | Streamlined Linking | Faster contract loading |
| [CAP-0056](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0056.md) | Module Caching | Intra-transaction WASM caching |

### Protocol 22 Features

| CAP | Title | Description |
|-----|-------|-------------|
| [CAP-0058](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0058.md) | Contract Constructors | `__constructor` for atomic initialization |
| [CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md) | BLS12-381 Curve | Cryptographic primitives for ZK proofs |

### Protocol 23 Features

| CAP | Title | Description |
|-----|-------|-------------|
| [CAP-0062](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0062.md) | Live State Prioritization | Optimized state access |
| [CAP-0065](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0065.md) | Reusable Module Cache | Cross-transaction WASM caching |
| [CAP-0066](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0066.md) | In-Memory Read Resource | Cheaper state reads |
| [CAP-0067](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md) | Unified Asset Events | Consistent event format for all assets |
| [CAP-0068](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0068.md) | Get Executable for Address | Query contract's WASM hash |
| [CAP-0069](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0069.md) | String/Bytes Conversion | Host functions for type conversion |

### Protocol 25 "X-Ray" (ZK Cryptography)

| CAP | Title | Description |
|-----|-------|-------------|
| [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md) | BN254 Curve | Ethereum-compatible ZK curve (EIP-196/197) |
| [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) | Poseidon Hash | ZK-friendly hash functions |

### Draft/Upcoming CAPs

| CAP | Title | Description | Status |
|-----|-------|-------------|--------|
| [CAP-0071](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0071.md) | Auth Delegation | Delegate auth to custom accounts | Draft |
| [CAP-0072](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0072.md) | Contract Signers | Add contract as account signer | Draft |
| [CAP-0073](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0073.md) | SAC G-Account Balances | SAC can create classic trustlines | Draft |
| [CAP-0078](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0078.md) | Limited TTL Extensions | Bounded TTL extension functions | Draft |
| [CAP-0079](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0079.md) | Muxed Address Strkey | Convert muxed addresses in contracts | Draft |
| [CAP-0080](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md) | ZK BN254 Utilities | Efficient ZK host functions | Draft |

---

## SEPs for Ecosystem Integration

### Authentication & Authorization

| SEP | Title | Description |
|-----|-------|-------------|
| [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) | Web Authentication | Challenge-response auth for web apps |
| [SEP-0045](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) | Web Auth for Contracts | SEP-10 for smart wallet accounts |

### Asset Metadata & Discovery

| SEP | Title | Description |
|-----|-------|-------------|
| [SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) | stellar.toml | Domain-level asset/account metadata |
| [SEP-0047](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0047.md) | Interface Discovery | Discover contract SEP implementations |

### Anchor Services (Fiat On/Off Ramps)

| SEP | Title | Description |
|-----|-------|-------------|
| [SEP-0006](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md) | Deposit/Withdrawal API | Programmatic anchor integration |
| [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md) | Hosted Deposit/Withdrawal | Interactive anchor flows |
| [SEP-0031](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md) | Cross-Border Payments | Direct fiat-to-fiat transfers |

### Compliance

| SEP | Title | Description |
|-----|-------|-------------|
| [SEP-0012](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md) | KYC API | Customer verification for anchors |
| [SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md) | T-REX | Regulated token framework |

---

## Quick Reference by Use Case

### Building a Token
1. **Fungible token**: Implement [SEP-0041](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md) interface
2. **NFT**: Follow [SEP-0050](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) (Draft)
3. **Regulated token**: Use [SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md) patterns
4. **Bridge classic asset**: Use SAC ([CAP-0046-06](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-06.md))

### Building DeFi
1. **Vault/Yield**: Follow [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) (Draft)
2. **ZK Privacy**: Use [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md)/[CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) primitives
3. **Price feeds**: No standard yet - see oracle integration patterns

### Building Smart Wallets
1. **Passkey auth**: Use [CAP-0051](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0051.md) (secp256r1)
2. **Web auth**: Implement [SEP-0045](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) (Draft)
3. **Custom accounts**: Use [CAP-0046-11](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046-11.md) auth framework

### Contract Lifecycle
1. **Metadata**: Use [SEP-0046](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md) `contractmeta!`
2. **Interface spec**: Auto-generated per [SEP-0048](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md)
3. **Upgrades**: Follow [SEP-0049](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0049.md) guidelines
4. **Build verification**: Use [SEP-0055](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0055.md) (Draft)

---

## Implementation Examples

### SEP-0041 Token Interface
```rust
use soroban_sdk::{contract, contractimpl, Address, Env, String, Symbol};

/// SEP-0041 compliant token interface
pub trait TokenInterface {
    // Admin
    fn initialize(env: Env, admin: Address, decimal: u32, name: String, symbol: String);

    // Getters
    fn name(env: Env) -> String;
    fn symbol(env: Env) -> Symbol;
    fn decimals(env: Env) -> u32;
    fn balance(env: Env, id: Address) -> i128;

    // Transfers
    fn transfer(env: Env, from: Address, to: Address, amount: i128);
    fn transfer_from(env: Env, spender: Address, from: Address, to: Address, amount: i128);

    // Allowances
    fn approve(env: Env, from: Address, spender: Address, amount: i128, expiration_ledger: u32);
    fn allowance(env: Env, from: Address, spender: Address) -> i128;

    // Supply
    fn total_supply(env: Env) -> i128;

    // Admin operations
    fn mint(env: Env, to: Address, amount: i128);
    fn burn(env: Env, from: Address, amount: i128);
}
```

### SEP-0046 Contract Metadata
```rust
use soroban_sdk::contractmeta;

// Version tracking (SEP-0049 recommended)
contractmeta!(key = "binver", val = "1.0.0");

// Custom metadata
contractmeta!(key = "author", val = "MyTeam");
contractmeta!(key = "repo", val = "https://github.com/myteam/mycontract");
```

**CLI build with metadata:**
```bash
stellar contract build --meta binver=1.0.0 --meta author=MyTeam
```

### SEP-0048 Interface Inspection
```bash
# View contract interface from local WASM file
stellar contract info interface --wasm target/wasm32-unknown-unknown/release/my_contract.wasm

# From deployed contract (by ID)
stellar contract info interface --contract-id CONTRACT_ID --network testnet

# Output as JSON instead of Rust
stellar contract info interface --wasm my_contract.wasm --output json-formatted
```

---

## Protocol Version Quick Reference

| Protocol | Key Features | Mainnet Date |
|----------|--------------|--------------|
| 20 | Soroban launch (smart contracts) | Feb 2024 |
| 21 | Secp256r1 (passkeys), TTL functions | Aug 2024 |
| 22 | Constructors, BLS12-381 | Nov 2024 |
| 23 | State optimization, unified events | Jan 2025 |
| 25 | BN254 + Poseidon (ZK) | Jan 2026 |
