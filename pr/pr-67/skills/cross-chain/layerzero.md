# LayerZero V2 on Stellar — omnichain messaging and OFT

[LayerZero](https://docs.layerzero.network/v2/developers/stellar/overview) is an omnichain messaging protocol whose Stellar endpoint went live on mainnet in July 2026, connecting Stellar to 100+ chains. Its defining trait versus other rails: **security is per-application configurable** — each OApp chooses which DVNs (Decentralized Verifier Networks) must attest to its messages and which executor delivers them.

> **Status-sensitive.** This is the newest rail on Stellar. Resolve current addresses, DVN availability, and OFT maturity from LayerZero's [deployed contracts page](https://docs.layerzero.network/v2/deployments/deployed-contracts) (backed by `https://metadata.layerzero-api.com/v1/metadata/deployments`, which is the canonical machine-readable source) before building.

## Endpoint and addresses

| | Mainnet | Testnet |
|---|---|---|
| Endpoint ID (EID) | `30600` | `40600` |
| `EndpointV2` | `CCQLLRE5JBAWYCW3KTWOIWLMFDUOKROQVZNSALQMGOSXNW3ERUOWTZGK` | `CBQOTWFU4N4DWFWYIU7EY62DXNCZH5N3U3XHKQW326CGY4CI6GT6Q5AF` |

The full component set (ULN 302 message libraries, executor, price feed, treasury) resolves from the metadata API above. One Stellar-specific detail from that data: the send and receive ULN 302 libraries share a single contract address on Stellar.

**DVNs live on Stellar mainnet** (from the metadata API's active, non-deprecated entries): LayerZero Labs, Horizen, Nethermind, and Canary. Your OApp's security config selects which of these (and how many) must verify each message.

## OApp: the Soroban contract pattern

Source of truth: [LayerZero-Labs/monorepo-external](https://github.com/LayerZero-Labs/monorepo-external) — the protocol contracts (`contracts/protocol/stellar/`), the OApp packages (`apps/oapp-app/contracts/stellar/`), and the worked reference at `apps/project-types/omni-counter-app/contracts/stellar/`. The skeleton below is compile-verified: a minimal OApp of exactly this shape builds to `wasm32v1-none` against the monorepo crates with the full receive surface exported.

```rust
use common_macros::{contract_impl, lz_contract};
use endpoint_v2::{MessagingFee, Origin};
use oapp::{
    oapp_core::{init_ownable_oapp, OAppCore},
    oapp_receiver::{LzReceiveInternal, OAppReceiver},
    oapp_sender::{FeePayer, OAppSenderInternal},
};
use oapp_macros::oapp;
use soroban_sdk::{Address, Bytes, BytesN, Env};

#[lz_contract]
#[oapp]
pub struct MyOApp;

#[contract_impl]
impl MyOApp {
    pub fn __constructor(env: &Env, owner: &Address, endpoint: &Address, delegate: &Address) {
        init_ownable_oapp::<Self>(env, owner, endpoint, delegate);
    }

    // Fee estimation: always quote before sending.
    pub fn quote(env: &Env, dst_eid: u32, message: &Bytes, options: &Bytes, pay_in_zro: bool) -> MessagingFee {
        Self::__quote(env, dst_eid, message, options, pay_in_zro)
    }

    pub fn send(env: &Env, caller: &Address, dst_eid: u32, message: &Bytes, options: &Bytes, fee: &MessagingFee) {
        caller.require_auth();
        // FeePayer::Verified marks the caller as already authorized, so the
        // send path doesn't trigger a second require_auth in Soroban's auth tree.
        Self::__lz_send(env, dst_eid, message, options, &FeePayer::Verified(caller.clone()), fee, caller);
    }
}

impl LzReceiveInternal for MyOApp {
    fn __lz_receive(
        env: &Env,
        origin: &Origin,          // src_eid, sender (bytes32), nonce
        guid: &BytesN<32>,
        message: &Bytes,
        _extra_data: &Bytes,
        _executor: &Address,
        value: i128,
    ) {
        // Your logic. The generated lz_receive has already validated the peer
        // and cleared the payload on the endpoint before this runs.
    }
}
```

The shape rhymes with Axelar's derive pattern, and the same division of labor applies:

- The `#[oapp]` macro generates the public surface (`OAppCore`, sender internals, the `lz_receive` entrypoint, options handling). The generated `lz_receive` does peer validation and `endpoint.clear()` **before** dispatching to your `__lz_receive` — don't reimplement either.
- **`custom = [receiver]` is a footgun.** Passing `#[oapp(custom = [receiver])]` tells the macro to *skip* generating the receiver surface; unless you then supply your own `#[contract_impl(contracttrait)] impl OAppReceiver` (as the counter example does, to customize `next_nonce`), the contract **compiles cleanly but exports no `lz_receive` at all** — an OApp that silently cannot receive. Use plain `#[oapp]` unless you're deliberately taking that surface over. (Compile-verified both ways by inspecting the wasm exports.)
- **Peers must be set on both sides.** `set_peer(&dst_eid, &Some(remote_oapp_bytes32), &caller)` on Stellar, and the mirror call on the destination OApp. A message from an unset peer never reaches `__lz_receive`.
- **Fees are quoted, then paid in the chain's native token** (XLM on Stellar — the endpoint exposes `native_token()`). Quote with `__quote` into a `MessagingFee` and pass it to `__lz_send`; underquoting fails the send.
- **Auth is Soroban-native.** `require_auth()` replaces EVM's `msg.sender` checks throughout, and `FeePayer::{Verified, Unverified}` exists specifically to avoid double-auth in the auth tree.
- The counter example additionally shows **ordered-nonce enforcement** (`origin.nonce` bookkeeping plus the endpoint's `skip`), **composed messages** (`send_compose` for A→B→C flows), and an **ABA round-trip** (receive triggers a send back) — read it before designing anything stateful.

## OFT: omnichain tokens

OFT (Omnichain Fungible Token) — LayerZero's token standard, the analogue of Axelar's ITS — is supported on Stellar; the contracts live at `apps/oft-app/contracts/stellar/` in the monorepo. Work from the [Stellar OFT docs](https://docs.layerzero.network/v2/developers/stellar/oft/overview) for deployment and wiring; the same peer-both-sides and quote-then-send rules apply.

## Verifying messages

[LayerZero Scan](https://layerzeroscan.com) tracks every message end to end (source tx → DVN verification → destination delivery) on both networks — the equivalent of polling Iris in the CCTP flow. Real Stellar mainnet traffic is visible there today.

## Choosing between Axelar GMP and LayerZero OApp

Both move arbitrary payloads between Stellar contracts and other chains; neither is strictly better.

- **Security model**: Axelar messages are verified by its proof-of-stake validator network — one shared model for everyone. LayerZero lets each application pick its own DVN set — more control, and more responsibility (a weak DVN config is your problem).
- **Token standard**: existing Stellar assets connect via Axelar's canonical ITS registration; OFT is deploy-oriented. New multichain tokens work well in either.
- **Track record on Stellar**: Axelar's Stellar contracts have been live longer; LayerZero's endpoint is new as of July 2026. Coverage differs too — check each protocol's chain list for the chains you actually need.
- **Ecosystem gravity**: if your team already runs OApps or ITS integrations elsewhere, staying on that stack usually beats mixing rails.
