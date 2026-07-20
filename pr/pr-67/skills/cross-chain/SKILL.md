---
name: cross-chain
description: Cross-chain interoperability for Stellar. Entry point with a rail-selection decision table and shared pitfalls, routing to three companion files — cctp.md (Circle CCTP V2, native USDC burn-and-mint between Stellar and EVM/Solana chains, domain 27, the CctpForwarder requirement for Stellar recipients), axelar.md (Axelar GMP for Soroban contracts calling contracts on other chains, and the Interchain Token Service for multichain tokens), and layerzero.md (LayerZero V2 OApp messaging with configurable DVN security, and OFT omnichain tokens). Also covers NEAR Intents (intent-based cross-chain swaps into XLM or Stellar USDC) at the routing level. Use when bridging USDC to or from Stellar, sending messages between a Stellar contract and another blockchain, making a token exist on multiple chains, or adding cross-chain swaps to an app.
user-invocable: true
argument-hint: "[cross-chain task]"
---

# Cross-Chain on Stellar

Stellar connects to other blockchains over several production rails, each built for a different job. Picking the wrong rail wastes engineering effort; picking the right one is a routing decision, not a research project. This file routes; the deep dives live alongside it — **read the file that matches the task**:

| You want to | Use | Where |
|---|---|---|
| Move **native USDC** between Stellar and an EVM chain or Solana (no wrapped assets, no liquidity pools) | Circle CCTP V2 | [cctp.md](cctp.md) |
| Have a Stellar contract **call a contract on another chain**, or receive calls from one (arbitrary payloads) | Axelar GMP or LayerZero OApp | [axelar.md](axelar.md), [layerzero.md](layerzero.md) |
| Make a token — new or an existing Stellar asset — **exist on multiple chains** | Axelar ITS or LayerZero OFT | [axelar.md](axelar.md), [layerzero.md](layerzero.md) |
| **Swap any asset cross-chain** (BTC, ETH, SOL, … → XLM or Stellar USDC) without integrating a bridge yourself | NEAR Intents | [below](#near-intents-intent-based-swaps) |

Rules of thumb: if the asset is USDC and both ends are CCTP chains, CCTP is the cheapest and most direct (it burns and mints Circle-native USDC — nothing wrapped, nothing pooled). If you need logic, not just value, on the far chain, that is message passing — two rails do it, and the [comparison at the end of layerzero.md](layerzero.md#choosing-between-axelar-gmp-and-layerzero-oapp) helps you pick between Axelar's shared validator security and LayerZero's app-configured DVN sets. If you control a token and want it multichain, that is ITS or OFT on the same split. If the user just wants "turn my X on chain A into Y on Stellar" and you don't want bridge plumbing at all, quote it through NEAR Intents.

## When to use this skill

- Bridging USDC between Stellar and Ethereum, Base, Arbitrum, Solana, or another CCTP-supported chain
- Receiving bridged USDC into a Stellar account or contract (and not bricking the funds — see the forwarder warning below)
- Writing a Soroban contract that sends messages to or receives messages from contracts on other chains
- Deploying an interchain token, or connecting an existing Stellar asset to other ecosystems
- Adding a "deposit from any chain" or cross-chain swap flow to a wallet or dapp

## Related skills

- Trustlines, SAC deployment, asset anatomy → `../assets/SKILL.md`
- Writing the Soroban contracts that send/receive messages → `../smart-contracts/SKILL.md`
- Frontend transaction building, Freighter signing, RPC submission → `../dapp/SKILL.md`
- Watching for the destination-side mint or contract events → `../data/SKILL.md`
- Paying AI agents (x402/MPP) rather than bridging → `../agentic-payments/SKILL.md`

## Pitfalls shared by every rail

These bite regardless of which rail you pick. Each companion file adds rail-specific ones.

1. **Address formats do not translate.** Stellar addresses are `strkey` strings (`G…` accounts, `C…` contracts, `M…` muxed); EVM uses 20-byte hex; Solana uses base58. Every rail defines its own encoding for foreign addresses (CCTP: raw 32-byte payloads; Axelar: strings + bytes payloads). Never paste an address from one chain into a field meant for another — encode it the way the rail specifies, and validate with the SDK (`StrKey.isValidEd25519PublicKey` / `isValidContract`) before encoding.
2. **Decimals differ.** Classic Stellar assets and their SACs use 7 decimals, but other Soroban token contracts (ITS-deployed tokens included) declare their own — call `decimals()` instead of assuming. USDC is 6 on EVM chains and Solana; EVM tokens are commonly 18; CCTP messages are always 6-decimal. Convert at every boundary and test with amounts that exercise the last digit (see the worked decimal examples in [cctp.md](cctp.md#usdc-precision-7-decimals-vs-6)).
3. **Classic Stellar recipients need a trustline first.** A `G…` account cannot receive an issued asset (USDC included) without a trustline to that asset. Bridged funds destined for an account without one will not land. Check and provision before starting the transfer — see `../assets/SKILL.md`.
4. **Cross-chain is asynchronous.** Every rail has a wait: CCTP waits for finality plus Circle's attestation (seconds to ~15 minutes depending on chain and finality threshold), Axelar waits for validator confirmation, intents wait for a market maker. Build UIs and agents around polling a status, never around "submit and assume".
5. **Testnet first, always.** Every rail here has a testnet deployment. Do the full round-trip on testnet before touching mainnet — cross-chain mistakes are frequently unrecoverable by design (burns are final, and some misencodings permanently strand funds).

## NEAR Intents (intent-based swaps)

> **Status-sensitive.** Chain and asset support changes frequently — verify Stellar's current status in the [NEAR Intents docs](https://docs.near-intents.org/) before building.

[NEAR Intents](https://docs.near-intents.org/) is an intent protocol: the user states an outcome ("swap 0.1 BTC to USDC on Stellar"), market makers compete to execute it. Stellar (XLM and USDC) is a supported destination and source, which makes this the shortest path to "deposit from any chain" UX — there is no bridge contract to integrate on the Stellar side at all.

Integration is the [1Click API](https://docs.near-intents.org/near-intents/integration/distribution-channels/1click-api): `POST /quote` with the asset pair returns a price and a **deposit address**; send funds there and market makers carry out the swap. Official SDKs exist for TypeScript, Go, and Rust.

Two Stellar-specific facts:

- **Stellar deposits are MEMO mode only.** Most chains support a plain deposit address; on Stellar the quote returns a deposit address **plus a memo**, and the memo is what routes your funds to your swap. A deposit without the memo is not credited — treat the memo as part of the address, and refuse to display one without the other.
- Registering for an API key via the partners portal removes the default integrator fee; anonymous use works but is surcharged.

For anything deeper (quote parameters, slippage, refund handling), work from the live 1Click API docs rather than this file — the protocol iterates quickly.
