# WalletConnect on Stellar

Connect mobile wallets to a dapp over WalletConnect, implement the `stellar` namespace in a wallet, and accept WalletConnect Pay. Companion to [SKILL.md](SKILL.md).

> **Sourcing** (checked November 2026): the [WalletConnect Stellar RPC reference](https://docs.walletconnect.com/wallets/chains/stellar), the [WalletConnect Pay Stellar guide](https://docs.walletconnect.com/payments/wallets/token-chain-support/stellar-support), and Stellar Wallets Kit 2.8.0 on JSR (`sdk/modules/wallet-connect.module.ts`). WalletConnect marks the Stellar RPC standard as a proposal under review, so method shapes can change. Check the live page before you ship.

## Dapp: add the WalletConnect module to Stellar Wallets Kit

`defaultModules()` does not include WalletConnect, because the module needs a project ID and app metadata. Create a project ID in the [Reown Dashboard](https://dashboard.reown.com). The ID is public, so a `NEXT_PUBLIC_` variable is fine.

```typescript
// lib/wallets-kit.ts
import { StellarWalletsKit, Networks } from "@creit-tech/stellar-wallets-kit";
import { defaultModules } from "@creit-tech/stellar-wallets-kit/modules/utils";
import {
  WalletConnectModule,
  WalletConnectTargetChain,
} from "@creit-tech/stellar-wallets-kit/modules/wallet-connect";

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
if (!projectId) throw new Error("Missing NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID");

StellarWalletsKit.init({
  modules: [
    ...defaultModules(),
    new WalletConnectModule({
      projectId,
      metadata: {
        name: "My Stellar dApp",
        description: "Payments on Stellar",
        url: "https://example.com", // your app's origin
        icons: ["https://example.com/icon.png"],
      },
      // The module defaults to stellar:pubnet only. Match the kit's network,
      // or every request on testnet targets a chain the session never approved.
      allowedChains: [WalletConnectTargetChain.TESTNET],
    }),
  ],
  network: Networks.TESTNET,
});
```

What to know about the module (Wallets Kit 2.8.0):
- `authModal()`, `signTransaction()` and `signAuthEntry()` work as with any other module. The kit sends `stellar:pubnet` when the network passphrase is Mainnet and `stellar:testnet` otherwise.
- The module supports only `Networks.PUBLIC` and `Networks.TESTNET`. Other networks throw on connect.
- The session requires `stellar_signXDR`. It asks for `stellar_signAndSubmitXDR`, `stellar_signAuthEntry` and `stellar_signMessage` as optional methods, so a wallet can approve the session without them.
- The module does not listen for `accountsChanged` or `chainChanged`. Read the address again after the user switches accounts in the wallet.

## Wallet: implement the `stellar` namespace

| Item | Value |
|------|-------|
| Chains (CAIP-2) | `stellar:pubnet`, `stellar:testnet` |
| Accounts (CAIP-10) | `stellar:pubnet:G...` |
| Methods | `stellar_signXDR`, `stellar_signAndSubmitXDR`, `stellar_signMessage`, `stellar_signAuthEntry` |
| Events | `accountsChanged`, `chainChanged` |

Rules from the reference:
- Return only `G...` account IDs. Muxed (`M...`), pre-auth (`T...`) and hash (`X...`) forms are not valid accounts.
- Derive the network passphrase from the CAIP-2 chain. Never trust a network value from the request.
- `stellar_signXDR` signs a base64 `TransactionEnvelope` and returns it without submitting. `stellar_signAndSubmitXDR` signs and submits from the wallet.
- `stellar_signMessage` signs `sha256("Stellar Signed Message:\n" || message)`, the [SEP-53](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0053.md) format. Never sign raw bytes.
- `stellar_signAuthEntry` signs a `SorobanAuthorizationEntry` with address credentials. Reject the request when the entry's address is not the requested account.

Two known gaps between the spec page and real clients:
- **Auth-entry signature shape.** The WalletConnect page says to put a bare `SCMap` (`public_key`, `signature`) in the entry. The Soroban host decodes a `G...` account's signature as a `Vec` of those maps and rejects anything else. Sign with `authorizeEntry` from `@stellar/stellar-sdk`, which writes the `Vec` form.
- **Parameter names.** Wallets Kit 2.8.0 sends `{ xdr }` for `stellar_signXDR` and `{ entryXdr }` for `stellar_signAuthEntry`, with no `chain` or `account`. It reads `{ status }` from `stellar_signAndSubmitXDR`. The spec page lists `authEntry`, `chain` and `account` as parameters and returns `tx_hash` and `signedXDR`. Test against the dapps your wallet must support.

## Wallet: accept WalletConnect Pay

WalletConnect Pay supports Stellar since 29 October 2026. LOBSTR was the first live wallet. The gateway builds the payment, the wallet signs it, and WalletConnect Pay pays the fee and broadcasts.

- **Network and asset**: `stellar:pubnet` only. USDC from Circle, CAIP-19 `stellar:pubnet/asset:USDC-GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN`.
- **Accounts**: advertise `stellar:pubnet:G...` in `getPaymentOptions`. Muxed (`M...`) accounts are not valid.
- **Eligibility**: the gateway offers Stellar only when the account exists, holds a USDC trustline and has enough USDC. A missing Stellar option is expected, not an error.
- **Sign only**: sign with `stellar_signXDR` and return the signed envelope as a base64 string. Never use `stellar_signAndSubmitXDR`: the buyer then pays the fee and uses the sequence number the payment needs, so the payment fails.
- **Fee**: WalletConnect Pay wraps the signed transaction in a fee bump and pays the XLM fee. The buyer needs only USDC.
- **No changes**: do not change the fee, sequence number, time bounds, memo or operations. The gateway rejects a changed envelope.
- **Checks before signing**: bind the passphrase from `chainId`, confirm the transaction source equals the requested account, and show the USDC amount and destination.
- **Timing**: sign and confirm right after fetch. Another transaction from the same account in between invalidates the sequence number.
