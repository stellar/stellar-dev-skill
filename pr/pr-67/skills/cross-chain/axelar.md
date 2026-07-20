# Axelar on Stellar — GMP and Interchain Tokens

[Axelar](https://docs.axelar.dev/) connects Stellar to EVM chains and the wider Axelar ecosystem through its amplifier stack. Two products matter here:

- **GMP (General Message Passing)** — a Soroban contract sends arbitrary payloads to a contract on another chain, or receives and executes payloads from one.
- **ITS (Interchain Token Service)** — tokens that exist on multiple chains: mint new ones, or connect an existing Stellar token.

Both are live on Stellar testnet and mainnet. The Stellar contracts are Rust/Soroban and live in [axelar-amplifier-stellar](https://github.com/axelarnetwork/axelar-amplifier-stellar) — `stellar-axelar-gateway`, `stellar-axelar-gas-service`, and the ITS contracts. Every signature in this file is checked against those sources, which occasionally run ahead of the docs site; when they disagree, the source wins.

> **Addresses:** resolve the current Gateway, Gas Service, and ITS addresses from Axelar's [contract addresses directory](https://docs.axelar.dev/resources/contract-addresses/mainnet/) (and its testnet counterpart) or the amplifier repo's releases at integration time — they are deployment-versioned, so don't hardcode from any tutorial, including this one.

## GMP: sending a message from Stellar

Two calls, in order — gas first, then the message. Cross-chain execution is paid up front on the source chain.

**1. Pay gas** on the Gas Service. The `token` parameter is a struct of `{ address, amount }` — which token you're paying with and how much:

```rust
fn pay_gas(
    env: Env,
    sender: Address,
    destination_chain: String,
    destination_address: String,
    payload: Bytes,
    spender: Address,
    token: Token,
    metadata: Bytes,
) -> Result<(), ContractError>;
```

**2. Call the Gateway** with the same chain/address/payload triple:

```rust
pub fn call_contract(
    env: Env,
    caller: Address,
    destination_chain: String,
    destination_address: String,
    payload: Bytes,
);
```

Notes that save debugging time:

- `destination_chain` is Axelar's registered chain name (a string), not a chain ID — take the exact spelling from Axelar's chain directory. A misspelled chain name fails downstream, not at call time.
- `destination_address` is a string in the destination chain's own format (for EVM, the `0x…` hex address).
- `payload` is raw `Bytes`. Axelar does not define the codec — you do. For EVM counterparties the convention is ABI encoding, so encode/decode with an ABI library on both ends and version your payload format from day one.
- Underpaid gas strands the message until topped up; the Gas Service also handles refunds of overpayment. Estimate via Axelar's gas APIs rather than guessing.

## GMP: receiving a message on Stellar

Do **not** hand-implement the executable interface — the source marks it "DO NOT IMPLEMENT THIS MANUALLY!". The supported pattern is the `AxelarExecutable` derive macro plus a `CustomAxelarExecutable` impl with two functions: `__gateway` (which gateway to trust) and `__execute` (your logic). The macro generates the public `execute` entrypoint and **guarantees the gateway's `validate_message` has already succeeded** before `__execute` runs. Verbatim from Axelar's own [example contract](https://github.com/axelarnetwork/axelar-amplifier-stellar/tree/main/contracts/stellar-axelar-example):

```rust
use stellar_axelar_gateway::executable::CustomAxelarExecutable;
use stellar_axelar_std::AxelarExecutable;

#[contract]
#[derive(AxelarExecutable)]
pub struct AxelarExample;

impl CustomAxelarExecutable for AxelarExample {
    type Error = AxelarExampleError;

    fn __gateway(env: &Env) -> Address {
        storage::gateway(env)
    }

    fn __execute(
        env: &Env,
        source_chain: String,
        message_id: String,
        source_address: String,
        payload: Bytes,
    ) -> Result<(), Self::Error> {
        // your logic — the message is already gateway-validated here
        Ok(())
    }
}
```

Under the hood the generated `execute` calls the Gateway's `validate_message`, which authenticates the exact message (chain, id, sender, payload hash) and flips it to executed so it cannot replay:

```rust
fn validate_message(
    env: Env,
    caller: Address,          // must be the message's intended destination contract
    source_chain: String,
    message_id: String,
    source_address: String,
    payload_hash: BytesN<32>,
) -> bool;
```

One thing the macro does **not** do for you: check `source_chain`/`source_address` against an allowlist of counterpart contracts you trust. Axelar authenticates *that* the message came from that sender, not *whether* you should listen to them — do that check first thing in `__execute`.

Axelar's [Stellar GMP guide](https://docs.axelar.dev/dev/general-message-passing/stellar-gmp/intro/), the worked [GMP example docs](https://docs.axelar.dev/dev/general-message-passing/stellar-gmp/gmp-example/), and the `stellar-axelar-example` contract are the scaffolding starting points. The same example also shows `#[derive(InterchainTokenExecutable)]` + `CustomInterchainTokenExecutable` — the receiving-side hook for ITS transfers that carry a data payload.

## ITS: tokens on multiple chains

ITS on Stellar operates in **hub mode**: token messages route through Axelar's ITS Hub rather than chain-to-chain. Components: the `InterchainTokenService` contract (coordination), a `TokenManager` per token (mint/burn/lock), and `InterchainToken` (a Stellar token interface implementation — meaning ITS-deployed tokens are Soroban contracts, addressable like any `C…` token).

**Mint a new multichain token** — deploy locally, then extend it to each destination chain (each remote deployment pays its own gas):

```rust
fn deploy_interchain_token(
    env: &Env, deployer: Address, salt: BytesN<32>,
    token_metadata: TokenMetadata, initial_supply: i128, minter: Option<Address>,
) -> Result<BytesN<32>, ContractError>;   // returns the token_id

fn deploy_remote_interchain_token(
    env: &Env, caller: Address, salt: BytesN<32>,
    destination_chain: String, gas_token: Option<Token>,
) -> Result<BytesN<32>, ContractError>;
```

**Connect an existing Stellar token** (canonical registration) — works for any Stellar token, SACs of classic assets included. Anyone can deploy the trustless canonical representation to a trusted chain. Naming quirk from the source: if the token name exceeds 32 characters the symbol is used as the name, and natively issued Stellar assets always deploy with the symbol as the name:

```rust
fn register_canonical_token(
    env: &Env, token_address: Address,
) -> Result<BytesN<32>, ContractError>;

fn deploy_remote_canonical_token(
    env: &Env, token_address: Address, destination_chain: String,
    spender: Address, gas_token: Option<Token>,
) -> Result<BytesN<32>, ContractError>;
```

**Move tokens** — one call, addressed by the `token_id` the deploy/registration returned:

```rust
fn interchain_transfer(
    env: &Env, caller: Address, token_id: BytesN<32>,
    destination_chain: String, destination_address: Bytes, amount: i128,
    metadata: Option<Bytes>, gas_token: Option<Token>,
) -> Result<(), ContractError>;
```

`destination_address` is `Bytes` in the destination chain's format; `metadata` optionally triggers contract execution on arrival (GMP piggybacked on a token transfer — the receiver implements `InterchainTokenExecutable`); `gas_token` prepays the cross-chain leg.

**Operational controls** — per-token rate limits, worth setting for anything with real value. Callable by the contract operator and by per-token approved flow limiters:

```rust
fn set_flow_limit(
    env: &Env, caller: Address, token_id: BytesN<32>, flow_limit: Option<i128>,
) -> Result<(), ContractError>;
fn flow_limit(env: &Env, token_id: BytesN<32>) -> Option<i128>;
fn flow_out_amount(env: &Env, token_id: BytesN<32>) -> i128;   // current-epoch outflow
fn flow_in_amount(env: &Env, token_id: BytesN<32>) -> i128;
```

## ITS pitfalls

- **`token_id` is the identity, not the address.** The same token has different contract addresses per chain but one `BytesN<32>` token id — persist the id, derive addresses from it.
- **Decimals don't auto-reconcile across ecosystems.** Classic-asset SACs are 7-decimal, but a canonical registration accepts any Soroban token, and ITS tokens carry whatever `TokenMetadata` declared — read `decimals()` from the token instead of assuming 7, and think through amount scaling before wiring UIs to EVM counterparts (test a dust-sized transfer first).
- **Remote deployments and transfers both prepay gas** via `gas_token` — budget one gas payment per destination chain, not one total.
- **Flow limits fail closed.** A transfer that would exceed the window's limit is rejected, not queued — surface that error distinctly from "bridge is broken".

Full walkthroughs: Axelar's [Stellar ITS guide](https://docs.axelar.dev/dev/send-tokens/stellar/intro/).
