---
name: blend
description: Blend v2 lending protocol playbook for the Stellar CLI. Covers Blend's architecture (permissionless pools, reserves, the backstop insurance module, BLND emissions), the v2 mainnet/testnet contract references, how to discover pools and read live pool/backstop state over RPC, how to check accrued BLND emissions and project position earnings, and how to build the core lending and backstop transactions with `contract invoke`. Use when supplying, borrowing, repaying, withdrawing, claiming emissions, estimating yield, or providing backstop capital on Blend from the command line.
user-invocable: true
argument-hint: "[blend task]"
---

# Blend v2: lending & backstop playbook

Blend is a permissionless, over-collateralized lending protocol on Soroban. Anyone can create an isolated lending **pool**; each pool holds one or more **reserves** (assets you can supply and borrow) and is insured by a **backstop** of first-loss capital that earns a share of interest plus BLND emissions.

This playbook covers **Blend v2** — the current deployment on both mainnet and testnet. All addresses, signatures, and semantics below are v2; the legacy v1 mainnet deployment (different addresses, different backstop `claim` shape, 21-day Q4W) is out of scope.

This playbook maps each Blend operation to the `contract invoke` call that performs it, and shows how to read live pool/backstop state over RPC. Keys, signing, fees, and submission are handled by the [wallet skill](../../wallet/SKILL.md) — every transaction below is signed and submitted with that pipeline.

