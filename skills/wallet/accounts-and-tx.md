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

<a name="readiness"></a>

Before a state-changing command, confirm the account exists and holds what the operation needs.

```bash
# Account entry: XLM balance, subentry count, sequence number, reserves
stellar ledger entry fetch account --account alice --output json

# A specific trustline: does alice hold this asset, and up to what limit / authorization?
stellar ledger entry fetch trustline --account alice --asset USDC:GA5Z…ISSUER --output json

# A SEP-41 / SAC token balance (raw base units), including the native SAC
stellar token balance --id native --of alice --output json
```

Readiness checklist to run first:

1. **Account funded?** `ledger entry fetch account` returns an `entries` array. An **unfunded / non-existent account is not an error** — the call succeeds with `"entries":[]`, so test for the empty array, not a failure. When the account is present, confirm its XLM balance covers the [minimum balance and reserves](#reserves). To fund, see [keys.md](keys.md#fund-an-account).
2. **Trustline present + authorized?** For any issued (non-native) asset, `ledger entry fetch trustline` must return an authorized line before a transfer can settle. If not, provision it (below).
3. **Enough balance?** Balances come back as **raw stroops** (e.g. `"balance":"110043500001"`), not decimal XLM — divide by `10_000_000` to compare against a human amount, and remember the amount you pass to move it is also in stroops.

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

`tx new payment` remains available as a pure classic payment operation. Reach for it when you want a classic-only payment that does not depend on the asset's SAC being deployed. **`--amount` is in stroops** (1 XLM = `10_000_000` stroops), *not* human units — passing `100` sends 100 stroops (0.00001 XLM), and it succeeds silently, so this is an easy 10⁷ mistake. All classic assets (native XLM and any `CODE:ISSUER`) are 7-decimal, so this stroop scale always applies here; SEP-41 tokens moved via `stellar token` can declare a different `decimals` — look it up ([tokens.md](tokens.md#amounts)):

```bash
stellar tx new payment \
  --source alice \
  --destination GBOB…DEST \
  --asset USDC:GA5Z…ISSUER \
  --amount 100000000 \                 # 10 units, in stroops (1 unit = 10_000_000)
  --network testnet --output json
```

`tx new payment` fails with `NoDestination` if the destination account does not exist on-chain yet (see [named errors](#errors)). To send value to a brand-new address, first create and fund it with `create-account` — `--starting-balance` is also in **stroops** (default `10_000_000` = 1 XLM):

```bash
stellar tx new create-account \
  --source alice \
  --destination GNEW…ADDR \
  --starting-balance 10000000 \        # 1 XLM, in stroops
  --network testnet --output json
```

With `--output json` these return a decoded *receipt* — result, tx hash, charged fee, and decoded events (see [structured output and errors](SKILL.md#structured-output-and-errors)). To diagnose a transaction you already submitted, look its hash up with [`tx fetch`](#diagnose-a-transaction).

## Named errors
<a name="errors"></a>

A failed on-chain transaction is not printed as a tidy message — it is a Rust debug dump. The name that tells you what went wrong is the innermost one:

```text
❌ error: transaction submission failed: Some(TransactionResult {
    fee_charged: 100,                                  // the fee is charged even though the tx failed
    result: TxFailed(VecM([OpInner(Payment(NoDestination))])),
    ext: V0,
})
```

Read the `<Op>(<ErrorName>)` at the center. The ones you will actually hit:

| Error name | Seen on | Meaning | Fix |
|------------|---------|---------|-----|
| `NoDestination` | `payment` | Destination account does not exist on-chain | Create it first with `create-account` ([move value](#move-value)) |
| `NoTrust` | `payment` | Destination has no authorized trustline for the (non-native) asset | Add the trustline ([trustlines](#trustlines)) before paying |
| `Underfunded` | `payment` | Source cannot cover the amount **and** stay above its [reserve](#reserves) | Reduce the amount, or fund the source |
| `InvalidLimit` | `change-trust` | New limit is below the current balance — including `--limit 0` while the balance is non-zero | Move the balance out to 0 first, *then* set `--limit 0` |
| `HasSubEntries` | `account-merge` | Account still holds subentries (trustlines, offers, …) | Remove every subentry first ([drain](#drain)) |

Failed transactions **still charge the fee** (`fee_charged` above), so a loop that retries a doomed transaction burns XLM each attempt.

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
# Build without signing (--amount in stroops: this is 10 XLM)
stellar tx new payment --source alice --destination GBOB… --asset native --amount 100000000 \
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
