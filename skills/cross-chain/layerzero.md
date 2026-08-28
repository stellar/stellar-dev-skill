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

USDT0 is USDT moved over LayerZero's OFT standard. There is no wrapped token and no pool. On Stellar it is a **classic asset** with a locked issuer whose SAC admin is a contract.

**The debit and credit shape is per leg, not global.** Stellar's deployment is a `MintBurn` OFT: it burns on send and mints on receive. Ethereum's is an **OFT Adapter** (`0x6C96dE32CEa08842dcc4058c14d3aaAD7Fa41dee`) over canonical Tether USDT (`0xdAC17F958D2ee523a2206206994597C13D831ec7`, confirmed by the adapter's `token()`). That leg locks and unlocks the reserve instead: a send to Ethereum unlocks USDT, and a send from Ethereum locks it, so the sender there approves the adapter first. Read the far chain's entry on the [deployments page](https://docs.usdt0.to/technical-documentation/deployments) — it says `OFT` or `OFT Adapter` — and read `oft_type()` on Stellar. Never promise burn-and-mint on both ends of a route.

| Surface | Address |
|---|---|
| Classic asset | `USDT0:GATISXX6BZ6NC7IKQBY37CJD4SOZL3CYZJWXEDG6JVIY4WBS6KXJHN6Q` |
| SAC (the OFT's `token()`) | `CBSJZEIO5C7KC2SF3MKSNXXJSW5G3VTNBX4ATMKUI3B2MR4JKM4R26YF` |
| OFT | `CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6` |
| SAC manager (mint/burn adapter, and the SAC's admin) | `CA3GUWLOS3QKN6WNRAELSUDSKLDTVTWEDJ3KLGAJG3SIWGA5L3KZYWGJ` |
| OneSig (owns the SAC manager) | `CBCZ5CETG3XR5MZVDC7QBDOTIH6P7MOLUH2SSC52J3NVBYIV45D4QKR6` |

Addresses per [USDT0's deployments page](https://docs.usdt0.to/technical-documentation/deployments), which lists the token, OFT, and OneSig. The SAC matches Horizon's own derivation for the asset, and the SAC manager is the contract the OFT mints through — confirmed from a live inbound transfer on mainnet. USDT0 is part of Everdawn Labs Limited.

### The rules that save funds

1. **An account (`G…`) recipient needs a USDT0 trustline before anything inbound lands.** A `G…` account cannot hold an issued asset without one. This is the single most common inbound failure. A contract (`C…`) recipient needs none — but only while that contract exists. SAC balances for contracts live in contract storage, not in a trustline. The OFT decides which one you get from the 32-byte recipient: it resolves to a contract address when a contract with that ID exists, and to a `G…` account otherwise. **Confirm the recipient contract is deployed before the source chain sends** — see below.
2. **Pin the code *and* the issuer.** `USDT0` is a 5-character code (`credit_alphanum12`), and asset code alone identifies nothing. Verify the SAC by derivation — `stellar contract id asset --asset USDT0:GATISXX6… --network mainnet` must return `CBSJZEIO…`.
3. **There is no `stellar.toml`.** The issuer publishes no `home_domain`, so every check keyed on `home_domain` or a SEP-1 `[[CURRENCIES]]` entry fails on a legitimate, live asset. Validate by issuer plus SAC derivation instead. See `../assets/SKILL.md` for the full pre-listing recipe.
4. **Dust below 6 decimals is dropped on send** — see below.

### Decimals: 7 local, 6 shared

The SAC uses Stellar's 7 decimals. The OFT's `shared_decimals()` is **6**, the precision USDT0 uses on every chain. `decimal_conversion_rate()` is therefore `10 ^ (7 - 6)` = **10**, and the OFT removes any remainder before it builds the message. Where that remainder ends up depends on the route's OFT fee, so read `effective_fee_bps(dst_eid)` before you promise a user anything:

- **No fee on the route** (`effective_fee_bps` is `0`): send `1.0000001` USDT0 (`amount_ld` = `10000001`) and `amount_sent_ld` is `10000000`. The trailing `0.0000001` **stays in your account**. It is not lost, but it is not sent either.
- **A fee on the route** (`effective_fee_bps` above `0`): the OFT debits your full `amount_ld` instead, and the rounded remainder is absorbed into the fee rather than left behind. `amount_sent_ld` is your whole input, and `amount_received_ld` is the dust-adjusted amount after the fee.
- Fee basis points are live configuration (see the table below), so never hardcode the first case.
- Quote first and compare. `quote_oft` returns an `OFTReceipt` whose `amount_sent_ld` and `amount_received_ld` are already dust- and fee-adjusted — treat those, not your input, as the truth.
- Never derive one side from the other with floats, and test with amounts that exercise the seventh digit.

### Inbound: EVM → Stellar

1. For a `G…` recipient, the trustline must exist first (rule 1 above). A `C…` recipient needs none, but it must already be deployed on Stellar.
2. Send on the source chain against USDT0's OFT there, with Stellar's EID `30600` and the recipient as its **decoded 32-byte strkey payload** — see below.
3. LayerZero's DVNs verify, then the executor delivers. On Stellar the delivery lands as `ExecutorHelper.execute`, which sub-invokes `lz_receive` on the OFT; the OFT credits through the SAC manager (it holds `MINTER_ROLE`), which mints on the SAC.

**Encoding the recipient is the fund-critical step.** The message carries a raw 32-byte payload, and the Stellar OFT feeds it straight to `resolve_address` (`oft-core/src/utils.rs`). Decode the strkey and send **only its payload**: the Ed25519 public key for a `G…` account, the contract ID hash for a `C…` contract. Never send the strkey string itself, and never keep its version byte or its 2-byte checksum. Any of those gives the OFT 32 different bytes, which it resolves anyway: the credit either lands on an address you do not control, or fails on a missing trustline and leaves the message undelivered. **Do not copy the CCTP pattern here** — CCTP carries the recipient strkey as UTF-8 hook data ([cctp.md](cctp.md#hook-data-layout)). LayerZero does not. It wants the raw payload:

```ts
import { StrKey } from "@stellar/stellar-sdk";

function stellarRecipientToBytes32(strkey: string): `0x${string}` {
  let raw;
  if (StrKey.isValidContract(strkey)) {
    raw = StrKey.decodeContract(strkey);          // C… → contract ID hash
  } else if (StrKey.isValidEd25519PublicKey(strkey)) {
    raw = StrKey.decodeEd25519PublicKey(strkey);  // G… → Ed25519 public key
  } else {
    throw new Error(`Not a G… or C… address: ${strkey}`);
  }
  return `0x${Buffer.from(raw).toString("hex")}`; // 32 bytes, no version, no checksum
}
```

**A `C…` strkey that parses is not proof the contract is there.** `StrKey.isValidContract` reads the string; `resolve_address` reads the ledger. If that contract is not deployed when the message is delivered, the OFT reads the same 32 bytes as an Ed25519 account and credits a `G…` address instead. Those bytes are a contract ID hash, so no one holds the matching secret key. That account can never sign a `changeTrust`, so it never gets a USDT0 trustline and the delivery keeps failing — while the source chain has already burned or locked the tokens. LayerZero states the assumption in `oft-core/src/utils.rs`: the sender "is expected to deploy the destination contract beforehand". Deploy it first, and confirm it on the ledger immediately before the send:

```bash
RECIPIENT="CAAAA...ABCD"   # the contract you deployed to receive USDT0

# An instance entry means the contract exists. An error means do not send.
stellar ledger entry fetch contract-data --contract "$RECIPIENT" --instance \
  --output json-formatted --network mainnet
```

Existence is read when the message is delivered, not when you send it. Re-check right before the send, and never point a route at a contract you have not deployed yet.

Muxed (`M…`) addresses do not fit. An `M…` strkey decodes to 40 bytes — the `G…` key plus an 8-byte id — and the OFT reads 32. Sending the `G…` half works, but the id is gone, so a custodian loses the sub-account it routes on. Give each sub-account its own `G…` account, or credit it from your own records off the `oft_received` event. CCTP differs here: its hook data accepts an `M…` strkey directly.

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

Order matters: `quote_oft` tells you what will actually arrive, `quote_send` prices the message, `send` executes it. The quotes are read-only, and `send` is shown below with `--send=no` so all three simulate. Run them in that order before you ask a user to sign anything:

```bash
# --send=no simulates. The two quotes never sign; the third command would.
OFT=CBOWOLFSDM5PZXNFIVDMP5NZ7U2GSIHED6H6R446QOHF266XINKUMMF6
SENDER=$(stellar keys address alice)   # the account that pays and signs
EVM_TO=0x1234...abcd                   # the EVM recipient, 20-byte hex
TO=000000000000000000000000${EVM_TO#0x}   # left-padded to 32 bytes

# Discover with a zero floor. min_amount_ld is enforced by the quotes too,
# so a real floor here hides the answer behind SlippageExceeded.
DISCOVER='{"dst_eid":30101,"to":"'"$TO"'","amount_ld":"10000000","min_amount_ld":"0","extra_options":"","compose_msg":"","oft_cmd":""}'

# 1. What actually arrives? Returns (OFTLimit, Vec<OFTFeeDetail>, OFTReceipt).
stellar contract invoke --id "$OFT" --source-account alice \
  --network mainnet --send=no \
  -- quote_oft --from "$SENDER" --send_param "$DISCOVER"

# 2. Show the user amount_received_ld, get their floor, then rebuild the
#    parameter with it. This is the value you send with.
read -r MIN_AMOUNT                     # the minimum the user accepts, in stroops
PARAM='{"dst_eid":30101,"to":"'"$TO"'","amount_ld":"10000000","min_amount_ld":"'"$MIN_AMOUNT"'","extra_options":"","compose_msg":"","oft_cmd":""}'

# 3. What does the message cost? Returns MessagingFee { native_fee, zro_fee }.
stellar contract invoke --id "$OFT" --source-account alice \
  --network mainnet --send=no \
  -- quote_send --from "$SENDER" --pay_in_zro false --send_param "$PARAM"

# 4. The send itself. NATIVE_FEE is the stroop figure step 3 returned; quote
#    it every time. Drop --send=no only when the user agreed to sign.
read -r NATIVE_FEE                     # paste the native_fee from step 3
FEE='{"native_fee":"'"$NATIVE_FEE"'","zro_fee":"0"}'

stellar contract invoke --id "$OFT" --source-account alice \
  --network mainnet --send=no \
  -- send --from "$SENDER" --send_param "$PARAM" \
     --fee "$FEE" --refund_address "$SENDER"
```

**Never discover a route with a real slippage floor.** `quote_oft` and `quote_send` both call `__debit_view`, which asserts `amount_received_ld >= min_amount_ld` and panics `SlippageExceeded` (`oft/src/oft.rs`). A route charging more than your floor then returns an error instead of a receipt, and you cannot tell an expensive route from a broken one. Quote with `0`, show the user what arrives, and re-run both quotes with their floor immediately before `send`.

**Two fees, two denominations. Do not confuse them.**

- **The LayerZero messaging fee is XLM.** `quote_send` returns a `MessagingFee`; `native_fee` is XLM in stroops, and `send` transfers it to the endpoint through the native SAC. It tracks the destination route, the DVN set, and executor pricing, so quote every send and never reuse a number from a previous one. `refund_address` receives any excess.
- **The OFT fee, when one is configured, is charged in USDT0 itself.** If `effective_fee_bps(dst_eid)` is above `0`, `send` transfers that share of the token to the OFT's fee deposit address, and `quote_oft` reports it as an `OFTFeeDetail` and a lower `amount_received_ld`. So a sender may need XLM *and* more USDT0 than the amount that arrives. Read `effective_fee_bps(dst_eid)` for the route in hand instead of assuming the rate is zero.

One transaction does the whole outbound leg: `send` burns `amount_received_ld` on the SAC, transfers any OFT fee, and pays the messaging fee inside a single auth tree, so the sender signs once.

### State you must read live, never hardcode

Peers, pause state, fee basis points, and rate limits are configuration. They change without notice, and a stale copy in a prompt is a failed transfer.

| Question | Call |
|---|---|
| Is this pathway wired up? | `peer(eid)` → `Option<BytesN<32>>`; `None` means no route |
| Is the OFT halted? | `is_paused()` |
| Is a fee charged on this route? | `default_fee_bps()`, `fee_bps(dst_eid)`, `effective_fee_bps(dst_eid)` |
| Will my amount fit the throttle? | `rate_limit_config(direction, eid)`, `rate_limit_capacity(direction, eid)` — `direction` is `Inbound` or `Outbound` |
| What mode is the OFT in? | `oft_type()` → `MintBurn(<SAC manager>)` for USDT0; the alternative is `LockUnlock` |

Storage keys mirror these names (`Peer(eid)`, `FeeBps(eid)`, `RateLimit(direction, eid)`, `EnforcedOptions(eid, msg_type)`), so `stellar ledger entry fetch contract-data --contract "$OFT" --key-xdr "$KEY"` reads them without any invocation at all.

Pathway coverage grows: mainnet traffic in late August 2026 already spanned Ethereum (`30101`), Polygon (`30109`), Arbitrum (`30110`) and several more in both directions. Resolve the destination with `peer(eid)` for the route the user actually asked for.

### Tracking a transfer

[LayerZero Scan](https://layerzeroscan.com) follows a message end to end — source transaction, DVN verification, destination delivery — on both networks. It is the equivalent of polling Iris in the CCTP flow. Timing is driven by source-chain finality plus DVN and executor latency: minutes, in practice. Don't promise a number.

### Limitations and status notes

- **No USDT0 testnet deployment.** USDT0's deployments page lists no Stellar testnet entry (checked 2026-08-27), so a testnet round trip of USDT0 itself is not available. The rehearsal path is therefore read-only `quote_oft` and `quote_send` simulation, then a **dust-sized real mainnet transfer** — that transfer is how you prove the flow. Do it before you move a user's balance, and match the ["testnet first" rule](SKILL.md#pitfalls-shared-by-every-rail).
- **A testnet rehearsal is not guaranteed.** You can deploy your own OApp or OFT against the testnet endpoint (EID `40600`), but testnet sends failed with `#1213 UnsupportedMessageLib` in August 2026 — the required DVN did not support the endpoint's only registered message library. That endpoint has been redeployed since, and this file does not record a successful testnet send after it. Send one small testnet message and confirm delivery before you treat testnet as a rehearsal path.
- Fee basis points, rate limits, and the pause flag are live configuration — see the table above.
- Anything deeper on deployment and wiring belongs to the [Stellar OFT docs](https://docs.layerzero.network/v2/developers/stellar/oft/overview) and the [OFT standard](https://docs.layerzero.network/v2/concepts/applications/oft-standard).

## OApp: the Soroban contract pattern

Source of truth: [LayerZero-Labs/monorepo-external](https://github.com/LayerZero-Labs/monorepo-external) — the protocol contracts (`contracts/protocol/stellar/`), the OApp packages (`apps/oapp-app/contracts/stellar/`), the OFT and SAC-manager contracts (`apps/oft-app/contracts/stellar/`), and the worked reference at `apps/project-types/omni-counter-app/contracts/stellar/`. There is no Stellar package in the public `LayerZero-v2` repo and no LayerZero Stellar crate on crates.io — work from this monorepo.

Every import path, argument order, and trait signature below was read out of that monorepo at commit `3f1cf3adadca88aa7a4ee5a7ee251c8b7fefcf2f` (2026-08-26), whose `rust-toolchain.toml` pins Rust `1.90.0` and the `wasm32v1-none` target. Pin the same revision when you copy it, because these crates are not versioned on crates.io.

It is a skeleton, not a compiled artifact. Signature comparison does not catch macro expansion, feature, dependency, or target errors, and no build was run against this snippet. Compile it yourself for `wasm32v1-none` before you trust it, and confirm `lz_receive` appears in the exported interface.

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
- **Fees are quoted, then paid — in XLM, or in ZRO.** Quote with `__quote(dst_eid, message, options, pay_in_zro)` into a `MessagingFee { native_fee, zro_fee }` and pass that value to `__lz_send`; underquoting fails the send. `__lz_send` pays ZRO whenever `fee.zro_fee` is not `0`. Both steps need a ZRO token set on the endpoint (`zro()` → `Option<Address>`), and **they fail in different places with different errors**:
  - `__quote` with `pay_in_zro = true` reaches the endpoint, which panics `EndpointError::ZroUnavailable`.
  - `__lz_send` with a non-zero `zro_fee` never reaches the endpoint. `__pay_zro` runs first and panics `OAppError::ZroTokenUnavailable`.

  Don't match on the wrong one. Pass `pay_in_zro = false` unless you read a ZRO token on the endpoint you use.
- **Auth is Soroban-native.** `require_auth()` replaces EVM's `msg.sender` checks throughout, and `FeePayer::{Verified, Unverified}` exists specifically to avoid double-auth in the auth tree.
- The counter example additionally shows **ordered-nonce enforcement** (`origin.nonce` bookkeeping plus the endpoint's `skip`), **composed messages** (`send_compose` for A→B→C flows), and an **ABA round-trip** (receive triggers a send back) — read it before designing anything stateful.

## OFT: omnichain tokens of your own

OFT is LayerZero's token standard, the analogue of Axelar's ITS. The Stellar contracts live at `apps/oft-app/contracts/stellar/` in the monorepo, in three pieces worth knowing apart:

- `oft-core` — the shared logic: decimal conversion, `quote_oft`/`quote_send`/`send`, message building.
- `oft` — the deployable contract, with the `pausable`, `oft_fee`, and `rate_limiter` extensions bolted on.
- `sac-manager` — the piece that makes an **existing classic Stellar asset** work as a MintBurn OFT. It becomes the SAC's admin and forwards `mint`, `clawback`, `set_authorized`, and `set_admin` under role gates (`MINTER_ROLE`, `CLAWBACK_ROLE`, `BLACKLISTER_ROLE`, `ADMIN_MANAGER_ROLE`). This is exactly the USDT0 arrangement.

One hard prerequisite from the SAC-manager design: **the issuer account must be locked** (master key weight `0`). Payments from a classic issuer are minting, so an unlocked issuer can bypass the role model entirely and the trust story collapses. Lock it *after* `set_admin` hands the SAC to the manager, never before: the issuer is the SAC's first admin, and only it can authorize that first handover. USDT0's issuer is locked. Verify that before you trust any contract-administered classic asset — see `../assets/SKILL.md`.

## Choosing between Axelar GMP and LayerZero OApp

Both move arbitrary payloads between Stellar contracts and other chains; neither is strictly better.

- **Security model**: Axelar messages are verified by its proof-of-stake validator network — one shared model for everyone. LayerZero lets each application pick its own DVN set — more control, and more responsibility (a weak DVN config is your problem).
- **Token standard**: existing Stellar assets connect via Axelar's canonical ITS registration, or via an OFT with a SAC manager as above. New multichain tokens work well in either.
- **Track record on Stellar**: Axelar's Stellar contracts have been live longer; LayerZero's endpoint arrived in July 2026 but now carries production USDT0 traffic. Coverage differs too — check each protocol's chain list for the chains you actually need.
- **Ecosystem gravity**: if your team already runs OApps or ITS integrations elsewhere, staying on that stack usually beats mixing rails.
