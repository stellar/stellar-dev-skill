# Smart Accounts (Passkeys) & Fee Sponsorship

Passkey smart wallets with Smart Account Kit and gasless transactions via the OpenZeppelin Relayer. Companion to [SKILL.md](SKILL.md).

## Smart Accounts (Passkey Wallets)

For passwordless authentication using WebAuthn passkeys, use Smart Account Kit.

### Installation
```bash
npm install smart-account-kit
```

### Quick Start
```typescript
import { SmartAccountKit, IndexedDBStorage } from 'smart-account-kit';

const kit = new SmartAccountKit({
  rpcUrl: 'https://soroban-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  accountWasmHash: 'YOUR_ACCOUNT_WASM_HASH',
  webauthnVerifierAddress: 'CWEBAUTHN_VERIFIER_ADDRESS',
  storage: new IndexedDBStorage(),
});

// On page load - silent restore from stored session
const restored = await kit.connectWallet();
if (!restored) {
  showConnectButton(); // No stored session
}

// Create new wallet with passkey
const { contractId, credentialId } = await kit.createWallet(
  'My App',
  'user@example.com',
  { autoSubmit: true }
);

// Connect to existing wallet (prompts for passkey)
await kit.connectWallet({ prompt: true });

// Sign and submit transactions
const result = await kit.signAndSubmit(transaction);

// Transfer tokens
await kit.transfer(tokenContract, recipient, amount);
```

### Key Features
- **Session Management**: Automatic credential persistence and silent reconnection
- **Multiple Signer Types**: Passkeys (secp256r1), Ed25519 keys, policies
- **Context Rules**: Fine-grained authorization for different operations
- **Policy Support**: Threshold multisig, spending limits, custom policies
- **External Wallet Support**: Connect Freighter, LOBSTR via adapters
- **Gasless Transactions**: Optional relayer integration for fee sponsoring

### Fee Sponsorship with OpenZeppelin Relayer

The [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer/stellar) (also called Stellar Channels Service) handles gasless transaction submission. It replaces the deprecated Launchtube service and uses Stellar's native fee bump mechanism so users don't need XLM for fees.

```typescript
import * as RPChannels from "@openzeppelin/relayer-plugin-channels";

const client = new RPChannels.ChannelsClient({
  baseUrl: "https://channels.openzeppelin.com/testnet",
  apiKey: "your-api-key",
});

// Submit a smart contract call with fee sponsorship
const response = await client.submitSorobanTransaction({
  func: contractFunc,
  auth: contractAuth,
});
```

- **Testnet hosted instance**: `https://channels.openzeppelin.com/testnet` (API keys at `/gen`)
- **Production**: Self-host via Docker ([GitHub](https://github.com/OpenZeppelin/openzeppelin-relayer))
- **Stellar docs**: https://developers.stellar.org/docs/tools/openzeppelin-relayer

### Resources
- **GitHub**: https://github.com/kalepail/smart-account-kit
- **OpenZeppelin Contracts**: https://github.com/OpenZeppelin/stellar-contracts
- **Legacy SDK**: https://github.com/kalepail/passkey-kit (for simpler use cases)
