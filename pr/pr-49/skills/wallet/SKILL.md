---
name: wallet
description: Use the Stellar CLI (`stellar`) as a wallet. Covers install and RPC/relayer configuration, key lifecycle and private-key security, funding, balances and account readiness, trustlines, value transfer, the `stellar token` client (SEP-41 / SAC), and transaction diagnosis, composed from existing commands with structured JSON output. Use when holding funds, moving value, managing tokens, checking balances, or transacting on Stellar from the command line.
user-invocable: true
argument-hint: "[wallet task]"
---

# Wallet: the Stellar CLI as a wallet

There is no `stellar wallet` command. The "wallet" is a set of composed CLI commands: `keys` for custody and selection, `ledger` for reads, `tx` for building and submitting, `token` for SEP-41 / SAC value transfer, and `contract` for contract interactions. This skill maps each wallet operation to the command that performs it, when to reach for it, and how to read the errors it returns.

Two habits apply everywhere:

1. **Pass `--output json`** on any command that supports it. You get a machine-readable object instead of formatted text, so the next step can parse it instead of scraping.
2. **Discover before you guess.** `stellar <cmd> --help` prints the exact args for any command. Do not hardcode contract IDs, fees, or sequence numbers — the pipeline resolves them.

## Read the file that matches the task

| Task | File |
|------|------|
| Create / import / export / list / select keys, private-key security, fund an account | [keys.md](keys.md) |
| Check balances and account readiness, trustlines, diagnose a transaction, sign + submit a prepared XDR, drain an account | [accounts-and-tx.md](accounts-and-tx.md) |
| Transfer / approve / burn tokens, read token metadata, SAC admin ops, pull a token list, asset anatomy | [tokens.md](tokens.md) |

## Composition map

| Wallet operation | Composed from | Covered in |
|------------------|---------------|------------|
| create a key | `keys generate` | [keys.md](keys.md) |
| import a key | `keys add` | [keys.md](keys.md) |
| export a secret | `keys secret` | [keys.md](keys.md) |
| fund an account | `keys fund` | [keys.md](keys.md) |
| list keys | `keys ls` | [keys.md](keys.md) |
| select the default key | `keys use` | [keys.md](keys.md) |
| check XLM balance and reserves | `ledger entry fetch account` | [accounts-and-tx.md](accounts-and-tx.md) |
| check a trustline | `ledger entry fetch trustline` | [accounts-and-tx.md](accounts-and-tx.md) |
| check a token balance | `token balance` | [tokens.md](tokens.md) |
| add or change a trustline | `tx new change-trust` | [accounts-and-tx.md](accounts-and-tx.md) |
| transfer value | `token transfer` | [tokens.md](tokens.md) |
| diagnose a transaction | `tx fetch --hash` | [accounts-and-tx.md](accounts-and-tx.md) |
| sign and submit a prepared XDR | `tx sign` + `tx send` | [accounts-and-tx.md](accounts-and-tx.md) |
| drain an account (sweep + close) | `token transfer` + `tx new account-merge` | [accounts-and-tx.md](accounts-and-tx.md) |

## Prerequisites

### Install the CLI

Install `stellar` (the Stellar CLI, package `stellar-cli`). Pick one:

```bash
brew install stellar-cli                              # macOS / Linux (Homebrew)
cargo install --locked stellar-cli                    # any platform with a Rust toolchain
winget install --id Stellar.StellarCLI                # Windows
npm install --global @stellar/cli                     # via npm
```

Verify: `stellar --version`. Full matrix and latest instructions: <https://developers.stellar.org/docs/tools/cli/install-cli>.

### Configure the network (RPC)

The CLI uses a [Stellar RPC](https://developers.stellar.org/docs/build/guides/rpc) in order to read ledger entries, simulate transactions, and submit them. The default is the public testnet RPC at `https://soroban-testnet.stellar.org`. You can also configure a named network for mainnet or a private network.

You can find a list of provicers at <https://developers.stellar.org/docs/data/apis/rpc/providers>.

```bash
# Save a named network once, then reference it with --network / -n
stellar network add testnet \
  --rpc-url https://soroban-testnet.stellar.org \
  --network-passphrase "Test SDF Network ; September 2015"
stellar network use testnet          # set the default so you can omit --network

stellar network ls                   # list configured networks
stellar network health               # confirm the RPC is reachable
```

You can also pass `--rpc-url` / `STELLAR_RPC_URL` and `--network-passphrase` / `STELLAR_NETWORK_PASSPHRASE` per command instead of saving a network.

### Configure a relayer (optional)

A relayer wraps your transaction in a fee-bump and signs + submits it, so the wallet key needs no XLM for fees. Configuration is `--relayer-url` / `STELLAR_RELAYER_URL` (plus `--relayer-header` for auth). Without a relayer, transactions are self-funded from the source account.

Learn more about the Relayer service at <https://developers.stellar.org/docs/tools/openzeppelin-relayer>.

## Structured output and errors

The CLI is designed for progressive disclosure and programmatic recovery:

- **Structured output.** `--output json` returns predictable keys. A state-changing command returns a *receipt* — result, tx hash, fee, decoded events. A read returns the decoded value.

  ```jsonc
  // stellar token balance --id native --of alice --output json
  { "status": "ok", "result": "9999999500", "error": null }
  ```

- **Structured errors.** On failure the object carries a code you can branch on and a remediation path:

  ```jsonc
  {
    "status": "error",
    "result": null,
    "error": {
      "code": "tx_simulation_failed",
      "domain": "tx",
      "message": "host invocation failed: Error(Contract, #2)",
      "details": { "error_name": "InsufficientBalance", "contract_id": "C…" }
    }
  }
  ```

  Read `error.code` / `error.details.error_name`, not the human message. The named-error → next-command table lives in [tokens.md](tokens.md#error-remediation).

## Working with Soroban protocols (DeFi)

This skill covers wallet primitives — moving value, trustlines, and transaction mechanics. It does **not** teach how any specific Soroban protocol works. Reference the DeFi skills when you need to:

1. **Understand how a protocol works** — its architecture, contracts, and on-chain addresses.
2. **Craft the transaction (or sequence of transactions)** to perform a protocol action — swap or quote, lend / borrow / repay, deposit / withdraw from a vault, provide liquidity.

The DeFi playbooks map each protocol's operations to concrete `contract invoke` / `stellar token` calls and carry the current contract references, so you act on the protocol instead of reverse-engineering it from raw ledger data.

Find them under [`../defi/SKILL.md`](../defi/SKILL.md)

## Related skills

- Classic assets, trustlines, authorization flags, and the SAC bridge → [`../assets/SKILL.md`](../assets/SKILL.md)
- The SEP-41 token contracts and SACs these commands call → [`../smart-contracts/SKILL.md`](../smart-contracts/SKILL.md)
- Querying chain data over RPC / Horizon → [`../data/SKILL.md`](../data/SKILL.md)
- SEP-41 and other standards → [`../standards/SKILL.md`](../standards/SKILL.md)
- Paying x402 / MPP services → [`../agentic-payments/SKILL.md`](../agentic-payments/SKILL.md)
- Acting on Soroban protocols (swap, lend, vaults) → [Working with Soroban protocols](#working-with-soroban-protocols-defi)

## Documentation

- [Stellar CLI manual](https://developers.stellar.org/docs/tools/cli/stellar-cli)
- [Anatomy of an asset](https://developers.stellar.org/docs/tokens/anatomy-of-an-asset)
- [Agentic Wallet CLI epic](https://github.com/stellar/stellar-cli/issues/2628)
