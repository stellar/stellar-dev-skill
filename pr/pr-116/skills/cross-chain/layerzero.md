# LayerZero V2 on Stellar — omnichain messaging, OFT, and USDT0

[LayerZero](https://docs.layerzero.network/v2/developers/stellar/overview) is an omnichain messaging protocol whose Stellar endpoint went live on mainnet in July 2026, connecting Stellar to 100+ chains. Its defining trait versus other rails: **security is per-application configurable** — each OApp chooses which DVNs (Decentralized Verifier Networks) must attest to its messages and which executor delivers them.

The rail carries production traffic today: **USDT0**, Tether's USDT delivered as a LayerZero OFT, is the first production OFT on Stellar's endpoint. If the task is "bridge USDT to or from Stellar", jump to [USDT0](#usdt0-native-usdt-on-stellar) — it is the whole answer.

> **Status-sensitive.** This is the newest rail on Stellar, and its addresses have already moved once (the testnet endpoint was redeployed during August 2026). Resolve current addresses, DVN availability, and pathway support from LayerZero's [deployed contracts page](https://docs.layerzero.network/v2/deployments/deployed-contracts) — backed by `https://metadata.layerzero-api.com/v1/metadata/deployments`, the canonical machine-readable source — before building.

## Endpoint and addresses

Verified against the LayerZero metadata API on 2026-08-27.

| | Mainnet | Testnet |
|---|---|---|
| Endpoint ID (EID) | `30600` | `40600` |
| `EndpointV2` | `CCQLLRE5JBAWYCW3KTWOIWLMFDUOKROQVZNSALQMGOSXNW3ERUOWTZGK` | `CALTBA5S6GRJEHAXFP45LGGLKWWAF7HTZCPNUBUJF2HWWRRLQNV35AIV` |
| `SendUln302` / `ReceiveUln302` | `CCV4HEII3UC65THWGSRM2DVIJLB6HS6YMUHDTTHUECX2RHTP5FA2GOBA` | `CCMLPCAWCPIIMXOHJJKU3NZLOFTT2O6QTB2UUFPN6SEHLK35QRHVKKMB` |
| `Executor` | `CCEGV7LM6X736RQBPUD4F34HBUUR7OANXLPYUEDQWTPTYX36KSPSAJYM` | `CCAVZ7ESAV3PDJ6PISRCXVZCXFFH4NGI7K7MVMZZDR33LC5AD3UPZATT` |
| `ExecutorHelper` | `CB54JXWG3X77YFAFLYQMRUIMLAEP6XUBBWVQLQYVK2CEOA6PGNQUDRAO` | `CANJCMHRRXEBM46675TSPJIFUVPW7PDOCBLMWS7QPO5TCBHBL7JC4CDL` |

Two Stellar-specific details in that data: the send and receive ULN 302 libraries **share a single contract address** on Stellar (one contract, both roles), and the remaining components — `Treasury`, `PriceFeed`, `BlockedMessageLib`, `DvnFeeLib`, `ExecutorFeeLib` — resolve from the same metadata entry rather than being hardcoded here.

**DVNs live on Stellar mainnet** (active, non-deprecated entries): LayerZero Labs, Horizen, Nethermind, Canary, and USDT0. Your OApp's security config selects which of these, and how many, must verify each message. Stellar DVN identifiers in the metadata are 32-byte hex values, not `C…` strkeys — don't try to parse one as an address.

## USDT0: native USDT on Stellar

USDT0 is USDT moved by burn-and-mint over LayerZero's OFT standard. There is no wrapped token and no pool: the OFT burns on the source chain and mints on the destination. On Stellar it is a **classic asset** with a locked issuer whose SAC admin is a contract.

| Surface | Address |
|---|---|
| Classic asset | `USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q` |
| SAC (the OFT's `token()`) | `CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF` |
| OFT | `CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6` |
| SAC manager (mint/burn adapter, and the SAC's admin) | `CA3GUWLOS3QKN6WNRAELSUDSKLDTVTWEDJ3KLGAJG3SIWGA5L3KZYWGJ` |
| OneSig (owns the SAC manager) | `CBCZ5CETG3XR5MZVDC7QBDOTIH6P7MOLUH2SSC52J3NVBYIV45D4QKR6` |

Addresses per [USDT0's deployments page](https://docs.usdt0.to/technical-documentation/deployments), which lists the token, OFT, and OneSig. The SAC matches Horizon's own derivation for the asset, and the SAC manager is the contract the OFT mints through — confirmed from a live inbound transfer on mainnet. USDT0 is part of Everdawn Labs Limited.

### The rules that save funds

1. **The recipient needs a USDT0 trustline before anything inbound lands.** A `G…` account cannot hold an issued asset without one. This is the single most common inbound failure.
2. **Pin the code *and* the issuer.** `USDT0` is a 5-character code (`credit_alphanum12`), and asset code alone identifies nothing. Verify the SAC by derivation — `stellar contract id asset --asset USDT0:GATISXX6… --network mainnet` must return `CBSJZEIO…`.
3. **There is no `stellar.toml`.** The issuer publishes no `home_domain`, so every check keyed on `home_domain` or a SEP-1 `[[CURRENCIES]]` entry fails on a legitimate, live asset. Validate by issuer plus SAC derivation instead. See `../assets/SKILL.md` for the full pre-listing recipe.
4. **Dust below 6 decimals is dropped on send** — see below.

### Decimals: 7 local, 6 shared

The SAC uses Stellar's 7 decimals. The OFT's `shared_decimals()` is **6**, the precision USDT0 uses on every chain. `decimal_conversion_rate()` is therefore `10 ^ (7 - 6)` = **10**, and the OFT removes any remainder before it builds the message:

- Send `1.0000001` USDT0 (`amount_ld` = `10000001`): `amount_sent_ld` is `10000000` and the trailing `0.0000001` **stays in your account**. It is not lost, but it is not sent either.
- Quote first and compare. `quote_oft` returns an `OFTReceipt` whose `amount_sent_ld` and `amount_received_ld` are already dust-adjusted — treat those, not your input, as the truth.
- Never derive one side from the other with floats, and test with amounts that exercise the seventh digit.

### Inbound: EVM → Stellar

1. The recipient's trustline must exist first (rule 1 above).
2. Send on the source chain against USDT0's OFT there, with Stellar's EID `30600` and the recipient encoded as a 32-byte value.
3. LayerZero's DVNs verify, then the executor delivers. On Stellar the delivery lands as `ExecutorHelper.execute`, which sub-invokes `lz_receive` on the OFT; the OFT credits through the SAC manager (it holds `MINTER_ROLE`), which mints on the SAC.

Nothing on the Stellar side needs to be signed by the recipient. Watch for the `oft_received` event on the OFT — its topics are `["oft_received", guid, src_eid, to]` and its data carries `amount_received_ld`.

### Outbound: Stellar → EVM

The OFT exposes the standard OFT surface. Verified signatures (LayerZero's Stellar OFT crates, and the live mainnet `send` invocation):

```rust
// oft-core types
pub struct SendParam {
    pub dst_eid: u32,        // destination endpoint id, e.g. 30101 Ethereum
    pub to: BytesN<32>,      // EVM address left-padded to 32 bytes
    pub amount_ld: i128,     // 7-decimal Stellar subunits
    pub min_amount_ld: i128, // slippage floor, also 7-decimal
    pub extra_options: Bytes,
    pub compose_msg: Bytes,  // empty unless composing
    pub oft_cmd: Bytes,      // empty for a plain transfer
}
pub struct OFTLimit   { pub min_amount_ld: i128, pub max_amount_ld: i128 }
pub struct OFTReceipt { pub amount_sent_ld: i128, pub amount_received_ld: i128 }

// The three calls, in order
fn quote_oft(env, from: &Address, send_param: &SendParam)
    -> (OFTLimit, Vec<OFTFeeDetail>, OFTReceipt);
fn quote_send(env, from: &Address, send_param: &SendParam, pay_in_zro: bool)
    -> MessagingFee;                       // { native_fee: i128, zro_fee: i128 }
fn send(env, from: &Address, send_param: &SendParam, fee: &MessagingFee,
        refund_address: &Address) -> (MessagingReceipt, OFTReceipt);
```

Order matters: `quote_oft` tells you what will actually arrive, `quote_send` prices the message, `send` executes it. Both quotes are read-only — simulate them before you ask a user to sign anything:

```bash
# Read-only. --send=no simulates and never signs or submits.
stellar contract invoke --id CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6 \
  --source-account alice --network mainnet --send=no \
  -- quote_send --from <G_SENDER> --pay_in_zro false \
     --send_param '{"dst_eid":30101,"to":"<32-byte hex>","amount_ld":"10000000","min_amount_ld":"9950000","extra_options":"","compose_msg":"","oft_cmd":""}'
```

**Fees are paid in XLM.** `quote_send` returns a `MessagingFee`; `native_fee` is XLM in stroops, and `send` transfers it to the endpoint through the native SAC. The fee tracks the destination route, the DVN set, and executor pricing, so quote every send and never reuse a number from a previous one. `refund_address` receives any excess.

One transaction does the whole outbound leg: `send` burns on the SAC and pays the fee inside a single auth tree, so the sender signs once.

### State you must read live, never hardcode

Peers, pause state, fee basis points, and rate limits are configuration. They change without notice, and a stale copy in a prompt is a failed transfer.

| Question | Call |
|---|---|
| Is this pathway wired up? | `peer(eid)` → `Option<BytesN<32>>`; `None` means no route |
| Is the OFT halted? | `is_paused()` |
| Is a fee charged on this route? | `default_fee_bps()`, `fee_bps(dst_eid)`, `effective_fee_bps(dst_eid)` |
| Will my amount fit the throttle? | `rate_limit_config(direction, eid)`, `rate_limit_capacity(direction, eid)` — `direction` is `Inbound` or `Outbound` |
| What mode is the OFT in? | `oft_type()` → `MintBurn(<SAC manager>)` for USDT0; the alternative is `LockUnlock` |

Storage keys mirror these names (`Peer(eid)`, `FeeBps(eid)`, `RateLimit(direction, eid)`, `EnforcedOptions(eid, msg_type)`), so `stellar ledger entry fetch contract-data --contract <OFT> --key-xdr <key>` reads them without any invocation at all.

Pathway coverage grows: mainnet traffic in late August 2026 already spanned Ethereum (`30101`), Polygon (`30109`), Arbitrum (`30110`) and several more in both directions. Resolve the destination with `peer(eid)` for the route the user actually asked for.

### Tracking a transfer

[LayerZero Scan](https://layerzeroscan.com) follows a message end to end — source transaction, DVN verification, destination delivery — on both networks. It is the equivalent of polling Iris in the CCTP flow. Timing is driven by source-chain finality plus DVN and executor latency: minutes, in practice. Don't promise a number.

### Limitations and status notes

- **No USDT0 testnet deployment.** USDT0's deployments page lists no Stellar testnet entry (checked 2026-08-27), so a testnet round trip of USDT0 itself is not available. Keep mainnet USDT0 work to read-only simulation until the flow is proven.
- **A testnet rehearsal is not guaranteed.** You can deploy your own OApp or OFT against the testnet endpoint (EID `40600`), but testnet sends failed with `#1213 UnsupportedMessageLib` in August 2026 — the required DVN did not support the endpoint's only registered message library. That endpoint has been redeployed since, and this file does not record a successful testnet send after it. Send one small testnet message and confirm delivery before you treat testnet as a rehearsal path.
- Fee basis points, rate limits, and the pause flag are live configuration — see the table above.
- Anything deeper on deployment and wiring belongs to the [Stellar OFT docs](https://docs.layerzero.network/v2/developers/stellar/oft/overview) and the [OFT standard](https://docs.layerzero.network/v2/concepts/applications/oft-standard).

## OApp: the Soroban contract pattern

Source of truth: [LayerZero-Labs/monorepo-external](https://github.com/LayerZero-Labs/monorepo-external) — the protocol contracts (`contracts/protocol/stellar/`), the OApp packages (`apps/oapp-app/contracts/stellar/`), the OFT and SAC-manager contracts (`apps/oft-app/contracts/stellar/`), and the worked reference at `apps/project-types/omni-counter-app/contracts/stellar/`. There is no Stellar package in the public `LayerZero-v2` repo and no LayerZero Stellar crate on crates.io — work from this monorepo.

Every import path, argument order, and trait signature below was checked against the monorepo at HEAD on 2026-08-27. It is a skeleton, not a compiled artifact: build it yourself for `wasm32v1-none` before you trust it, and confirm `lz_receive` appears in the exported interface.

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
- **`custom = [receiver]` is a footgun.** Passing `#[oapp(custom = [receiver])]` tells the macro to *skip* generating the receiver surface; unless you then supply your own `#[contract_impl(contracttrait)] impl OAppReceiver` (as the counter example does, to customize `next_nonce`), the contract **compiles cleanly but exports no `lz_receive` at all** — an OApp that silently cannot receive. Use plain `#[oapp]` unless you're deliberately taking that surface over.
- **Peers must be set on both sides.** `set_peer(&dst_eid, &Some(remote_oapp_bytes32), &caller)` on Stellar, and the mirror call on the destination OApp. A message from an unset peer never reaches `__lz_receive`.
- **Fees are quoted, then paid in the chain's native token** (XLM on Stellar). Quote with `__quote` into a `MessagingFee` and pass it to `__lz_send`; underquoting fails the send.
- **Auth is Soroban-native.** `require_auth()` replaces EVM's `msg.sender` checks throughout, and `FeePayer::{Verified, Unverified}` exists specifically to avoid double-auth in the auth tree.
- The counter example additionally shows **ordered-nonce enforcement** (`origin.nonce` bookkeeping plus the endpoint's `skip`), **composed messages** (`send_compose` for A→B→C flows), and an **ABA round-trip** (receive triggers a send back) — read it before designing anything stateful.

## OFT: omnichain tokens of your own

OFT is LayerZero's token standard, the analogue of Axelar's ITS. The Stellar contracts live at `apps/oft-app/contracts/stellar/` in the monorepo, in three pieces worth knowing apart:

- `oft-core` — the shared logic: decimal conversion, `quote_oft`/`quote_send`/`send`, message building.
- `oft` — the deployable contract, with the `pausable`, `oft_fee`, and `rate_limiter` extensions bolted on.
- `sac-manager` — the piece that makes an **existing classic Stellar asset** work as a MintBurn OFT. It becomes the SAC's admin and forwards `mint`, `clawback`, `set_authorized`, and `set_admin` under role gates (`MINTER_ROLE`, `CLAWBACK_ROLE`, `BLACKLISTER_ROLE`, `ADMIN_MANAGER_ROLE`). This is exactly the USDT0 arrangement.

One hard prerequisite from the SAC-manager design: **the issuer account must be locked** (master key weight `0`). Payments from a classic issuer are minting, so an unlocked issuer can bypass the role model entirely and the trust story collapses. USDT0's issuer is locked. Verify that before you trust any contract-administered classic asset — see `../assets/SKILL.md`.

## Choosing between Axelar GMP and LayerZero OApp

Both move arbitrary payloads between Stellar contracts and other chains; neither is strictly better.

- **Security model**: Axelar messages are verified by its proof-of-stake validator network — one shared model for everyone. LayerZero lets each application pick its own DVN set — more control, and more responsibility (a weak DVN config is your problem).
- **Token standard**: existing Stellar assets connect via Axelar's canonical ITS registration, or via an OFT with a SAC manager as above. New multichain tokens work well in either.
- **Track record on Stellar**: Axelar's Stellar contracts have been live longer; LayerZero's endpoint arrived in July 2026 but now carries production USDT0 traffic. Coverage differs too — check each protocol's chain list for the chains you actually need.
- **Ecosystem gravity**: if your team already runs OApps or ITS integrations elsewhere, staying on that stack usually beats mixing rails.