> **Scope.** This playbook targets **Blend v2**. Confirm the deployed interface with `stellar contract info interface --id <contract>` — see [reading state](#reading-blend-state-over-rpc). The addresses below are the **Blend v2** deployments on both networks; the older v1 mainnet deployment uses different addresses and its ABI can differ.

## Read the file that matches the task

| Task | File |
|------|------|
| Supply, borrow, repay, withdraw; read reserves, positions, pool config; check/claim BLND emissions; project position earnings (supply APY + emissions) | [lending.md](lending.md) |
| Deposit to a backstop, queue/withdraw (Q4W), preview/claim backstop emissions; find the most profitable backstop | [backstop.md](backstop.md) |

## Architecture

| Entity | What it is |
|--------|------------|
| **Pool** | One isolated lending market. Holds all reserves, user positions, and interest accounting. You interact with a pool almost entirely through its `submit` entrypoint. Each pool references one oracle and one backstop. |
| **Reserve** | A single asset within a pool. Supply is tracked as **bTokens** (supply/collateral shares), debt as **dTokens** (liability shares); their value grows via `b_rate` / `d_rate` indexes. These are internal accounting units, not transferable SEP-41 tokens. |
| **Pool Factory** | Deploys pools deterministically and records which pool addresses it created (`is_pool`). The backstop trusts only factory-deployed pools. To enumerate pools, use the backstop's reward zone — see [discovering pools](lending.md#discovering-pools). |
| **Backstop** | Holds first-loss capital per pool, denominated in the **backstop token** — a Comet (Balancer-style) 80/20 BLND:USDC LP token (confirm weights with the LP token's `get_normalized_weight`). Backstop depositors absorb bad debt in exchange for a share of interest + BLND emissions. See [backstop.md](backstop.md). |
| **Emitter** | Streams BLND emissions to the backstop, distributed to pools in the reward zone. |
| **Oracle** | A SEP-40-style price oracle the pool reads for asset prices. Address is per-pool (`PoolConfig.oracle`); read it, don't assume it. |

## Contract references

Only these three addresses per network are treated as fixed literals. **Everything else is derived on-chain**: the BLND token, the backstop LP token, each pool's oracle, and the pools themselves.

| Role | Mainnet | Testnet |
|------|---------|---------|
| Pool Factory | `CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU` | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` |
| Backstop | `CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7` | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` |
| Emitter | `CCOQM6S7ICIUWA225O5PSJWUBEMXGFSSW2PQFO6FP4DQEKMS5DASRGRR` | `CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6` |

Both columns are the **Blend v2** deployment, from the [blend-utils registry](https://github.com/blend-capital/blend-utils) (`mainnet.contracts.json` / `testnet.contracts.json`) and the [Blend docs deployment list](https://docs.blend.capital/mainnet-deployments). A separate v1 deployment still exists on mainnet at different addresses (v1 backstop `CAO3AGAM…`, v1 pool factory `CCZD6ESM…`); this playbook does not cover it — if a user hands you a pool address, confirm it was deployed by the v2 factory before assuming v2 semantics.

### Network setup

Set the three literals once. **Testnet works out of the box** (the CLI ships a testnet RPC):

```bash
# Testnet (v2)
POOL_FACTORY=CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6
BACKSTOP=CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA
EMITTER=CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6
NETWORK=testnet
ME=alice        # any funded key alias — required even for reads (they only build a simulation)
```

**Mainnet does not work out of the box**: the CLI's built-in `mainnet` network is a placeholder with **no RPC URL** — every command fails until you add one. Pick a public endpoint from the [standards skill's mainnet RPC list](../../standards/SKILL.md#public-mainnet-rpc-endpoints) and register it first:

```bash
# Mainnet (v2) — add an RPC endpoint first; the built-in `mainnet` alias has none
stellar network add mainnet \
  --rpc-url <RPC_ENDPOINT_URL> \
  --network-passphrase "Public Global Stellar Network ; September 2015"

POOL_FACTORY=CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU
BACKSTOP=CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7
EMITTER=CCOQM6S7ICIUWA225O5PSJWUBEMXGFSSW2PQFO6FP4DQEKMS5DASRGRR
NETWORK=mainnet
ME=alice
```

Every example below passes `--network "$NETWORK"` explicitly — keep that habit. A read without `--network` silently queries whatever network the command defaults to, and a funded account "looks empty" because you're asking the wrong chain.

### Derive the rest on-chain

```bash
# Backstop LP token (Comet BLND:USDC) — from the Backstop
LP_TOKEN=$(stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no -- backstop_token | tr -d '"')

# BLND and USDC token addresses — the Comet LP token lists its underlying tokens,
# returned in weight order: [BLND, USDC].
# (The Emitter exposes no BLND getter; derive BLND from the LP token.)
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" --send=no -- get_tokens

# Pool weights (e.g. confirm the 80/20 BLND:USDC split — returns "8000000" = 80%)
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" --send=no -- get_normalized_weight --token <BLND_ADDRESS>
```

## Prerequisites

- The [wallet skill](../../wallet/SKILL.md) set up: a funded key, a configured RPC/network, and a trustline to any classic asset you supply, repay, **or borrow/withdraw** (receiving from the pool also requires the trustline).
- A **BLND trustline before any emissions `claim`** — even the simulated preview reverts with `#13` (SAC `TrustlineMissingError`) without it. Derive BLND from the LP token (`backstop_token` → `get_tokens`, first entry), read its `CODE:ISSUER` with `name()`, then `stellar tx new change-trust --line <CODE:ISSUER>`.
- `stellar-cli` installed. Confirm a contract's real interface before invoking: `stellar contract info interface --id <contract>`.

### Getting the assets these flows assume

Blend flows assume a balance of a reserve asset (USDC, etc.) or of BLND/USDC for the backstop — but Friendbot funds only XLM, and issuer `mint` is gated. Starting from XLM you have two routes:

- **Borrow it**: supply XLM as collateral, then borrow the asset you need — see [lending.md](lending.md). (This is also the practical way to fund a backstop position from XLM.)
- **Swap for it on the DEX**: `stellar tx new path-payment-strict-receive` (or `-strict-send`) — see the [wallet skill](../../wallet/SKILL.md).

Two gotchas: XLM's SAC address comes from `stellar contract id asset --asset native` (`contract invoke --id native` does not work). And "USDC" is not one asset — testnet's two Blend pools use **two different USDC issuers**, one of which has no DEX liquidity. Read the token's `name()` (returns `CODE:ISSUER`) before assuming which one you hold or swap for.

## Reading Blend state over RPC

All reads are `contract invoke` on a getter — the CLI simulates the call and returns the decoded value, no indexer involved. **Pass `--send=no` on every read.** By default the CLI decides for itself whether to submit, and against TTL-archived ledger state a plain getter will skip simulation and **auto-submit a real RestoreFootprint transaction** — a signed, fee-paying write triggered by a "read" (abandoned pools and dead oracles are exactly where you hit this). A surprise `Account not found` error on a read is the symptom of archived state: stop and investigate; don't retry, because the retry is what submits the restore.

Note `--source-account` is still **required** to build the simulation (any funded key works); only `contract info interface` runs without one. Inspect the exact ABI first:

```bash
stellar contract info interface --id <POOL_OR_BACKSTOP_CONTRACT> --network "$NETWORK"
```

- **Pool state** (reserve list, reserve data, config, positions) → [lending.md](lending.md#reading-pool-state).
- **Backstop state** (pool balance, user balance, Q4W, emissions) → [backstop.md](backstop.md#reading-backstop-state).

## Building transactions

State-changing calls (`submit`, backstop `deposit`, etc.) go through `contract invoke ... --send=yes` signed by a wallet key. Token movements into the protocol (the asset you supply/repay) are ordinary SEP-41 / SAC transfers the contract pulls via authorization; the CLI collects and signs the required auth entries automatically during simulation.

Mechanics that surprise people:

- **`--send` is an invoke-only convention.** `stellar tx new …` operations (trustlines, path payments, account merges) take no `--send` flag and **submit by default**.
- **Soroban writes carry resource fees** — expect ~0.09 XLM per pool `submit`/`deposit` on top of the inclusion fee, deducted even though the examples don't mention a fee flag.
- **On `transaction submission timeout`**: public RPCs drop low-fee Soroban transactions under surge pricing. First verify the transaction didn't land (`stellar tx fetch result`, or check the account's sequence — see the wallet skill's [diagnose + safe-retry rules](../../wallet/accounts-and-tx.md)), then retry with a higher bid: `--inclusion-fee 1000000`. (`--fee` is deprecated; use `--inclusion-fee`.)

## Related skills

- Keys, signing, fees, submission, balances → [`../../wallet/SKILL.md`](../../wallet/SKILL.md)
- The DeFi index and other protocol playbooks → [`../SKILL.md`](../SKILL.md)
- Inspecting a contract's interface / SEP-41 tokens → [`../../smart-contracts/SKILL.md`](../../smart-contracts/SKILL.md)
- Reading chain data over RPC → [`../../data/SKILL.md`](../../data/SKILL.md)

## Documentation

- [Blend docs](https://docs.blend.capital)
- [blend-contracts-v2 (source of truth for the ABI)](https://github.com/blend-capital/blend-contracts-v2)
