---
name: assets
description: Stellar Assets (classic) + trustlines + Stellar Asset Contract (SAC) bridge to smart contracts. Covers asset issuance, distribution, authorization flags, clawback, regulated assets, trustline management, and the SAC interop layer that exposes classic assets as SEP-41 contract tokens. Use when tokenizing real-world assets, issuing stablecoins, managing trustlines, or bridging classic assets to smart contracts.
user-invocable: true
argument-hint: "[asset task]"
---

# Stellar Assets, Trustlines, and SAC

Stellar's native token mechanism: classic asset issuance, trustlines, and the Stellar Asset Contract (SAC) bridge that makes classic assets usable from smart contracts. Default to classic assets over custom contract tokens unless you need custom logic.

## When to use this skill
- Issuing a new asset (stablecoin, security token, utility token)
- Setting up trustlines from a client or contract
- Managing issuer flags (auth required, auth revocable, clawback)
- Bridging a classic asset into a smart contract via SAC
- Building regulated-asset flows (compliance, KYC, freeze)

## Related skills
- Custom token contracts (when classic isn't enough) → `../smart-contracts/SKILL.md`
- UI flows for trustline creation and asset display → `../dapp/SKILL.md`
- Looking up balances and trustline state → `../data/SKILL.md`
- Token-related SEPs (SEP-41, SEP-7, etc.) → `../standards/SKILL.md`

---


## Overview

Stellar has two token mechanisms:

1. **Stellar Assets (Classic)**: Built-in, highly efficient, full ecosystem support
2. **Contract tokens (SEP-41)**: Custom contracts with flexible logic

**Recommendation**: Prefer Stellar Assets unless you need custom token logic.

## Stellar Assets (Classic)

### Asset Types

| Type | Description |
|------|-------------|
| Native (XLM) | Stellar's native currency, no trustline needed |
| Credit | Issued by an account, requires trustline |
| Liquidity Pool Shares | Represent LP positions |

### Asset Identifiers

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

// Native XLM
const xlm = StellarSdk.Asset.native();

// Credit asset (code + issuer)
const usdc = new StellarSdk.Asset(
  "USDC",
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN"
);

// Asset code rules:
// - 1-4 chars: alphanumeric (credit_alphanum4)
// - 5-12 chars: alphanumeric (credit_alphanum12)
```

## Issuing Assets

### Create Issuing Account

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const server = new StellarSdk.Horizon.Server("https://horizon-testnet.stellar.org");

// 1. Create issuing account (should be separate from distribution)
const issuerKeypair = StellarSdk.Keypair.random();
const distributorKeypair = StellarSdk.Keypair.random();

// 2. Fund accounts (testnet)
await fetch(`https://friendbot.stellar.org?addr=${issuerKeypair.publicKey()}`);
await fetch(`https://friendbot.stellar.org?addr=${distributorKeypair.publicKey()}`);
```

### Issue Asset

```typescript
const asset = new StellarSdk.Asset("MYTOKEN", issuerKeypair.publicKey());

// 1. Distributor creates trustline to issuer
const distributorAccount = await server.loadAccount(distributorKeypair.publicKey());

const trustlineTx = new StellarSdk.TransactionBuilder(distributorAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.changeTrust({
      asset: asset,
      limit: "1000000", // Max amount to hold
    })
  )
  .setTimeout(180)
  .build();

trustlineTx.sign(distributorKeypair);
await server.submitTransaction(trustlineTx);

// 2. Issuer sends tokens to distributor
const issuerAccount = await server.loadAccount(issuerKeypair.publicKey());

const issueTx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.payment({
      destination: distributorKeypair.publicKey(),
      asset: asset,
      amount: "1000000",
    })
  )
  .setTimeout(180)
  .build();

issueTx.sign(issuerKeypair);
await server.submitTransaction(issueTx);
```

### Lock Issuing Account

For fixed-supply tokens, lock the issuer:

```typescript
const lockTx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.setOptions({
      masterWeight: 0, // Disable master key
    })
  )
  .setTimeout(180)
  .build();

lockTx.sign(issuerKeypair);
await server.submitTransaction(lockTx);
// Issuer can never issue more tokens
```

## Asset Flags

Configure issuer account flags for compliance:

```typescript
const setFlagsTx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.setOptions({
      setFlags:
        StellarSdk.AuthRequiredFlag |    // Trustlines require approval
        StellarSdk.AuthRevocableFlag |   // Can freeze trustlines
        StellarSdk.AuthClawbackEnabledFlag, // Can clawback tokens
    })
  )
  .setTimeout(180)
  .build();
