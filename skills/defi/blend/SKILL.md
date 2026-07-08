---
name: blend
description: Blend lending protocol playbook for the Stellar CLI. Covers Blend's architecture (permissionless pools, reserves, the backstop insurance module, BLND emissions), the mainnet/testnet contract references, how to discover pools and read live pool/backstop state over RPC, and how to build the core lending and backstop transactions with `contract invoke` + `stellar token`. Use when supplying, borrowing, repaying, withdrawing, or providing backstop capital on Blend from the command line.
user-invocable: true
argument-hint: "[blend task]"
---

# Blend: lending & backstop playbook

Blend is a permissionless, over-collateralized lending protocol on Soroban. Anyone can create an isolated lending **pool**; each pool holds one or more **reserves** (assets you can supply and borrow) and is insured by a **backstop** of first-loss capital that earns a share of interest plus BLND emissions.

This playbook maps each Blend operation to the `contract invoke` (or `stellar token`) call that performs it, and shows how to read live pool/backstop state over RPC. Keys, signing, fees, and submission are handled by the [wallet skill](../../wallet/SKILL.md) — every transaction below is signed and submitted with that pipeline.

> **Scope and verification.** This playbook is written from Blend's contract architecture, not regenerated from live contract metadata. Items marked **`[VERIFY]`** — function signatures, the `RequestType` numbering, the Q4W timelock, and the emission split — should be confirmed against the [`blend-contracts`](https://github.com/blend-capital/blend-contracts) / [`blend-contracts-v2`](https://github.com/blend-capital/blend-contracts-v2) source (or by simulating the call) before you sign a mainnet transaction. Confirm the deployed interface with `stellar contract info interface --id <contract>` — see [reading state](#reading-blend-state-over-rpc). Mainnet and testnet run different contract versions; the ABI can differ.

## Read the file that matches the task

| Task | File |
|------|------|
| Supply, borrow, repay, withdraw; read reserves, positions, pool config; claim lender emissions | [lending.md](lending.md) |
| Deposit to a backstop, queue/withdraw (Q4W), claim backstop emissions; find the most profitable backstop | [backstop.md](backstop.md) |

## Architecture

| Entity | What it is |
|--------|------------|
| **Pool** | One isolated lending market. Holds all reserves, user positions, and interest accounting. You interact with a pool almost entirely through its `submit` entrypoint. Each pool references one oracle and one backstop. |
| **Reserve** | A single asset within a pool. Supply is tracked as **bTokens** (supply/collateral shares), debt as **dTokens** (liability shares); their value grows via `b_rate` / `d_rate` indexes. These are internal accounting units, not transferable SEP-41 tokens. |
| **Pool Factory** | Deploys pools deterministically and records which pool addresses it created. The backstop trusts only factory-deployed pools. Enumerate pools from here — see [discovering pools](lending.md#discovering-pools). |
| **Backstop** | Holds first-loss capital per pool, denominated in the **backstop token** — a Comet (Balancer-style) 80/20 BLND:USDC LP token `[VERIFY weights]`. Backstop depositors absorb bad debt in exchange for a share of interest + BLND emissions. See [backstop.md](backstop.md). |
| **Emitter** | Streams BLND emissions to the backstop, distributed to pools in the reward zone. |
| **Oracle** | A SEP-40-style price oracle the pool reads for asset prices. Address is per-pool (`PoolConfig.oracle`); read it, don't assume it. |

## Contract references

Only these three addresses per network are treated as fixed literals. **Everything else is derived on-chain** (RPC only, no indexer): the BLND token, the backstop LP token, each pool's oracle, and the pools themselves.

| Role | Mainnet | Testnet |
|------|---------|---------|
| Pool Factory | `CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB` | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` |
| Backstop | `CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3` | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` |
| Emitter | `CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K` | `CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6` |

`[VERIFY]` The testnet deployment is Blend v2; the mainnet addresses above carry no version label in the registry — confirm the deployed version against Blend's published deployment before assuming v1 vs v2 semantics (the `RequestType` numbering and `submit` shape can differ between versions).

### Derive the rest on-chain

```bash
# Set once. Blend runs on both networks; pick one.
POOL_FACTORY=CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB
BACKSTOP=CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3
EMITTER=CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K
NETWORK=mainnet

# BLND token address — from the Emitter  [VERIFY getter name: get_blnd_token / blnd_id]
stellar contract invoke --id "$EMITTER" --network "$NETWORK" -- get_blnd_token

# Backstop LP token (Comet BLND:USDC) — from the Backstop  [VERIFY getter name]
stellar contract invoke --id "$BACKSTOP" --network "$NETWORK" -- backstop_token
```

## Prerequisites

- The [wallet skill](../../wallet/SKILL.md) set up: a funded key, a configured RPC/network, and (for supply/repay) a trustline to any classic asset you deposit.
- `stellar-cli` installed. Confirm a contract's real interface before invoking: `stellar contract info interface --id <contract>`.

## Reading Blend state over RPC

All reads are `contract invoke` on a getter. The CLI simulates read-only calls and returns the decoded value — no source key or signing required, no indexer involved. Inspect the exact ABI first:

```bash
stellar contract info interface --id <POOL_OR_BACKSTOP_CONTRACT> --network "$NETWORK"
```

- **Pool state** (reserve list, reserve data, config, positions) → [lending.md](lending.md#reading-pool-state).
- **Backstop state** (pool balance, user balance, Q4W, emissions) → [backstop.md](backstop.md#reading-backstop-state).

## Building transactions

State-changing calls (`submit`, backstop `deposit`, etc.) go through `contract invoke ... --send=yes` signed by a wallet key. Token movements into the protocol (the asset you supply/repay) are ordinary SEP-41 / SAC transfers the contract pulls via authorization; the CLI collects and signs the required auth entries automatically during simulation.

- `contract invoke` — available today; the baseline for every Blend call.
- `stellar token` ([stellar-cli#2620](https://github.com/stellar/stellar-cli/issues/2620)) — the typed SEP-41/SAC client used for reading balances and moving the underlying assets; some examples note the `stellar token` form as the ergonomic path once shipped.
- Structured `{status, result, error}` output ([stellar-cli#2622](https://github.com/stellar/stellar-cli/issues/2622)) — the branchable receipt these examples read from once available.

## Dependency notes

This playbook is part of the Improve Agent UX for Wallets epic ([stellar-cli#2628](https://github.com/stellar/stellar-cli/issues/2628)) and composes with the wallet skill. Where a command relies on in-flight CLI surface (`stellar token`, structured output), it is noted inline; the underlying `contract invoke` path works today.

## Related skills

- Keys, signing, fees, submission, balances → [`../../wallet/SKILL.md`](../../wallet/SKILL.md)
- The DeFi index and other protocol playbooks → [`../SKILL.md`](../SKILL.md)
- Inspecting a contract's interface / SEP-41 tokens → [`../../smart-contracts/SKILL.md`](../../smart-contracts/SKILL.md)
- Reading chain data over RPC → [`../../data/SKILL.md`](../../data/SKILL.md)

## Documentation

- [Blend docs](https://docs.blend.capital)
- [blend-contracts (source of truth for the ABI)](https://github.com/blend-capital/blend-contracts)
- [DeFi skill: Blend playbook (issue #2625)](https://github.com/stellar/stellar-cli/issues/2625)
