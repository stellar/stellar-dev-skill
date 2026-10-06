---
name: standards
description: Stellar standards, ecosystem, and reference. Covers SEPs (Stellar Ecosystem Proposals), CAPs (Core Advancement Proposals), and a quick map for picking the right standard for wallets, anchors, payments, deposits/withdrawals, federation, deep links, and KYC. Also bundles ecosystem references (DeFi protocols, dev tools, wallets, infra, community projects), curated documentation links, and MCP servers (live tools such as Raven). Use when you need to know which SEP applies, or want a starting point for ecosystem integrations, official docs, or live MCP tooling.
user-invocable: true
argument-hint: "[standards or ecosystem lookup]"
---

# Standards, Ecosystem, and Resources

Three things bundled because they're all reference material you reach for in the same moment: "which standard handles X?", "is there an existing project doing Y?", and "where's the canonical doc for Z?".

This file carries the SEP/CAP standards routing map. The other two live alongside it — **read the file that matches the task**:

| Task | File |
|------|------|
| Pick the right SEP/CAP, check standard status, map a use case to standards docs | this file |
| Find DeFi protocols, wallets, dev tools, indexers, oracles, bridges, builder teams, funding programs | [ecosystem.md](ecosystem.md) |
| Locate official docs, SDKs, CLI tools, testing guides, RPC providers, learning resources, community links | [resources.md](resources.md) |

## When to use this skill
- Picking the right SEP for an integration (anchors, deposits, federation, deep links, KYC, paths)
- Checking CAP status for a protocol feature you want to rely on
- Finding existing DeFi protocols, wallets, or infrastructure to integrate with rather than rebuild
- Locating official docs, SDKs, or community resources

## Related skills
- Implementing a SEP-41 token interface → `../assets/SKILL.md`, `../smart-contracts/SKILL.md`
- Frontend SEP-7 / SEP-10 flows → `../dapp/SKILL.md`
- CAPs for cryptography (BLS, BN254, Poseidon) → `../zk-proofs/SKILL.md`
- x402/MPP protocol context → `../agentic-payments/SKILL.md`

---

# SEP / CAP Standards Reference


## When to use this guide
Use this when you need:
- The right SEP/CAP for a feature or integration
- Interoperability guidance for wallets, anchors, and contracts
- A fast map from use case to official standards docs

## Maintenance note
Standards status can change quickly.
Before implementation, verify current status in:
- SEPs: [stellar-protocol/ecosystem](https://github.com/stellar/stellar-protocol/tree/master/ecosystem)
- CAPs: [stellar-protocol/core](https://github.com/stellar/stellar-protocol/tree/master/core)

Treat this file as a routing map, not a source of final governance/status truth.

## High-value SEPs for app developers

### Contracts and token interfaces
- [SEP-0041](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0041.md): Soroban token interface
- [SEP-0046](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md): Contract metadata in Wasm
- [SEP-0048](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md): Contract interface specification
- [SEP-0049](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0049.md): Upgradeable-contract guidance
- [SEP-0050](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md): NFT standard work
- [SEP-0055](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0055.md): Contract build verification
- [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md): Vault-style tokenized products
- [SEP-0057](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0057.md): Regulated token patterns (T-REX)

### Auth, identity, and metadata
- [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md): Web authentication
- [SEP-0023](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0023.md): StrKey encoding
- [SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md): `stellar.toml`

### Anchor and fiat integration
- [SEP-0006](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0006.md): Programmatic deposit/withdrawal API
- [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md): Hosted interactive anchor flow
- [SEP-0031](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md): Cross-border payment flow
- [SEP-0012](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0012.md): KYC data exchange

## High-value CAPs for smart contract developers

### Smart contract foundations
- [CAP-0046](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0046.md): Soroban overview
- CAP-0046 subdocuments (`cap-0046-*.md`): runtime, lifecycle, host functions, storage, auth, metering

### Frequently used contract capabilities
- [CAP-0051](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0051.md): secp256r1 verification (passkey-related cryptography)
- [CAP-0053](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0053.md): TTL extension behavior
- [CAP-0058](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0058.md): constructors (`__constructor`)
- [CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md): BLS12-381 primitives
- [CAP-0067](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0067.md): protocol/runtime improvements including asset/event model changes

### Newer and draft crypto/features
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md): BN254 host functions (G1 add/mul, pairing check) — Final, Protocol 25+
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md): Poseidon/Poseidon2 permutation primitives — Final, Protocol 25+
- [CAP-0079](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0079.md): muxed-address strkey conversion proposal
- [CAP-0080](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0080.md): BN254 G1 MSM, Fr arithmetic, on-curve checks — Implemented, Protocol 26+

Use the CAP preamble status fields as the source of truth for implementation readiness.

## Quick mapping by use case

### I am building a fungible token
1. Start with SEP-0041 interface expectations.
2. Prefer Stellar Assets + SAC interop unless custom logic is required.
3. If regulated, review SEP-0057 patterns.

### I need upgrade-safe contracts
1. Read SEP-0049 guidance for upgrade process design.
2. Use CAP-0058 constructors for atomic initialization where protocol support exists.
3. Add migration/versioning strategy before deploying upgradeable contracts.

### I am building a smart-wallet flow
1. Use SEP-0010 for web authentication flows.
2. Review CAP-0051 for passkey-related cryptographic primitives.
3. Align wallet UX and signing payloads with current SDK guidance.

### I need anchor integration for fiat rails
1. SEP-0006 for API-first flows.
2. SEP-0024 for hosted interactive rails.
3. SEP-0031 when supporting payment corridors.
4. SEP-0012 for KYC data requirements.

## Practical workflow for AI agents
- Step 1: Identify feature category (token, wallet auth, anchor, upgradeability).
- Step 2: Link user to the 1-3 primary SEP/CAP docs.
- Step 3: Check status/acceptance in the source repo before asserting support.
- Step 4: Implement only what is active on the target network/protocol.
- Step 5: Document dependencies on draft standards explicitly.

## Related docs
- Contract implementation details: [`../smart-contracts/SKILL.md`](../smart-contracts/SKILL.md)
- Advanced architecture guidance: [`../smart-contracts/development.md`](../smart-contracts/development.md)
- RPC and data access: [`../data/SKILL.md`](../data/SKILL.md)
- Security considerations: [`../smart-contracts/security.md`](../smart-contracts/security.md)