```

### Flag Descriptions

| Flag | Effect |
|------|--------|
| `AUTH_REQUIRED` | Users must get approval before receiving tokens |
| `AUTH_REVOCABLE` | Issuer can freeze user balances |
| `AUTH_IMMUTABLE` | Flags cannot be changed (permanent) |
| `AUTH_CLAWBACK_ENABLED` | Issuer can clawback tokens from accounts |

### Authorize Trustline

```typescript
// When AUTH_REQUIRED is set, approve trustlines:
const authorizeTx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.setTrustLineFlags({
      trustor: userPublicKey,
      asset: asset,
      flags: {
        authorized: true,
        // authorizedToMaintainLiabilities: true, // Partial auth
      },
    })
  )
  .setTimeout(180)
  .build();
```

### Clawback Tokens

```typescript
// Requires AUTH_CLAWBACK_ENABLED flag
const clawbackTx = new StellarSdk.TransactionBuilder(issuerAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.clawback({
      asset: asset,
      from: targetAccountId,
      amount: "100",
    })
  )
  .setTimeout(180)
  .build();
```

## Trustlines

### Create Trustline

```typescript
const changeTrustTx = new StellarSdk.TransactionBuilder(userAccount, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.changeTrust({
      asset: asset,
      limit: "10000", // Max amount to hold (see "Remove Trustline" for limit: "0")
    })
  )
  .setTimeout(180)
  .build();
```

### Remove Trustline

`ChangeTrust` with `limit: "0"` deletes a trustline, but only if the trustline
is in a deletable state. Before submitting:

1. **Identify the asset by code AND issuer.** A wallet-display entry or a
   claimable balance is not a trustline — only an actual classic asset
   trustline (or liquidity pool share) on the account can be removed with
   `ChangeTrust`. Claimable balances are removed by claiming or clawing them
   back, not by `ChangeTrust`.
2. **Clear the balance.** The trustline balance must be exactly `0` — send
   remaining funds back to the issuer (burns them) or to another account.
3. **Clear offers / buying liabilities.** Open DEX offers that buy the asset
   create buying liabilities; cancel them before removal (`manageSellOffer`
   with `amount: "0"`, `manageBuyOffer` with `buyAmount: "0"`).
4. **Exit liquidity pool positions.** An asset trustline referenced by a
   liquidity pool (`liquidity_pool_use_count > 0`, per CAP-0038) cannot be
   deleted — withdraw from the pool and remove the pool-share trustline first.

```typescript
// 1. Check the trustline is deletable
const account = await server.loadAccount(userPublicKey);
const trustline = account.balances.find(
  (b) =>
    b.asset_type !== "native" &&
    b.asset_type !== "liquidity_pool_shares" &&
    b.asset_code === asset.getCode() &&
    b.asset_issuer === asset.getIssuer()
);

if (!trustline) throw new Error("No trustline (display/claimable state only?)");
if (parseFloat(trustline.balance) !== 0)
  throw new Error("Balance must be 0 — send funds away or back to issuer");
if (parseFloat(trustline.buying_liabilities) !== 0)
  throw new Error("Cancel open offers buying this asset first");

// Liquidity-pool usage (precondition 4) is not visible on this balance line —
// if the asset is still in one of the account's pools, the submit below fails
// with op_cannot_delete. Withdraw and remove the pool-share trustline first.

// 2. Submit removal and surface the specific result code
const removeTrustTx = new StellarSdk.TransactionBuilder(account, {
  fee: StellarSdk.BASE_FEE,
  networkPassphrase: StellarSdk.Networks.TESTNET,
})
  .addOperation(
    StellarSdk.Operation.changeTrust({
      asset: asset,
      limit: "0", // Delete the trustline
    })
  )
  .setTimeout(180)
  .build();

removeTrustTx.sign(userKeypair);

