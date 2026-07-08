# Accounts & transactions: read, provision, submit, diagnose

Back to the [wallet overview](SKILL.md).

## Stellar account & transaction model

The command pipeline applies sane defaults for the mechanics below — it picks the sequence number, sets a fee, fee-bumps on surge, submits, and polls to inclusion. You do not set these by hand. This section explains what they are so you can diagnose and recover when a default is not enough and a command surfaces one of the named errors.

### Minimum balance & reserves
<a name="reserves"></a>

An account must always hold a minimum XLM balance and **cannot spend below it**. The minimum is `(2 + number_of_subentries) × base_reserve`, where each trustline, offer, signer, and data entry is one subentry. Base reserve is currently **0.5 XLM** (a ledger parameter, so 1 XLM base minimum for a bare account, +0.5 per subentry).

Consequences you will hit:
- A transfer or fee that would drop XLM below the reserve fails even though the raw balance "looks" sufficient. Fund more, or move less.
- Draining requires ordering (see [drain](#drain)): each trustline is a subentry, so you remove trustlines before `account-merge`.

### Sequence numbers & idempotency

Every account has one **strictly-increasing sequence number**. Each transaction is valid only at `current_seq + 1` and consumes it on inclusion. This is the double-spend guard: a transaction that already landed **cannot be resubmitted** — a resubmit fails with `txBAD_SEQ`.

Operational rule: **on a timeout, do not blindly rebuild and resend.** First run `tx fetch --hash <hash>` ([diagnose](#diagnose-a-transaction)) to check whether the original landed. Resending the *same signed envelope* is safe (same sequence, so it either lands once or is already included); building a *new* transaction after the first may have landed is the double-spend risk.

### Fees, surge pricing & fee-bumps

The base fee is **100 stroops per operation** (1 stroop = 0.0000001 XLM). The fee you set is a **maximum bid**, not a fixed price — you are charged the market rate up to your bid. When the network is congested (surge pricing), a transaction that bid too low fails with `txINSUFFICIENT_FEE` (or is dropped as `tx_too_late` once its time bound passes).

- Raise the bid with `--inclusion-fee <stroops>` on `tx new …`.
- A **fee-bump** (CAP-15) wraps an already-signed inner transaction in an outer envelope with a *new fee source*, so a different account pays the fee. The pipeline applies one automatically on surge, and it is the exact mechanism a [relayer](SKILL.md#configure-a-relayer-optional) uses to sponsor fees so the wallet key needs no XLM.

### Transaction lifecycle: timeouts & safe retries

A transaction carries **time bounds** (`setTimeout`); past the upper bound it can no longer be included and returns `tx_too_late`. The CLI submits and then **polls to inclusion**, so a successful command already confirms the transaction landed. Transient RPC responses like `TRY_AGAIN_LATER` mean not-yet-included, not failed — retry the same envelope. Combine with the sequence rule above: safe retry = resend the same signed transaction; never rebuild-and-resend without checking inclusion first.

## Balances and readiness

<a name="readiness"></a>Before a state-changing command, confirm the account exists and holds what the operation needs.

```bash
# Account entry: XLM balance, subentry count, sequence number, reserves
stellar ledger entry fetch account --account alice --output json

# A specific trustline: does alice hold this asset, and up to what limit / authorization?
stellar ledger entry fetch trustline --account alice --asset USDC:GA5Z…ISSUER --output json

# A SEP-41 / SAC token balance (decimal-aware), including the native SAC
stellar token balance --id native --of alice --output json          # (via #2620)
```

Readiness checklist to run first:

1. **Account funded?** `ledger entry fetch account` succeeds and XLM balance covers the [minimum balance and reserves](#reserves). If the fetch reports the account as missing, it is unfunded — see [keys.md](keys.md#fund-an-account).
2. **Trustline present + authorized?** For any issued (non-native) asset, `ledger entry fetch trustline` must return an authorized line before a transfer can settle. If not, provision it (below).
3. **Enough balance?** Compare the decimal balance against the amount you intend to move.

## Trustlines

An issued asset can only be held by an account with an authorized trustline to it. Provision one before receiving or transferring that asset.

```bash
# Create / update a trustline from alice to USDC (limit defaults to max)
stellar tx new change-trust \
  --source alice \
  --line USDC:GA5Z…ISSUER \
  --network testnet

# Remove a trustline by setting the limit to 0 (balance must be 0 first)
stellar tx new change-trust --source alice --line USDC:GA5Z…ISSUER --limit 0
```

`tx new` commands build, sign (with `--source`), submit, and poll to inclusion in one call. Add `--build-only` to emit unsigned XDR instead (see [sign + submit](#sign-submit)).

Missing or unauthorized trustlines are the most common transfer failure. `token transfer` surfaces a named error pointing back here — see [tokens.md](tokens.md#error-remediation).

## Move value

`token transfer` is the primary path for all value transfer — native XLM, a classic asset, or a custom SEP-41 token — because every classic asset is reachable through its SAC ([tokens.md](tokens.md)).

`tx new payment` remains available as a pure classic payment operation. Reach for it when you want a classic-only payment that does not depend on the asset's SAC being deployed:

```bash
stellar tx new payment \
  --source alice \
  --destination GBOB…DEST \
  --asset USDC:GA5Z…ISSUER \
  --amount 100 \
  --network testnet --output json
```

## Diagnose a transaction

Given a tx hash, `tx fetch` explains what happened. Sub-commands narrow the projection.

```bash
stellar tx fetch --hash <TX_HASH> --output json          # full envelope + result
stellar tx fetch result --hash <TX_HASH> --output json   # just the result code
stellar tx fetch meta   --hash <TX_HASH> --output json    # ledger meta / state changes
stellar tx fetch fee    --hash <TX_HASH> --output json    # charged fee / fee-bump info
stellar tx fetch events --hash <TX_HASH> --output json    # decoded contract events
```

`--output` here also accepts `json-formatted` (multiline) and `xdr` (raw RPC). To turn a failed step into a diagnosis: fetch the hash, read the result code, and act on it.

## Sign and submit a prepared XDR
<a name="sign-submit"></a>

When you have an unsigned transaction envelope (from `--build-only`, an offline flow, or another tool), sign it then send it. Both read the XDR from an argument, a file, or stdin.

```bash
# Build without signing
stellar tx new payment --source alice --destination GBOB… --asset native --amount 10 \
  --build-only > tx.xdr

# Sign with a key, then submit; piping chains the two
stellar tx sign --sign-with-key alice tx.xdr | stellar tx send --network testnet --output json
```

## Drain an account (sweep + close)
<a name="drain"></a>

To empty and close an account, move every asset out, then merge the XLM balance and delete the account. Order matters — `account-merge` fails while the account still holds non-XLM balances or [subentries](#reserves).

1. **Sweep each non-native asset** with `token transfer` ([tokens.md](tokens.md)) until every issued balance is 0.
2. **Remove trustlines** you no longer need (`tx new change-trust --limit 0`) so no subentries block the merge.
3. **Merge XLM and close:**

   ```bash
   stellar tx new account-merge \
     --source alice \
     --account GDEST…KEEP \
     --network testnet --output json
   ```

`account-merge` transfers the remaining XLM (minus fee) to `--account` and removes the source account. Double-check the destination — this is irreversible.
