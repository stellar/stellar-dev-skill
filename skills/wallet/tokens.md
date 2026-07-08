# Tokens: the `stellar token` client

`stellar token` is a typed client for any SEP-41 token or Stellar Asset Contract (SAC). Each subcommand is a thin wrapper over `contract invoke` with token-aware argument parsing, asset/contract resolution, and decimal-aware amounts. Every state-changing subcommand inherits the full pipeline — simulate, sign auth entries, sign the transaction, fee-bump if needed, submit, poll — and returns a decoded JSON receipt. No sequence number or fee is requested from you.

Back to the [wallet overview](SKILL.md).

## Target resolution

A subcommand targets a contract with `--id`:

- `--id native` — the XLM SAC (special-cased).
- `--id C…` — any SEP-41 / SAC contract address directly.
- `--id <alias>` — a saved contract alias.
- `--id CODE:ISSUER` — a classic asset; resolves to its deterministic SAC id.

Get a classic asset's SAC id (or deploy the SAC) without transferring:

```bash
stellar contract id asset     --asset USDC:GA5Z…ISSUER --network testnet   # compute the SAC id
stellar contract asset deploy --asset USDC:GA5Z…ISSUER --source alice --network testnet
```

## Subcommand reference

| Group | Subcommand | Key args | Purpose |
|-------|-----------|----------|---------|
| Transfer | `transfer` | `--id <t> --to <dst> <amount>` | Move tokens. The primary value-transfer command. |
| Transfer | `transfer-from` | `--id <t> --from <a> --to <dst> <amount>` | Spend an allowance on behalf of another holder. |
| Read | `balance` | `--id <t> --of <addr>` | Decimal-aware balance. |
| Read | `allowance` | `--id <t> --from <a> --spender <s>` | Read an allowance. |
| Read | `name` / `symbol` / `decimals` | `--id <t>` | Token metadata. |
| Allowance | `approve` | `--id <t> --spender <s> <amount> --expires <ledger>` | Set an allowance. |
| Supply | `burn` | `--id <t> <amount>` | Burn from the caller's balance. |
| Supply | `burn-from` | `--id <t> --from <a> <amount>` | Burn from an allowance. |
| SAC admin | `mint` | `--id <t> --to <a> <amount>` | Mint (admin only). |
| SAC admin | `set-admin` | `--id <t> --new-admin <a>` | Transfer admin. |
| SAC admin | `clawback` | `--id <t> --from <a> <amount>` | Claw back (admin only). |
| SAC admin | `set-authorized` | `--id <t> --addr <a> --authorized <bool>` | Set trustline authorization. |

## Transfer example

```bash
# Transfer 100 XLM through the native SAC — resolves, simulates, signs, submits, polls
stellar token transfer \
  --id native \
  --to GBOB…DEST \
  --source alice \
  --network testnet \
  --output json \
  100
```

The receipt carries `status`, the decoded `result`, the tx hash, the charged fee, and decoded events. For an issued asset, pass `--id USDC:GA5Z…ISSUER` (or its SAC `C…` id); the destination must hold an authorized trustline.

Amounts are **decimal-aware**: pass human units (`100`), not stroops or base units. `token decimals --id <t>` tells you the scale.

## Reads

```bash
stellar token balance --id USDC:GA5Z…ISSUER --of alice --output json
stellar token decimals --id USDC:GA5Z…ISSUER --output json
stellar token symbol   --id USDC:GA5Z…ISSUER --output json
```

Reads never sign or submit; they simulate and return the decoded value.

## Error remediation
<a name="error-remediation"></a>

State-changing token calls return a structured error with a `code` you branch on. The recurring ones and their next command:

| Error | Meaning | Next step |
|-------|---------|-----------|
| SAC not deployed | The classic asset's SAC does not exist on-chain yet | `stellar contract asset deploy --asset CODE:ISSUER --source <admin>` |
| missing / unauthorized trustline | Destination (or source) has no authorized trustline for the asset | `stellar tx new change-trust --source <acct> --line CODE:ISSUER` — see [accounts-and-tx.md](accounts-and-tx.md#trustlines) |
| insufficient balance | Source balance below the amount (remember XLM must stay above the [reserve](accounts-and-tx.md#reserves)) | Check `token balance`; reduce the amount or fund the account |
| insufficient allowance | `transfer-from` / `burn-from` exceeds the approved amount | Have the owner call `token approve` with a higher amount and a future `--expires` ledger |
| not authorized (admin) | Caller is not the SAC admin | Use the admin key, or `set-admin` first |

Read `error.code` / `error.details.error_name` from the JSON, not the human message. The full error-object shape is in the [wallet overview](SKILL.md#structured-output-and-errors).

## Pull a trusted token list

Don't hardcode contract IDs. Resolve assets from a published, trusted list so you target the right issuer. Stellar's convention is [SEP-1 `stellar.toml`](https://developers.stellar.org/docs/tokens/publishing-asset-information) `[[CURRENCIES]]`, and asset directories publish JSON.

```bash
# Fetch a home domain's stellar.toml and list its declared assets (code:issuer)
curl -s https://<home-domain>/.well-known/stellar.toml \
  | grep -E '^(code|issuer)\s*=' 

# Example: a JSON asset list (e.g. an ecosystem token list), extract code + issuer
curl -s https://<asset-list-url>/list.json \
  | jq -r '.assets[] | "\(.code):\(.issuer)"'
```

Then resolve each `CODE:ISSUER` to a SAC id with `stellar contract id asset --asset CODE:ISSUER` before transferring. Prefer issuers whose `stellar.toml` is served from the same home domain declared on the issuing account (the SEP-1 linkage is what makes the asset "trusted").

You can learn more about Stellar Asset Lists here: <https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0042.md>, scroll to the bottom to find a few of the most commonly used asset lists.

## Asset anatomy

A Stellar asset is `CODE:ISSUER` (a `G…` issuing account plus a 1–12 char code); `native` is XLM. The SAC wraps that classic asset behind the SEP-41 contract interface so contracts — and `stellar token` — can move it. USDC therefore has two addresses: the classic issuer (`G…`, used for trustlines) and the SAC (`C…`, the contract `transfer` targets). Deep dive: [Anatomy of an asset](https://developers.stellar.org/docs/tokens/anatomy-of-an-asset), and the classic-asset + SAC bridge in [`../assets/SKILL.md`](../assets/SKILL.md).
