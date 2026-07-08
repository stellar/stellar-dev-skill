# Keys: custody, funding, and selection

An identity in the CLI is a named key. Custody lives here — every signing operation resolves a `--source` / `--sign-with-key` to one of these identities. Manage them with `stellar keys`.

Back to the [wallet overview](SKILL.md).

## Lifecycle at a glance

| Operation | Command |
|-----------|---------|
| create a new key | `stellar keys generate <name>` |
| import an existing key (secret or seed phrase) | `stellar keys add <name>` |
| reveal a secret (dangerous, see below) | `stellar keys secret <name>` |
| get the public address | `stellar keys public-key <name>` (alias `address`) |
| list keys | `stellar keys ls` |
| select the default key | `stellar keys use <name>` |
| remove a key | `stellar keys rm <name>` |

## Create a key

```bash
# Generate a new 24-word-seed identity named "alice"
stellar keys generate alice

# Generate and fund it in one step on a test network (Friendbot)
stellar keys generate alice --network testnet --fund

# Store the key in the OS secure store (Keychain / Windows Credential store / Secret Service)
# instead of a plaintext config file
stellar keys generate alice --secure-store
```

`--fund` only works on test networks. On pubnet, fund the address externally (see below).

## Import a key

```bash
# Prompts for a secret (S…) key or a 12–24 word seed phrase, saved to the secure store
stellar keys add alice --secure-store
```

`stellar keys add` reads the secret from an interactive prompt, never from a command-line argument — a secret on the command line lands in shell history and the process table.

## List and select

```bash
stellar keys ls                        # list identity names (add --long for addresses)
stellar keys use alice                 # set alice as the default source for all commands
```

Once `keys use` is set, you can omit `--source alice` on subsequent commands. When juggling multiple wallets, pass `--source <name>` explicitly per command rather than relying on the mutable default.

## Get an address

```bash
stellar keys public-key alice
```

Use this to resolve a name to a `G…` address for `--to`, `--of`, or a trustline account, without ever touching the secret.

## Fund an account

**Test networks (testnet / futurenet):** Friendbot creates and funds the account with XLM.

```bash
stellar keys fund alice --network testnet
```

**Pubnet:** there is no faucet. Fund the address (`stellar keys public-key alice`) from an exchange, an existing account via `tx new payment`, or `tx new create-account`. An account does not exist on-chain until it holds the minimum XLM reserve — reads and transfers against an unfunded account fail until then (see [accounts-and-tx.md](accounts-and-tx.md#readiness)).

## Private-key security: dos and don'ts

Custody is inherited from `stellar keys`; there is no separate wallet key store. Treat these keys as live funds.

**Do:**
- Prefer `--secure-store` so the secret lives in the OS credential store, not a plaintext file under `~/.config/stellar/identity/`.
- Reference keys by **name** (`--source alice`), never by pasting the `S…` secret into a command.
- Use a dedicated, low-value key for automation; keep high-value keys out of any automated flow's reach.
- Verify the active network (`stellar network ls`) before any state-changing command — a pubnet mistake spends real value.

**Don't:**
- Don't run `stellar keys secret <name>` anywhere the output is captured (a shared transcript, a CI log) — it prints the raw secret to stdout. Reserve it for interactive export, and treat any log that captured it as compromised.
- Don't pass secrets as command-line arguments (they persist in shell history and `ps` output). The CLI takes them via prompt or key name for this reason.
- Don't commit `~/.config/stellar/` or any exported secret / seed phrase to version control.
- Don't reuse the same key across testnet experiments and pubnet funds.