try {
  await server.submitTransaction(removeTrustTx);
} catch (e) {
  const codes = e.response?.data?.extras?.result_codes?.operations ?? [];
  if (codes.includes("op_invalid_limit")) {
    // CHANGE_TRUST_INVALID_LIMIT: balance or buying liabilities remain
    throw new Error("Clear balance and open offers before removing trustline");
  }
  if (codes.includes("op_cannot_delete")) {
    // CHANGE_TRUST_CANNOT_DELETE: trustline is used by a liquidity pool
    throw new Error("Withdraw from liquidity pools referencing this asset first");
  }
  throw e;
}
```

### Check Trustline Status

```typescript
const account = await server.loadAccount(userPublicKey);
const trustline = account.balances.find(
  (b) =>
    b.asset_type !== "native" &&
    b.asset_code === "USDC" &&
    b.asset_issuer === usdcIssuer
);

if (trustline) {
  console.log("Balance:", trustline.balance);
  console.log("Limit:", trustline.limit);
  console.log("Authorized:", trustline.is_authorized);
}
```

## Stellar Asset Contract (SAC)

SAC provides a smart-contract interface for Stellar Assets, enabling smart contract interactions.

### Deploy SAC for Existing Asset

```bash
# Get the SAC address for an asset
stellar contract asset deploy \
  --asset USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN \
  --source-account alice \
  --network testnet
```

### SAC Address Derivation

```typescript
import * as StellarSdk from "@stellar/stellar-sdk";

const asset = new StellarSdk.Asset("USDC", issuerPublicKey);
const contractId = asset.contractId(StellarSdk.Networks.TESTNET);
// Returns the deterministic SAC contract address
```

### Using SAC in Smart Contracts

```rust
use soroban_sdk::{token::Client as TokenClient, Address, Env};

pub fn transfer_asset(
    env: Env,
    from: Address,
    to: Address,
    asset_contract: Address,
    amount: i128,
) {
    from.require_auth();

    // Use standard token interface
    let token = TokenClient::new(&env, &asset_contract);
    token.transfer(&from, &to, &amount);
}
```

### SAC vs Custom Token Interface

SAC implements the standard SEP-41 token interface:
- `balance(id: Address) -> i128`
- `transfer(from: Address, to: Address, amount: i128)`
- `approve(from: Address, spender: Address, amount: i128, expiration_ledger: u32)`
- `allowance(from: Address, spender: Address) -> i128`
- `decimals() -> u32`
- `name() -> String`
- `symbol() -> Symbol`

## When to Use What

### Use Stellar Assets When:
- Standard fungible token (currency, stablecoin)
- Need full ecosystem support (wallets, exchanges)
- Regulatory compliance features (freeze, clawback)
- Performance critical (classic operations are cheaper)
- DEX integration via order book

### Use Custom Contract Tokens When:
- Complex transfer logic (royalties, fees, restrictions)
- Custom authorization schemes
- Non-standard token behaviors
- Integration with custom DeFi contracts
- NFTs or semi-fungible tokens

> Reach for a fully custom token as a last resort. Many of the cases above
> (royalties, fees, transfer restrictions) can be built with a regular
> issued Stellar asset plus a thin "SAC admin" contract that drives the
> SAC's `mint`, `burn`, and `clawback` functions. That keeps the ecosystem
> compatibility of a normal asset (DEX, anchors, wallets, trustlines) while
> still layering on custom logic. Prefer a custom contract token only when
> you need token behavior the SAC genuinely cannot express.
>
> **This runs in production today.** USDT0
> (`USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q`) is a
> classic asset whose SAC admin is a contract: a role-gated manager that
> forwards `mint`, `clawback`, `set_authorized`, and `set_admin` to the SAC,
> with a cross-chain bridge holding only the minter role. See
> [setting a custom SAC admin](https://developers.stellar.org/docs/build/guides/tokens/custom-sac-admin)
> for the pattern and `../cross-chain/layerzero.md` for that deployment.
>
> One hard prerequisite: **lock the issuer** (master key weight `0`).
> Payments from a classic issuer are minting, so an unlocked issuer can mint
> outside the contract and bypass the role model entirely.
>
> **Do it in this order: `set_admin` first, then lock the issuer.** A SAC's
> admin starts as the issuer account, and only the *current* admin can
> authorize the first `set_admin`. Lock the issuer before that call and the
> admin stays the locked issuer forever, because nobody can sign the handover
> ([SAC admin guide](https://developers.stellar.org/docs/build/guides/tokens/custom-sac-admin)).
> After the handover the SAC still mints under the new admin, so lock the
> issuer then.

### Use SAC When:
- Need a Stellar asset inside a smart contract
- Building DeFi protocols with existing assets
- Bridge between classic and smart contract operations

## Querying Assets

### Get Account Balances

```typescript
const account = await server.loadAccount(publicKey);

