---
name: defi
description: Interact with Stellar/Soroban DeFi protocols from the CLI: discover pools and markets, read live protocol state over RPC, and compose the transactions that act on them (lend, borrow, provide backstop/liquidity). Per-protocol playbooks map each protocol's operations to concrete `contract invoke` / `stellar token` calls. Use when acting on a Soroban DeFi protocol rather than moving value between accounts.
user-invocable: true
argument-hint: "[defi task]"
---

# DeFi: acting on Soroban protocols

The [wallet skill](../wallet/SKILL.md) covers wallet **primitives** — moving value, trustlines, transaction mechanics. It deliberately does *not* teach how any specific Soroban protocol works.

These DeFi playbooks pick up where the wallet skill stops. Each one maps a protocol's operations to concrete `contract invoke` / `stellar token` calls, carries the current contract references, and shows how to read the protocol's live state over RPC — so you act on the protocol instead of reverse-engineering it from raw ledger data.

The division of labor is constant:

- **This skill** — what the protocol is, which contract/function each operation maps to, and how to read its state.
- **The wallet skill** — keys, signing, fees, submission, and reading account/token balances. Every transaction here is signed and submitted with the wallet pipeline.

## Playbooks

| Protocol | What it is | Playbook |
|----------|------------|----------|
| Blend | Permissionless lending pools + a backstop insurance module | [blend/SKILL.md](blend/SKILL.md) |


## Related skills

- Keys, signing, fees, submission, balances → [`../wallet/SKILL.md`](../wallet/SKILL.md)
- SEP-41 tokens and SACs these protocols call → [`../smart-contracts/SKILL.md`](../smart-contracts/SKILL.md)
- Reading chain data over RPC → [`../data/SKILL.md`](../data/SKILL.md)
- Classic assets and trustlines → [`../assets/SKILL.md`](../assets/SKILL.md)
