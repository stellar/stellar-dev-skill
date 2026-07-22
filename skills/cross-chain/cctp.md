# CCTP V2 on Stellar — native USDC between chains

Circle's [Cross-Chain Transfer Protocol](https://developers.circle.com/cctp) moves USDC by **burning it on the source chain and minting native USDC on the destination**. No wrapped tokens, no liquidity pools, no slippage — the amount out is the amount in minus an optional fee. Stellar is CCTP **domain 27**.

The lifecycle is always the same three steps, in both directions:

1. **Burn** on the source chain (`deposit_for_burn` / `depositForBurn`).
2. **Attest**: Circle's Iris service observes the burn and signs an attestation.
3. **Mint** on the destination chain by submitting the message + attestation.

Read this file top to bottom before writing any code: CCTP on Stellar has one mistake class that **permanently destroys funds**, and it lives in step 1 of the inbound direction.

## Contracts and addresses

Stellar CCTP runs on three Soroban contracts ([Circle's contract reference](https://developers.circle.com/cctp/references/stellar-contracts) is canonical):

| Contract | Role |
|---|---|
| `TokenMessengerMinter` | Burns USDC outbound (`deposit_for_burn`, `deposit_for_burn_with_hook`); mints inbound. Consolidates EVM's `TokenMessengerV2` + `TokenMinterV2`. |
| `MessageTransmitter` | Message bus: emits messages, verifies attestations, enforces nonce uniqueness (`receive_message`, `is_nonce_used`). |
| `CctpForwarder` | Receives inbound mints and atomically forwards to the real recipient (`mint_and_forward`). **Required for Stellar recipients** — see below. |

**Mainnet** (domain 27):

| Contract | Address |
|---|---|
| `TokenMessengerMinter` | `CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL` |
| `MessageTransmitter` | `CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV` |
| `CctpForwarder` | `CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T` |

**Testnet** (domain 27):

| Contract | Address |
|---|---|
| `TokenMessengerMinter` | `CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP` |
| `MessageTransmitter` | `CBJ6MTCKKZG73PMDZCJMSFRD7DQEMI4FKDH7CGDSV4W6FHCRBCQAVVJY` |
| `CctpForwarder` | `CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ` |
| USDC (SAC) | `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA` (`USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5`) |

Derive the USDC SAC address for any network yourself rather than trusting a doc: `stellar contract id asset --asset USDC:<ISSUER> --network <net>`. Testnet USDC comes from [faucet.circle.com](https://faucet.circle.com) (pick "Stellar Testnet") — your account needs the trustline first.

## The one rule that saves funds: use `CctpForwarder` for Stellar recipients

CCTP message fields carry **raw 32-byte address payloads** — no `strkey` type marker. The protocol therefore cannot tell a `G…` account from a `C…` contract, and it **always assumes `mintRecipient` is a contract**. Sending USDC to a Stellar user account "directly" mints into an address nobody controls.

When transferring **to** Stellar, on the source-chain burn:

- Set **both** `mintRecipient` **and** `destinationCaller` to the `CctpForwarder` address (decoded to 32 bytes).
- Put the real recipient's `strkey` (`G…`, `M…`, or `C…`) into **hook data** as `forwardRecipient`.

Get either field wrong and the funds are **permanently stuck — there is no recovery path**:

- Wrong `destinationCaller` → the forwarder cannot complete the transfer.
- `mintRecipient` set to a user or muxed account → USDC never reaches the forwarder.

The forwarder flow is non-custodial: `mint_and_forward(message, attestation)` verifies the message, calls `receive_message` (minting to the forwarder), and pays out to `forwardRecipient` — all in one atomic Soroban invocation. Any failure reverts the whole thing.

### Hook data layout

| Bytes | Type | Data |
|---|---|---|
| 0–23 | `bytes24` | Magic, Circle-reserved; use all zero bytes |
| 24–27 | `uint32` (BE) | Version; set to `0` |
| 28–31 | `uint32` (BE) | `L`: length of `forwardRecipient` in bytes |
| `32..(32+L-1)` | `bytes` | `forwardRecipient` as a UTF-8 `strkey` |
| `(32+L)..` | `bytes` | Optional integrator payload; omit if unused |

Builder, from [Circle's reference](https://developers.circle.com/cctp/references/stellar) (validate the strkey before encoding — a typo here is a fund-loss bug, not a UX bug):

```typescript
import { StrKey } from "@stellar/stellar-sdk";

function buildCctpForwarderHookData(forwardRecipientStrkey: string): `0x${string}` {
  const isValid =
    StrKey.isValidEd25519PublicKey(forwardRecipientStrkey) ||
    StrKey.isValidContract(forwardRecipientStrkey) ||
    StrKey.isValidMed25519PublicKey(forwardRecipientStrkey);
  if (!isValid) throw new Error(`Invalid forward recipient: ${forwardRecipientStrkey}`);

  const recipientBytes = Buffer.from(forwardRecipientStrkey, "utf8");
  const hookData = Buffer.alloc(32 + recipientBytes.length); // bytes 0-23 stay zero (magic)
  hookData.writeUInt32BE(0, 24);                     // hook version = 0
  hookData.writeUInt32BE(recipientBytes.length, 28); // recipient byte length
  recipientBytes.copy(hookData, 32);                 // recipient strkey as UTF-8
  return `0x${hookData.toString("hex")}`;
}

// The forwarder itself is a C… contract; decode it for mintRecipient/destinationCaller:
function contractStrkeyToBytes32(strkey: string): `0x${string}` {
  if (!StrKey.isValidContract(strkey)) throw new Error(`Invalid contract strkey: ${strkey}`);
  return `0x${Buffer.from(StrKey.decodeContract(strkey)).toString("hex")}`;
}
```

## USDC precision: 7 decimals vs 6

Stellar represents USDC in **seven**-decimal subunits; every other CCTP chain uses **six**, and the `amount` in a CCTP message is **always six-decimal**. Direction determines the handling:

- **Stellar as source**: the burn debits only through the sixth decimal; the seventh digit stays in the sender's account. Bridging `0.1234567` USDC burns `0.1234560`, leaves `0.0000007` behind, and the message `amount` is `123456`.
- **Stellar as destination**: the six-decimal message amount is scaled ×10. A message `amount` of `123456` mints `0.1234560` (= `1234560` seven-decimal subunits).

Practical consequences: pass 7-decimal subunits (`i128`) to Stellar-side calls and 6-decimal units everywhere off-chain; never derive one from the other with floats; and when verifying "did the full amount arrive", compare in message units, not source-chain units.

## Stellar → EVM/Solana (outbound)

Two Stellar transactions in the plain flow — an allowance, then the burn — because `TokenMessengerMinter` pulls funds via `transfer_from`:

1. `approve` the USDC SAC with `TokenMessengerMinter` as spender for the amount.
2. Call `deposit_for_burn`. Verified argument order (Soroban):

```typescript
import { Address, Contract, TransactionBuilder, nativeToScVal, BASE_FEE } from "@stellar/stellar-sdk";

const tmm = new Contract(TOKEN_MESSENGER_MINTER);
const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase })
  .addOperation(
    tmm.call(
      "deposit_for_burn",
      Address.fromString(caller).toScVal(),
      nativeToScVal(amount, { type: "i128" }),          // 7-decimal Stellar subunits
      nativeToScVal(destinationDomain, { type: "u32" }), // e.g. 0 Ethereum, 6 Base, 5 Solana
      bytesN32(mintRecipient),   // 32-byte recipient: EVM address left-padded to 32; Solana: the USDC ATA's raw bytes
      Address.fromString(USDC_SAC).toScVal(),
      bytesN32(destinationCaller), // 32 zero bytes = anyone may complete the mint (permissionless)
      nativeToScVal(maxFee, { type: "i128" }),           // fee budget, 7-decimal subunits (100_000 ≈ $0.01)
      nativeToScVal(finalityThreshold, { type: "u32" }), // 1000 = Fast, 2000 = Standard
    ),
  )
  .setTimeout(60)
  .build();
// then: simulate, sign, submit (see ../dapp/SKILL.md)
```

3. Poll Iris for the attestation (below).
4. Submit `receiveMessage(message, attestation)` on the destination chain's `MessageTransmitterV2`. With `destinationCaller` zeroed this is permissionless — anyone (the recipient, your backend, a relayer) can submit it.

Recipient encoding: for EVM, left-pad the 20-byte address to 32 bytes. For Solana, `mintRecipient` is the recipient's **USDC associated token account** (not their wallet address) as raw 32 bytes.

**One-signature variant.** The two-transaction dance (approve, then burn) collapses into one Soroban transaction with a ~40-line wrapper contract, because Soroban's auth tree lets a single signature authorize both nested calls. From the [reference demo](https://github.com/ElliotFriend/stunning-octo-carnival) (`contracts/stellar/cctp-wrapper/`), verbatim:

```rust
pub fn approve_and_deposit(
    env: Env, caller: Address, usdc: Address, tmm: Address, amount: i128,
    destination_domain: u32, mint_recipient: BytesN<32>, destination_caller: BytesN<32>,
    max_fee: i128, min_finality_threshold: u32,
) {
    caller.require_auth();
    let expiration_ledger = (env.ledger().sequence() + 50).next_multiple_of(50);
    token::Client::new(&env, &usdc).approve(&caller, &tmm, &amount, &expiration_ledger);
    TmmClient::new(&env, &tmm).deposit_for_burn(
        &caller, &amount, &destination_domain, &mint_recipient,
        &usdc, &destination_caller, &max_fee, &min_finality_threshold,
    );
}
```

One wallet prompt, one network fee, and the allowance expires after 50–99 ledgers (the expression rounds up to the next multiple of 50) so nothing lingers.

## EVM/Solana → Stellar (inbound)

This is the direction where the [forwarder rule](#the-one-rule-that-saves-funds-use-cctpforwarder-for-stellar-recipients) applies. Prerequisite: a `G…` recipient needs a **USDC trustline** before anything can land.

1. On the source chain, call `depositForBurnWithHook` with:
   - `mintRecipient` = `CctpForwarder` (as bytes32, via `contractStrkeyToBytes32`)
   - `destinationCaller` = `CctpForwarder` (same value)
   - `destinationDomain` = `27`
   - `hookData` = the recipient strkey, encoded per the [hook layout](#hook-data-layout)
   - `amount`/`maxFee` in the source chain's 6-decimal USDC units
2. Poll Iris for the attestation.
3. On Stellar, invoke `mint_and_forward(message: Bytes, attestation: Bytes)` on `CctpForwarder`, passing the raw message and attestation bytes from Iris. One atomic invocation validates, mints, and pays the recipient.

## Iris: polling for the attestation

```
GET https://iris-api-sandbox.circle.com/v2/messages/{sourceDomain}?transactionHash={hash}   # testnet
GET https://iris-api.circle.com/v2/messages/{sourceDomain}?transactionHash={hash}           # mainnet
```

Poll until `status` is `"complete"`, then read `message` and `attestation` (both hex). Field-level gotchas, all verified against live behavior:

- **Stellar legs return `null` address fields.** In `decodedMessage`/`decodedMessageBody`, `sender`, `recipient`, `mintRecipient`, etc. are `null` when Stellar is involved — the API can't decode 32-byte Stellar payloads either. The transfer is fine; parse the raw `message` hex if you need the addresses.
- **Normalize hex hashes to lowercase, but never touch Solana signatures.** Solana tx signatures are base58 and case-sensitive — lowercasing one makes Iris 404 forever. Only lowercase hashes matching `/^(0x)?[0-9a-fA-F]+$/`.
- `delayReason: "insufficient_fee"` means your `maxFee` didn't cover the Fast tier — the transfer falls back to Standard finality rather than failing.
- Attestation latency is dominated by source-chain finality: seconds on fast-finality chains, up to ~15 minutes for Standard transfers from Ethereum-derived chains. `finalityThreshold` 1000 (Fast) vs 2000 (Standard) trades fee for speed.

## Worked reference implementation

The best way to see all of this run is [**ElliotFriend/stunning-octo-carnival**](https://github.com/ElliotFriend/stunning-octo-carnival) — a SvelteKit demo that bridges testnet USDC Stellar ↔ EVM (Arc, Base Sepolia) and Stellar ↔ Solana, making every step visible on one screen: burn, attestation, mint. It is the source several snippets above were adapted from, and it's tested end-to-end on testnet in both directions.

Worth studying in the source:

| What | Where |
|---|---|
| Hook-data encoding ("the most important code in the repo" — get it wrong and funds are lost) | `src/lib/evm/cctp.ts` |
| Stellar-side burns: direct, wrapper, wrapper-with-hook | `src/lib/stellar/cctp.ts` |
| The one-signature Soroban wrapper | `contracts/stellar/cctp-wrapper/` |
| Iris polling with the hash-normalization gotcha | `src/lib/circle/iris.ts` |
| Chain/domain/address registry | `src/lib/config.ts` |
| EVM-side UX ladder: 2-tx approve, 1-tx EIP-2612 permit wrapper, 1-click EIP-5792 `wallet_sendCalls` | `src/lib/evm/cctp.ts`, `contracts/evm/cctp-wrapper/` |

To run it: `pnpm install && pnpm run dev`, Freighter on Stellar Testnet + any injected EVM wallet, testnet USDC from [faucet.circle.com](https://faucet.circle.com), testnet XLM from [Stellar Lab](https://lab.stellar.org/account/fund). It defaults to Arc (Circle's L1) because attestation takes seconds there and gas is paid in USDC — the fastest feedback loop for learning the protocol.

## Limitations and status notes

- **USDC only** on Stellar CCTP today — EURC is not confirmed. Verify current asset support in [Circle's docs](https://developers.circle.com/cctp) before promising it.
- `TokenMessengerMinter` exposes `handle_receive_unfinalized_message` (Fast Burn) at the interface level; check Circle's current Fast-transfer support matrix for Stellar before relying on sub-finality mints.
- Domains are assigned by Circle ([supported chains and domains](https://developers.circle.com/cctp/concepts/supported-chains-and-domains)); Stellar is 27, and new chains appear regularly.