for (const balance of account.balances) {
  if (balance.asset_type === "native") {
    console.log("XLM:", balance.balance);
  } else {
    console.log(`${balance.asset_code}:`, balance.balance);
  }
}
```

### Find Assets

```typescript
// Search for assets by code
const assets = await server
  .assets()
  .forCode("USDC")
  .call();

// Get specific asset details
const assetDetails = await server
  .assets()
  .forCode("USDC")
  .forIssuer(issuerPublicKey)
  .call();
```

### Get Asset Statistics

```typescript
const stats = await server
  .assets()
  .forCode("USDC")
  .forIssuer(issuerPublicKey)
  .call();

// stats includes:
// - amount: total issued
// - num_accounts: trustline count
// - flags: issuer flags
```

### Pre-Listing Check (read-only)

Before you list an asset, display it, or accept it as collateral, answer seven
questions from the ledger itself. Everything below **simulates only** —
`--send=no` never signs or submits, and no step needs a key.

USDT0 as the worked example (an asset with a locked issuer, a contract admin,
and no `stellar.toml`):

```bash
ISSUER=GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q
SAC=CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF

# 1. Is the issuer locked, and which flags are set?
#    Read: thresholds and signers (see "Step 1" below — the signer list
#    alone does not answer this), flags, and whether home_domain exists.
#    flags is one number here, not the named booleans Horizon returns:
#    1 auth_required, 2 auth_revocable, 4 auth_immutable,
#    8 auth_clawback_enabled. USDT0's issuer reads 10, so it is revocable
#    and clawback-enabled, and auth_immutable is not set.
stellar ledger entry fetch account --account $ISSUER --network mainnet

# 2. Does the SAC address actually derive from this asset?
#    Derive it yourself — never trust a SAC address from a website.
stellar contract id asset --asset USDT0:$ISSUER --network mainnet   # must equal $SAC

# 3. Does the contract agree about what it wraps?
stellar contract invoke --id $SAC --source-account alice \
  --network mainnet --send=no -- name      # "USDT0:GATISXX6…"
stellar contract invoke --id $SAC --source-account alice \
  --network mainnet --send=no -- symbol    # "USDT0"
stellar contract invoke --id $SAC --source-account alice \
  --network mainnet --send=no -- decimals  # 7 for every classic asset

# 4. Who administers it? The instance entry carries the executable and admin.
stellar ledger entry fetch contract-data --contract $SAC --instance \
  --output json-formatted --network mainnet

# 5. Is it bridged? Then read the bridge contract too.
#    USDT0's LayerZero OFT: does it wrap this SAC, at what precision, in
#    which mode, and is it halted right now?
OFT=CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6

stellar contract invoke --id $OFT --source-account alice \
  --network mainnet --send=no -- token            # must equal $SAC
stellar contract invoke --id $OFT --source-account alice \
  --network mainnet --send=no -- shared_decimals  # 6: dust below it is dropped
stellar contract invoke --id $OFT --source-account alice \
  --network mainnet --send=no -- oft_type         # MintBurn(<SAC admin>)
stellar contract invoke --id $OFT --source-account alice \
  --network mainnet --send=no -- endpoint         # the LayerZero endpoint
stellar contract invoke --id $OFT --source-account alice \
  --network mainnet --send=no -- is_paused        # true stops every transfer

# 6. Who can mint, freeze, claw back, or move the admin? Ask the admin
#    contract from step 4. Roles are live state — read them, don't assume.
MANAGER=CA3GUWLOS3QKN6WNRAELSUDSKLDTVTWEDJ3KLGAJG3SIWGA5L3KZYWGJ

stellar contract invoke --id $MANAGER --source-account alice \
  --network mainnet --send=no -- owner               # grants and revokes any role
stellar contract invoke --id $MANAGER --source-account alice \
  --network mainnet --send=no -- get_existing_roles  # roles with >= 1 member

