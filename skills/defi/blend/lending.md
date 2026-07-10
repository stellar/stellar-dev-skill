# Blend lending: supply, borrow, repay, withdraw

## Contents

- [The `submit` model](#the-submit-model) (incl. the `RequestType` table)
- [Supply collateral](#supply-collateral)
- [Borrow](#borrow)
- [Repay](#repay)
- [Withdraw collateral](#withdraw-collateral)
- [Batching requests atomically](#batching-requests-atomically)
- [Discovering pools](#discovering-pools)
- [Reading pool state](#reading-pool-state)
- [Emissions: check, project, claim](#emissions-check-project-claim)
- [Projected earnings](#projected-earnings)

Every lending action on a Blend pool goes through a single entrypoint: **`submit`**. You describe what you want as a list of `Request`s, and the pool executes them atomically against your position. Supplying, borrowing, repaying, and withdrawing are all just different `RequestType`s in that list.

Read the pool's real interface before you build anything:

```bash
stellar contract info interface --id <POOL_CONTRACT> --network "$NETWORK"
```

## The `submit` model

Signature (v2 pools also expose `submit_with_allowance` and `flash_loan` variants):

```
submit(from: Address, spender: Address, to: Address, requests: Vec<Request>) -> Positions
```

- `from` — whose position is modified (the borrower/supplier).
- `spender` — who pays tokens **into** the pool (deposits, repays).
- `to` — who receives tokens **out** of the pool (borrows, withdrawals).
- Usually all three are the same account: you.

Each `Request` is:

```
Request { request_type: u32, address: Address, amount: i128 }
```

- `address` — the reserve **asset contract** address (the SAC/SEP-41 token, a `C...`), not the pool.
- `amount` — in the asset's native decimals (e.g. 7 for most Stellar assets; read `decimals` to be sure).

### RequestType

This numbering is shared by Blend v1 and v2 (including the Supply/SupplyCollateral split) — confirm against [`blend-contracts-v2`](https://github.com/blend-capital/blend-contracts-v2) if in doubt:

| Value | Name | Action |
|-------|------|--------|
| 0 | Supply | Deposit to earn interest; **not** counted as collateral |
| 1 | Withdraw | Withdraw a plain Supply position |
| 2 | SupplyCollateral | Deposit **as collateral** (enables borrowing power) |
| 3 | WithdrawCollateral | Withdraw collateral |
| 4 | Borrow | Borrow an asset (creates a dToken liability) |
| 5 | Repay | Repay debt |
| 6 | FillUserLiquidationAuction | Fill a liquidation auction |
| 7 | FillBadDebtAuction | Fill a bad-debt auction (backstop) |
| 8 | FillInterestAuction | Fill an interest auction |
| 9 | DeleteLiquidationAuction | Cancel an auction |

So: **supply as collateral → 2**, **borrow → 4**, **repay → 5**, **withdraw collateral → 3**.

The CLI accepts complex arguments as JSON. Each example below sets `POOL` and `ASSET` (a reserve asset address for that pool — discover them with the [reserve list](#reading-pool-state)) and `ME` (your wallet key alias).

## Supply collateral

```bash
POOL=<POOL_CONTRACT>
ASSET=<RESERVE_ASSET_C...>     # e.g. the USDC SAC
ME=alice                       # wallet key alias

# amount is in the asset's native units; 100 units of a 7-decimal asset = 1000000000
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":2,"address":"'"$ASSET"'","amount":"1000000000"}]'
```

The pool pulls the asset from `spender` via authorization; the CLI collects and signs the required auth entries during simulation. `spender` needs a balance of `ASSET` (and, for a classic asset, a trustline — see the [wallet skill](../../wallet/SKILL.md)).

## Borrow

You can only borrow up to your collateral's borrowing power (collateral value × collateral factor); exceeding it fails simulation with contract error `#1205`. Borrow sends the asset to `to` — if the asset is a classic-asset SAC (e.g. USDC), `to` needs a **trustline** first (`stellar tx new change-trust --line <CODE:ISSUER>`; get the `CODE:ISSUER` string from the token's `name()`):

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":4,"address":"'"$ASSET"'","amount":"500000000"}]'
```

## Repay

Repay pulls the asset from `spender`. To fully repay, pass an `amount` larger than the debt — the pool pulls the full amount and refunds the excess to `spender` in the same transaction, so `spender` needs a balance covering the full amount you pass:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":5,"address":"'"$ASSET"'","amount":"500000000"}]'
```

## Withdraw collateral

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":3,"address":"'"$ASSET"'","amount":"1000000000"}]'
```

Withdrawal is blocked if it would drop your position below the required collateralization while you hold debt. Passing an amount larger than your balance withdraws the full balance — so to fully exit a reserve, pass an oversized amount.

## Batching requests atomically

One `submit` can carry multiple `Request`s that execute in order and settle atomically — either all succeed or the transaction reverts. Deposit collateral and borrow against it in a single call:

```bash
COLLATERAL=<C...>   # asset to supply as collateral
BORROW=<C...>       # asset to borrow

stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[
    {"request_type":2,"address":"'"$COLLATERAL"'","amount":"2000000000"},
    {"request_type":4,"address":"'"$BORROW"'","amount":"500000000"}
  ]'
```

## Discovering pools

Pools are created by the Pool Factory; enumerate them over RPC. The factory records deployed pools — inspect its interface for the exact getter, then read the list:

```bash
POOL_FACTORY=CDSYOAVXFY7SM5S64IZPPPYB4GVGGLMQVFREPSQQEZVIWXX5R23G4QSU   # mainnet (v2)
stellar contract info interface --id "$POOL_FACTORY" --network "$NETWORK"

# The v2 factory exposes only deploy(...) and is_pool(pool_address) -> bool — no list getter.
stellar contract invoke --id "$POOL_FACTORY" --source "$ME" --network "$NETWORK" -- is_pool --pool_address <POOL>
```

Since there is no list getter, enumerate pool-creation events from RPC (`getEvents` on the factory contract) — still RPC-only, no indexer. See the [data skill](../../data/SKILL.md) for the `getEvents` pattern. The [backstop reward zone](backstop.md#reading-backstop-state) is also a practical source of active pool addresses.

## Reading pool state

All reads simulate; nothing is signed or submitted, but the CLI still requires `--source-account` (any funded key) to build the simulation.

```bash
# Pool config: oracle, backstop take rate, status, max positions
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" -- get_config

# Reserve list: the asset addresses this pool supports
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" -- get_reserve_list

# One reserve: Reserve { asset, config: ReserveConfig, data: ReserveData, scalar }
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" -- get_reserve --asset "$ASSET"

# A user's positions: collateral / liabilities / supply, keyed by reserve index
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" -- get_positions --address "$(stellar keys address "$ME")"
```

Key fields you will read:

- **`PoolConfig`** — `oracle` (price source), `bstop_rate` (fraction of interest routed to the backstop), `status`, `max_positions`, `min_collateral`.
- **`ReserveConfig`** — `decimals`, `c_factor` (collateral factor), `l_factor` (liability factor), the kinked interest-rate curve (`r_base`, `r_one`, `r_two`, `r_three`, `util`, `max_util`, `reactivity`), `supply_cap`, `enabled`, `index`.
- **`ReserveData`** — `b_rate` / `d_rate` (supply/borrow indexes), `b_supply` / `d_supply` (total b/d tokens), `ir_mod`, `backstop_credit`, `last_time`.
- **`Positions`** — `collateral`, `liabilities`, `supply` maps keyed by reserve index.

Convert shares to underlying with the rate index: underlying supply = `bToken_balance × b_rate / 1e12`; underlying debt = `dToken_balance × d_rate / 1e12`. `b_rate` / `d_rate` are 12-decimal fixed-point (`SCALAR_12`); the result is in the asset's native decimals.

## Emissions: check, project, claim

Suppliers and borrowers accrue BLND emissions per reserve **side**. Each reserve has two emission streams, identified by a `reserve_token_id`:

- **borrow side** (dTokens / liabilities): `reserve_index × 2`
- **supply side** (bTokens / supply + collateral): `reserve_index × 2 + 1`

`reserve_index` is `ReserveConfig.index` from `get_reserve`. Not every stream is funded — `get_reserve_emissions` returns `None` (void) for streams with no emissions configured.

### Check accrued emissions

```bash
# The stream itself: eps (BLND/sec — 14 total decimals: BLND's 7 + a 7-decimal scalar), index, expiration
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" \
  -- get_reserve_emissions --reserve_token_index 1

# Your accrued-but-unclaimed BLND on that stream: UserEmissionData { accrued, index }
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" \
  -- get_user_emissions --user "$(stellar keys address "$ME")" --reserve_token_index 1
```

`accrued` only updates when your position is touched, so BLND earned since your last interaction isn't in it. For the exact claimable total, **simulate the claim**: run it with `--send=no` and read the returned amount without submitting anything:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no \
  -- claim --from "$ME" --reserve_token_ids '[0,1]' --to "$ME"
```

### Claim

Same call submitted for real — `claim(from, reserve_token_ids, to)` transfers the BLND to `to`:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- claim \
  --from "$ME" \
  --reserve_token_ids '[0,1]' \
  --to "$ME"
```

Backstop emissions are separate — see [backstop.md](backstop.md#claim-backstop-emissions).

## Projected earnings

A position earns (or costs) from two streams; every input below is read over RPC via `get_reserve`, `get_config`, and the emission getters.

**1. Interest.** Borrowers pay the reserve's borrow rate; the backstop takes a `bstop_rate` cut and suppliers split the rest, so:

```
utilization  = (d_supply × d_rate) / (b_supply × b_rate)      # underlying borrowed / supplied
supply_rate  ≈ borrow_rate × utilization × (1 − bstop_rate)   # bstop_rate is 7-decimal fixed point
```

`borrow_rate` comes from the reserve's kinked curve — `r_base` plus the `r_one`/`r_two`/`r_three` slopes around target `util`, scaled by the live `ir_mod` modifier (see `pool/src/pool/interest.rs` in [`blend-contracts-v2`](https://github.com/blend-capital/blend-contracts-v2)). Projected yearly interest ≈ `your_supplied_underlying × supply_rate` (or `your_debt × borrow_rate` on the cost side).

**2. BLND emissions.** Your share of a stream is proportional to your b/dTokens over the side's total:

```
your_blnd_per_year = (eps / 1e14) × 31,536,000 × (your_b_or_d_tokens / total_b_or_d_supply)
```

The `1e14` is BLND's 7 decimals plus an extra 7-decimal scalar baked into `eps`; the result is whole BLND.

Check the stream's `expiration` — emissions stop when it lapses (streams refresh via `gulp_emissions` while the pool is in the [reward zone](backstop.md#reading-backstop-state)). Note only 30% of a pool's emission allocation flows to pool users, split across reserve sides by pool config; the other 70% goes to backstop depositors.

To express BLND earnings in USD, read the BLND price from the Comet LP (pool oracles list only the pool's reserve assets, so they usually can't price BLND). `LP_TOKEN`, `BLND`, and `USDC` come from [deriving contracts on-chain](SKILL.md#derive-the-rest-on-chain):

```bash
# BLND price in USDC — 7-decimal fixed point, e.g. "3008070" = 0.30 USDC per BLND
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" \
  -- get_spot_price --token_in "$USDC" --token_out "$BLND"
```

To price a reserve asset in USD (the interest side), use the pool's oracle (`PoolConfig.oracle` from `get_config`, SEP-40). The `Asset` argument is an enum — pass it as JSON:

```bash
# Returns PriceData { price, timestamp }; scale price by the oracle's decimals() (typically 7)
stellar contract invoke --id "$ORACLE" --source "$ME" --network "$NETWORK" \
  -- lastprice --asset '{"Stellar":"'"$ASSET"'"}'
```
