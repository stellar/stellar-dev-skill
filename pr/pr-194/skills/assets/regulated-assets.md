# Regulated Assets (SEP-0008)

Per-transaction issuer approval for classic assets. Companion to [SKILL.md](SKILL.md); trustline authorization flags are covered there.

Use [SEP-0008](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0008.md) when the issuer must approve each transaction, not just each trustline (securities, transfer limits, per-transfer compliance checks). SEP-0008 itself advises against it unless regulation requires it: it adds operational overhead and friction for users.

## Issuer setup

The issuer sets both `AUTH_REQUIRED` and `AUTH_REVOCABLE`, runs an approval server, and flags the asset in its `[[CURRENCIES]]` entry:

```toml
[[CURRENCIES]]
code = "MYTOKEN"
issuer = "GABC..."
regulated = true
approval_server = "https://example.com/tx-approve"
approval_criteria = "Transfers need a completed KYC check."
```

The approval server must allow cross-origin requests (`Access-Control-Allow-Origin: *`) so browser wallets can call it.

## Compliant transaction shape

An approvable transaction authorizes the accounts, moves the asset, then deauthorizes them, all in one atomic transaction. No account is left with an open authorized trustline:

```
1. Issuer authorizes account A for asset X
2. Issuer authorizes account B for asset X
3. Payment of X from A to B
4. Issuer deauthorizes account B
5. Issuer deauthorizes account A
```

To let an account keep offers open, end in the `AUTHORIZED_TO_MAINTAIN_LIABILITIES` state instead of full deauthorization.

## Wallet flow

Build and sign the transaction, then POST it as `tx` (base64 envelope XDR, JSON or form-encoded) to `approval_server`. Branch on the response `status`:

- `success`: the issuer signed it. Submit the returned `tx`.
- `revised`: the server added operations (typically the authorize and deauthorize operations around the user's own) and signed. Show `message`. Check that the original operations are unchanged and that no added operation uses the user's account as its source. Then have the user re-sign and submit.
- `pending`: wait `timeout` milliseconds (`0` means unknown), then resend the same `tx`.
- `action_required`: open `action_url` (`action_method` `GET` or `POST`, optional SEP-9 `action_fields`), then resend. Any status can come back.
- `rejected` (HTTP 400): show `error` and do not submit.

The approval server signs but never submits; the wallet submits. The Go reference server that SEP-0008 links was removed from `stellar/go-stellar-sdk` in October 2025, so plan to build your own.

SEP-0008 works on classic assets and trustline flags. For permissioned contract tokens see SEP-0057 (T-REX, Draft) in [`../standards/SKILL.md`](../standards/SKILL.md).