# get_existing_roles lists only roles that have a member today. Ask about
# the empty ones by name as well, and add anything new the call returned.
# Both views below are safe on an empty role: None, and 0.
for ROLE in MINTER_ROLE CLAWBACK_ROLE BLACKLISTER_ROLE ADMIN_MANAGER_ROLE; do
  stellar contract invoke --id $MANAGER --source-account alice \
    --network mainnet --send=no -- get_role_admin --role "$ROLE"
  stellar contract invoke --id $MANAGER --source-account alice \
    --network mainnet --send=no -- get_role_member_count --role "$ROLE"
done

# Every role that get_role_admin named is now part of the list too: its
# members can grant the role it administers, even while that role is empty.
# Walk index 0 .. count-1 for each role that has members. get_role_member
# panics with IndexOutOfBounds past the count.
stellar contract invoke --id $MANAGER --source-account alice \
  --network mainnet --send=no -- get_role_member --role MINTER_ROLE --index 0

# 7. Step 6 ends at an owner. If that owner is a contract, it is another
#    governance layer, not an answer — read its own quorum too.
#    USDT0's owner is a LayerZero OneSig multisig.
ONESIG=CBCZ5CETG3XR5MZVDC7QBDOTIH6P7MOLUH2SSC52J3NVBYIV45D4QKR6

stellar contract invoke --id $ONESIG --source-account alice \
  --network mainnet --send=no -- get_signers   # 20-byte secp256k1 addresses
stellar contract invoke --id $ONESIG --source-account alice \
  --network mainnet --send=no -- threshold     # signatures needed to act

# The same two values are in the ledger entries, with no ABI:
# Threshold in the instance entry, Signers in a persistent one.
stellar ledger entry fetch contract-data --contract $ONESIG --instance \
  --output json-formatted --network mainnet
