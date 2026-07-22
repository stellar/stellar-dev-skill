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
| remove a key | `stellar keys rm <name>` (add `--force` to skip the confirmation prompt) |

Removing a key asks for confirmation. With no TTY (piped or scripted), a bare `stellar keys rm <name>` fails with `removal cancelled by user` — pass `--force` to remove it non-interactively.

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

`--secure-store` accepts a **12–24 word seed phrase only** (not an `S…` secret key) and saves it to the OS credential store.

```bash
# Interactive: prompts for the seed phrase
stellar keys add alice --secure-store

# Non-interactive (automation / no TTY): pipe the seed phrase on stdin
echo "$SEED_PHRASE" | stellar keys add alice --secure-store
```

`stellar keys add` never takes the secret as a command-line argument — a secret on the command line lands in shell history and the process table. It reads from the interactive prompt or from stdin.

> **One-way door.** A secure-store key can never be exported — `stellar keys secret <name>` on it fails with `Secure Store does not reveal secret key`. Back up the original seed phrase elsewhere *before* you rely on `--secure-store`; the CLI will not hand it back.

## List and select

```bash
stellar keys ls                        # list identity names (--long adds each key's config-file path, not its address)
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

**Pubnet:** there is no faucet. Fund the address (`stellar keys public-key alice`) from an exchange, or from an existing account with `tx new create-account`. A plain `tx new payment` **cannot** fund a brand-new address — it fails with `NoDestination` against an account that does not exist on-chain yet. Until an account holds the minimum XLM reserve it does not exist on-chain: `ledger entry fetch account` returns `"entries":[]` and transfers against it fail (see [accounts-and-tx.md](accounts-and-tx.md#readiness)).

## Private-key security: dos and don'ts

Custody is inherited from `stellar keys`; there is no separate wallet key store. Treat these keys as live funds.

**Do:**
- Prefer `--secure-store` so the secret lives in the OS credential store, not a plaintext file under `~/.config/stellar/identity/`.
- Reference keys by **name** (`--source alice`), never by pasting the `S…` secret into a command.
- Use a dedicated, low-value key for automation; keep high-value keys out of any automated flow's reach.
- Verify the active network (`stellar network ls`) before any state-changing command — a pubnet mistake spends real value.

**Don't:**
- Don't run `stellar keys secret <name>` anywhere the output is captured (a shared transcript, a CI log) — for a file-based key it prints the raw secret to stdout (secure-store keys refuse to export). Reserve it for interactive export, and treat any log that captured it as compromised.
- Don't pass secrets as command-line arguments (they persist in shell history and `ps` output). The CLI takes them via prompt or key name for this reason.
- Don't commit `~/.config/stellar/` or any exported secret / seed phrase to version control.
- Don't reuse the same key across testnet experiments and pubnet funds.
