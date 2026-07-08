# Blend DeFi Playbook Skill — Design

**Date:** 2026-07-08
**Issue:** [stellar/stellar-cli#2625](https://github.com/stellar/stellar-cli/issues/2625) — "DeFi skill: Blend playbook"
**Branch:** `feat/defi-blend-skill` (branched from `feat/wallet-skills-cli`)
**Epic:** Improve Agent UX for Wallets ([stellar-cli#2628](https://github.com/stellar/stellar-cli/issues/2628))

## Goal

Add a playbook skill that lets an AI agent interact with the **Blend** lending
protocol on Stellar/Soroban using existing CLI commands (`contract invoke`,
`stellar token`) composed with the wallet skill. The playbook bridges raw ledger
data and protocol architecture: an agent should be able to locate Blend pools,
read live pool/backstop state over RPC, and construct the core lending and
backstop transactions.

### Acceptance criteria (from the issue)

1. The playbook must let agents locate Blend pools and execute core
   lending/backstop transactions using `stellar token` / `contract invoke` +
   wallet skills.
2. All dynamic-data scripts must operate using **RPC calls only** — no indexer.

## Decisions

- **Structure:** Blend is its own package under a DeFi namespace. A thin
  `skills/defi/SKILL.md` index is added so the wallet skill's existing
  `../defi/SKILL.md` forward-link resolves and so future protocols have a home.
- **Verification:** Documented from architecture knowledge. Function signatures,
  the `RequestType` enum numbering, the Q4W timelock duration, and the emission
  split carry explicit `[VERIFY]` flags pointing at the `blend-contracts` /
  `blend-contracts-v2` source. Scripts are structurally correct RPC recipes to be
  confirmed against live contracts before signing a mainnet transaction.
- **Networks:** Mainnet and testnet get equal-weight treatment; addresses are
  tabled per network.

## File layout

```
skills/defi/
  SKILL.md            # DeFi index/router; wallet<->protocol boundary; links to blend/
  blend/
    SKILL.md          # Blend entry: architecture, contract refs, routing, deps, [VERIFY] notes
    lending.md        # supply / withdraw / borrow / repay; reading reserves & positions
    backstop.md       # deposit / Q4W / withdraw / claim; backstop APR + ranking script
```

## Contract references

Only three addresses per network are authoritative from the Stellar protocol
registry; everything else is derived on-chain (RPC-only, satisfying criterion 2).

| Role | Mainnet | Testnet (v2) |
|------|---------|--------------|
| Pool Factory | `CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB` | `CDV6RX4CGPCOKGTBFS52V3LMWQGZN3LCQTXF5RVPOOCG4XVMHXQ4NTF6` |
| Backstop | `CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3` | `CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA` |
| Emitter | `CBQHNAXSI55GX2GN6D67GK7BHVPSLJUGZQEU7WJ5LKR5PNUCGLIMAO4K` | `CC3WJVJINN4E3LPMNTWKK7LQZLYDQMZHZA7EZGXATPHHBPKNZRIO3KZ6` |

Derived on-chain (not hardcoded):
- **BLND token** — from the Emitter getter.
- **Backstop token** (Comet 80/20 BLND:USDC LP) — from `Backstop.backstop_token()`.
- **Oracle** — per-pool, from `PoolConfig.oracle`.
- **Individual pools** — enumerated from the Pool Factory.

## Component detail

### `skills/defi/SKILL.md` (index)
~15 lines. What DeFi skills cover, the wallet-primitives vs protocol-logic
boundary (mirrors the wallet skill's "Working with Soroban protocols" section),
and a link into `blend/`.

### `skills/defi/blend/SKILL.md` (entry)
- **Architecture:** pools, reserves (bToken/dToken accounting), backstop module,
  BLND emissions, emitter, oracle, pool factory.
- **Contract references:** the table above; derive-on-chain getters for the rest.
- **Routing:** lend/borrow → `lending.md`; earn on backstop → `backstop.md`.
- **Dependency notes:** `contract invoke` works today; `stellar token` (#2620)
  and structured output (#2622) are the ergonomic path once shipped; keys,
  signing, and submission defer to the wallet skill (`../../wallet/`).
- **Scope/`[VERIFY]` banner** stated prominently near the top.

### `skills/defi/blend/lending.md`
- Pool `submit(from, spender, to, requests)` model. `[VERIFY]` arg order.
- **RequestType table:** Supply 0, Withdraw 1, SupplyCollateral 2,
  WithdrawCollateral 3, Borrow 4, Repay 5, plus auction fill types. `[VERIFY]`
  against source; note V1/V2 numbering may differ.
- Worked `contract invoke` examples (both networks): supply-collateral, borrow,
  repay, withdraw; batching multiple `Request`s atomically.
- Reading reserve list / reserve data / pool config / user positions via RPC
  (`simulateTransaction` on read getters). Claiming lender emissions.

### `skills/defi/blend/backstop.md`
- `deposit`, `queue_withdrawal` (Q4W), `dequeue_withdrawal`, `withdraw`, `claim`.
- Q4W timelock mechanics and duration (`[VERIFY]` — 21 days believed; confirm
  `Q4W_LOCK_TIME`). Funds remain at risk while queued.
- **Dynamic-data scripts (embedded bash, RPC-only):**
  1. **List available pools** — enumerate factory-created pools from the Pool
     Factory.
  2. **Rank backstop opportunities** — per pool read backstop size +
     `bstop_rate` interest share + BLND emissions, compute an approximate
     backstop APR, rank. Assumptions/`[VERIFY]` inline.

## Site registration

- `site/src/data/skills.ts`: add `"DeFi"` to `FilterType` + `FILTERS`; add a
  `SKILL_CARD_SOURCES` entry pointing at `skills/defi/blend/SKILL.md`.
- `site/src/app/styles.scss`: add `DeFi` to the `@each` filter whitelist so the
  card renders when the filter is selected (same wiring the wallet card needed).

## Out of scope

- Live on-chain verification of signatures/enums (deferred by the
  document-from-knowledge decision; `[VERIFY]` flags mark what to confirm).
- Protocols other than Blend (the DeFi index is structured to add them later).
- Liquidation/auction bot logic beyond documenting the relevant RequestTypes.
