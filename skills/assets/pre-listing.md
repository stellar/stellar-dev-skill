# Pre-Listing Check — read-only asset due diligence

Before you list an asset, display it, or accept it as collateral, answer seven
questions from the ledger itself. Everything below **simulates only** —
`--send=no` never signs or submits, and no step needs a key.

The questions walk one chain: the issuer, then the SAC, then the SAC's admin,
then whoever controls that admin. Stop early and you report a governance layer
as if it were an authority.

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

# Threshold is also in the instance entry, so this command confirms it with
# no ABI. Signers is a separate persistent entry and needs its own key, so
# read it with --key-xdr or from a block explorer.
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
