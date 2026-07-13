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

You can only borrow up to your collateral's borrowing power (collateral value × collateral factor); exceeding it fails simulation with contract error `#1205` (`InvalidHf`). Borrow sends the asset to `to` — if the asset is a classic-asset SAC (e.g. USDC), `to` needs a **trustline** first (`stellar tx new change-trust --line <CODE:ISSUER>`; get the `CODE:ISSUER` string from the token's `name()`).

There is also a **minimum position size**: `PoolConfig.min_collateral` (read it with [`get_config`](#reading-pool-state)) is the smallest **c_factor-adjusted** collateral value — *not* your raw collateral value — that may back a borrow position, denominated in the oracle's base asset at the oracle's `decimals()`. Falling below it fails with `#1224` (`MinCollateralNotMet`). The active mainnet reward-zone pools currently set a $5 floor; with XLM's `c_factor` at 0.75 that means roughly $6.70 worth of raw XLM collateral (a few tens of XLM) before you can borrow anything at all:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":4,"address":"'"$ASSET"'","amount":"500000000"}]'
```

## Repay

Repay pulls the asset from `spender`:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":5,"address":"'"$ASSET"'","amount":"500000000"}]'
```

### Fully closing a loan

Your debt is always **slightly more than what you borrowed** — dTokens round up at borrow, so debt exceeds the proceeds from the very same ledger (measured: 8 stroops over within minutes). That makes the two "obvious" full-repay moves both wrong when all you hold is the loan proceeds:

- Pass more than your balance → the pool pulls the **full amount before refunding**, and the transfer fails with `#10` (`BalanceError`).
- Pass exactly your balance → dust debt survives, and later blocks withdraw-all with `#1205` (any withdraw that leaves debt must stay healthy).

The working recipe:

1. **Get a small buffer (~5–10%) of the exact borrowed asset** — same `CODE:ISSUER`, check with `name()`. From XLM, use a DEX path payment: `stellar tx new path-payment-strict-receive` (see the [wallet skill](../../wallet/SKILL.md)).
2. **Repay with any `amount` between your debt and your balance** — over the debt so nothing survives, within your balance so the pull succeeds. The pool pulls only what's owed and refunds the excess to `spender` exactly, in the same transaction.

After the repay, `get_positions` should show no liability for the reserve — then withdraw-all works.

## Withdraw collateral

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":3,"address":"'"$ASSET"'","amount":"1000000000"}]'
```

Withdrawal is blocked (`#1205`) if it would drop your position below the required collateralization while you hold debt — including **dust debt** left by an inexact repay (see [fully closing a loan](#fully-closing-a-loan)). Passing an amount larger than your balance withdraws the full balance — so to fully exit a reserve, pass an oversized amount.

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

**Enumerate pools with `reward_zone()` on the Backstop.** It returns the list of active, emission-eligible pool addresses — which is what you want for supplying, borrowing, or yield analysis (`BACKSTOP` and `NETWORK` come from [network setup](SKILL.md#network-setup)):

```bash
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no -- reward_zone
```

On testnet this currently includes the blend-utils reference pool, ready to paste:

```bash
POOL=CCEBVDYM32YNYCVNRXQKDFFPISJJCV557CDZEIRBEE4NCV4KHPQ44HGF   # testnet (v2) "TestnetV2" pool
```

To check whether an arbitrary address is a genuine v2 pool (the factory exposes only `deploy(...)` and `is_pool` — no list getter):

```bash
stellar contract invoke --id "$POOL_FACTORY" --source "$ME" --network "$NETWORK" --send=no -- is_pool --pool_address <POOL>
```

Don't try to enumerate pools from the factory's deploy events: RPC keeps only ~7 days of events, and the deploys are long past — `getEvents` returns nothing. Pools outside the reward zone can only be found by address (from the user, [Blend's UI](https://mainnet.blend.capital), or an indexer).

## Reading pool state

All reads simulate — pass `--send=no` so they stay reads even against archived state (see [reading Blend state](SKILL.md#reading-blend-state-over-rpc)). The CLI still requires `--source-account` (any funded key) to build the simulation.

```bash
# Pool config: oracle, backstop take rate, status, max positions, min collateral
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no -- get_config

# Reserve list: the asset addresses this pool supports
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no -- get_reserve_list

# One reserve: Reserve { asset, config: ReserveConfig, data: ReserveData, scalar }
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no -- get_reserve --asset "$ASSET"

# A user's positions: collateral / liabilities / supply, keyed by reserve index
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no -- get_positions --address "$(stellar keys address "$ME")"
```

Key fields you will read:

- **`PoolConfig`** — `oracle` (price source), `bstop_rate` (fraction of interest routed to the backstop, 7-decimal fixed point), `status`, `max_positions`, `min_collateral` (minimum c_factor-adjusted collateral value to hold a borrow position, in the oracle's base asset at the oracle's `decimals()` — see [Borrow](#borrow)).
- **`PoolConfig.status`** — `0` Admin-Active, `1` Active, `2` Admin-On-Ice, `3` On-Ice, `4` Admin-Frozen, `5` Frozen, `6` Setup. Status > 1 disables borrowing; status > 3 also disables supplying (violations fail with `#1206`).
- **`ReserveConfig`** — `decimals`, `c_factor` (collateral factor), `l_factor` (liability factor), the kinked interest-rate curve (`r_base`, `r_one`, `r_two`, `r_three`, `util`, `max_util`, `reactivity` — all 7-decimal), `supply_cap`, `enabled`, `index`.
- **`ReserveData`** — `b_rate` / `d_rate` (supply/borrow indexes), `b_supply` / `d_supply` (total b/d tokens), `ir_mod` (rate modifier, **7-decimal** fixed point, clamped to [0.1, 10] — i.e. `1000000`–`100000000`), `backstop_credit`, `last_time`.
- **`Positions`** — `collateral`, `liabilities`, `supply` maps keyed by reserve index.

Convert shares to underlying with the rate index: underlying supply = `bToken_balance × b_rate / 1e12`; underlying debt = `dToken_balance × d_rate / 1e12`. `b_rate` / `d_rate` are 12-decimal fixed-point (`SCALAR_12`); the result is in the asset's native decimals.

### The borrow rate

The current borrow APR is computable from `ReserveConfig` + `ReserveData` alone (all inputs and the result are 7-decimal fixed point; `util` here is current utilization, `target` is `ReserveConfig.util`):

```
util ≤ target:          rate = (r_base + r_one × util/target) × ir_mod
target < util ≤ 0.95:   rate = (r_base + r_one + r_two × (util − target)/(0.95 − target)) × ir_mod
util > 0.95:            rate = (r_base + r_one + r_two) × ir_mod
                               + r_three × (util − 0.95)/0.05        # r_three leg is NOT scaled by ir_mod
```

with `utilization = (d_supply × d_rate) / (b_supply × b_rate)`. This is `calc_accrual` in `pool/src/pool/interest.rs` of [`blend-contracts-v2`](https://github.com/blend-capital/blend-contracts-v2), transcribed; check the source if in doubt.

## Emissions: check, project, claim

Suppliers and borrowers accrue BLND emissions per reserve **side**. Each reserve has two emission streams, identified by a `reserve_token_id`:

- **borrow side** (dTokens / liabilities): `reserve_index × 2`
- **supply side** (bTokens / supply + collateral): `reserve_index × 2 + 1`

`reserve_index` is `ReserveConfig.index` from `get_reserve`. Not every stream is funded — `get_reserve_emissions` returns `None` (void) for streams with no emissions configured.

### Check accrued emissions

```bash
# The stream itself: eps (BLND/sec — 14 total decimals: BLND's 7 + a 7-decimal scalar), index, expiration
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no \
  -- get_reserve_emissions --reserve_token_index 1

# Your accrued-but-unclaimed BLND on that stream: UserEmissionData { accrued, index }
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=no \
  -- get_user_emissions --user "$(stellar keys address "$ME")" --reserve_token_index 1
```

`accrued` only updates when your position is touched, so BLND earned since your last interaction isn't in it. For the exact claimable total, **simulate the claim**: run it with `--send=no` and read the returned amount without submitting anything.

> **Prerequisite:** `to` needs a **BLND trustline** before any claim — even this simulated preview reverts with `#13` (`TrustlineMissingError`) without one. See [prerequisites](SKILL.md#prerequisites) for deriving BLND and adding the trustline.

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

`borrow_rate` is computed from `ReserveConfig` + `ReserveData` with the formula in [the borrow rate](#the-borrow-rate). Projected yearly interest ≈ `your_supplied_underlying × supply_rate` (or `your_debt × borrow_rate` on the cost side).

**2. BLND emissions.** Your share of a stream is proportional to your b/dTokens over the side's total:

```
your_blnd_per_year = (eps / 1e14) × 31,536,000 × (your_b_or_d_tokens / total_b_or_d_supply)
```

The `1e14` is BLND's 7 decimals plus an extra 7-decimal scalar baked into `eps`; the result is whole BLND.

Check the stream's `expiration` — emissions stop when it lapses (streams refresh via `gulp_emissions` while the pool is in the [reward zone](backstop.md#reading-backstop-state)). Note only 30% of a pool's emission allocation flows to pool users, split across reserve sides by pool config; the other 70% goes to backstop depositors.

To express BLND earnings in USD, read the BLND price from the Comet LP (pool oracles list only the pool's reserve assets, so they usually can't price BLND). `LP_TOKEN`, `BLND`, and `USDC` come from [deriving contracts on-chain](SKILL.md#derive-the-rest-on-chain):

```bash
# BLND price in USDC — 7-decimal fixed point, e.g. "3008070" = 0.30 USDC per BLND
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" --send=no \
  -- get_spot_price --token_in "$USDC" --token_out "$BLND"
```

To price a reserve asset in USD (the interest side), use the pool's oracle (`PoolConfig.oracle` from `get_config`, SEP-40). The `Asset` argument is an enum — pass it as JSON:

```bash
# Returns PriceData { price, timestamp }; scale price by the oracle's decimals() (typically 7 or 14)
stellar contract invoke --id "$ORACLE" --source "$ME" --network "$NETWORK" --send=no \
  -- lastprice --asset '{"Stellar":"'"$ASSET"'"}'
```