```

Reading the results:

- **Step 1 hinges on the master key, not the signer list.** In the ledger entry,
  `thresholds` is a 4-byte hex string and its **first** byte is the master key
  weight; the other three are the low, medium and high thresholds. The `signers`
  list holds only the *extra* signers, so "every listed signer has weight 0"
  proves nothing on its own — an account with a live master key and no extra
  signers has an empty `signers` list. Locked means the master weight is `0`
  *and* the extra signers cannot reach the medium or high threshold *together*.
  Stellar adds up the weights of every signature on a transaction, so test the
  sum, not the largest single signer.
  USDT0's issuer reads `thresholds` `00000000` with no extra signers. (Horizon differs:
  its `/accounts` response folds the master key into its own `signers` array.)
- **`flags` is a bitmask here, not four booleans.** The ledger entry carries the
  raw `u32`: `1` auth_required, `2` auth_revocable, `4` auth_immutable, `8`
  auth_clawback_enabled. USDT0's issuer reads `10`, which is auth_revocable plus
  auth_clawback_enabled. Horizon's `/accounts` names the same four flags for
  you, so decode the number or read Horizon — but do not expect named fields
  from `stellar ledger entry fetch account`.
- **Step 2 is the identity check**, not the domain. A real SAC's contract
  instance has a `stellar_asset` executable rather than a Wasm hash, and its
  `name()`/`symbol()` report the wrapped asset. Per the
  [SAC docs](https://developers.stellar.org/docs/tokens/stellar-asset-contract#contract-interface),
  a contract address and a current `admin` value are not by themselves proof
  of provenance — verify the executable first, because `set_admin` can move
  administration at any time.
- **A locked issuer plus a contract admin is a deliberate design**, not a red
  flag: it is how a classic asset gets programmable minting. But it moves the
  trust question to that contract's roles, so identify the role holders.
- **An unlocked issuer with clawback enabled is the actual risk.** The issuer
  can then mint and claw back directly, whatever any admin contract says.
- **Step 5 names the bridge's minter, not every minter.** `oft_type` returning
  `MintBurn(<address>)` means that address mints on credit, so it must be the
  SAC admin from step 4 or a role holder on it. It does not enumerate the
  others — that is step 6. A `shared_decimals` below the SAC's 7 also means
  sends drop the extra digits. See `../cross-chain/layerzero.md` for that rail.
- **Step 6 names who can act on the SAC.** Three parties can act on a role, not
  one: its **members** (walk `get_role_member` from index `0` to
  `get_role_member_count - 1`), the members of its **admin role** if
  `get_role_admin` returns one, and the **owner**, always.
- **An empty role is not a safe role.** LayerZero's SAC manager gates `mint`,
  `clawback`, `set_authorized` and `set_admin` behind `MINTER_ROLE`,
  `CLAWBACK_ROLE`, `BLACKLISTER_ROLE` and `ADMIN_MANAGER_ROLE`. A role with no
  members blocks nobody permanently, because the owner fills it in one
  transaction. Model the owner as holding every role.
- **`get_existing_roles` is not the role list.** It returns only roles that have
  at least one member right now, so an empty `CLAWBACK_ROLE` never appears in
  it. A role's admin role is stored separately from its members, and it survives
  an empty role: whoever holds that admin role can grant the empty role without
  the owner. Iterating the returned list alone therefore hides real authority.
  Query all four roles by name, plus any others that call reports, and then
  enumerate the members of every admin role you find. Those members belong in
  the answer next to the role's own members.
- **Step 7 exists because an owner can be a contract.** "The owner is a
  multisig" is not a finding. Walk the chain until it ends at keys, and record
  the quorum you found. If the owner is a contract you cannot read — no source,
  no view functions, no storage you can decode — then say so and mark ultimate
  control **unresolved**. Do not report the asset as reviewed.
- **USDT0 on 2026-08-28**: `get_existing_roles` returns `MINTER_ROLE` only, its
  one member is the OFT, it has no admin role, and the owner is the OneSig
  contract `CBCZ5CET…`. That OneSig holds **5 signers with a threshold of 3**,
  so any 3 of them can mint, claw back, blacklist or move the SAC admin. The
  signers are Ethereum-style 20-byte secp256k1 addresses, not Stellar keys, so a
  Stellar-only review never sees them. They can also replace themselves:
  `set_signer` and `set_threshold` need the same quorum, nobody else.
  Re-read all of this — it is live state.

## SEP Standards for Assets

### SEP-0001 (stellar.toml)

Publish asset metadata in your domain's `/.well-known/stellar.toml`:

```toml
[[CURRENCIES]]
code = "MYTOKEN"
issuer = "GABC..."
display_decimals = 2
name = "My Token"
desc = "A description of my token"
image = "https://example.com/token-logo.png"
```

### SEP-0010 (Web Authentication)

Authenticate users with their Stellar accounts. Flow: the server generates a challenge transaction, the client signs it with their wallet, and the server verifies the signature. See [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md).

### SEP-0024 (Hosted Deposit/Withdrawal)

For fiat on/off ramps: an interactive webview flow where the anchor handles KYC and the fiat transfer. See [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md).

### SEP-0045 (Web Auth for Contract Accounts)

Extends SEP-10 to support contract accounts (`C...` addresses) for web authentication. Required for smart wallet / passkey-based anchor integrations. Draft status; verify current status in [SEP-0045](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md).

### SEP-0050 (Non-Fungible Tokens)

Standard contract interface for NFTs on Stellar. Reference implementations available in [OpenZeppelin Stellar Contracts](https://github.com/OpenZeppelin/stellar-contracts) with Base, Consecutive, and Enumerable variants. Draft status; verify current status in [SEP-0050](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md).

## Best Practices

### Asset Issuance
- Use separate issuing and distribution accounts
- Lock issuer after initial distribution for fixed supply
- Publish stellar.toml with asset metadata
- Consider multisig for issuer account

### Trustline Management
- Check trustline exists before sending payments
- Handle trustline creation in onboarding flow
- Respect trustline limits
- Monitor for frozen/deauthorized status
- Before removing a trustline (`limit: "0"`): zero the balance, cancel offers
  buying the asset, and exit liquidity pools that reference it

### Security
- Validate asset issuer, not just code
- Be cautious of assets with clawback enabled
- Verify stellar.toml from authoritative source
- Use well-known asset lists for common tokens
- **Some live assets have no `stellar.toml` at all.** A missing `home_domain`
  is not evidence of a scam — USDT0 ships without one. Validate by issuer
  plus SAC derivation, never by the presence of `home_domain` or a
  `[[CURRENCIES]]` entry
- **When `AUTH_REVOCABLE` and `AUTH_CLAWBACK_ENABLED` are both set, check the
  issuer lock *and* the admin roles before listing the asset.** Those flags
  mean balances can be frozen or clawed back. A contract SAC admin does not
  contain that power on its own: an issuer whose master key still signs can
  mint, freeze and claw back directly, whatever the admin contract allows. So
  confirm the master key weight is `0` (see the pre-listing check above), then
  identify who holds the admin contract's roles
