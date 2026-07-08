# Blend lending: supply, borrow, repay, withdraw

Every lending action on a Blend pool goes through a single entrypoint: **`submit`**. You describe what you want as a list of `Request`s, and the pool executes them atomically against your position. Supplying, borrowing, repaying, and withdrawing are all just different `RequestType`s in that list.

Read the pool's real interface before you build anything:

```bash
stellar contract info interface --id <POOL_CONTRACT> --network "$NETWORK"
```

## The `submit` model

`[VERIFY]` signature against [`blend-contracts`](https://github.com/blend-capital/blend-contracts); arg order/names are from the contract design:

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

`[VERIFY]` numbering against source — the Supply/SupplyCollateral split is a v2 feature and v1 may number differently:

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

You can only borrow up to your collateral's borrowing power (collateral value × collateral factor). Borrow sends the asset to `to`:

```bash
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- submit \
  --from "$ME" --spender "$ME" --to "$ME" \
  --requests '[{"request_type":4,"address":"'"$ASSET"'","amount":"500000000"}]'
```

## Repay

Repay pulls the asset from `spender`. To fully repay, pass an `amount` larger than the debt — Blend caps it at the outstanding balance `[VERIFY over-repay behavior]`; prefer reading the exact liability from [positions](#reading-pool-state) first:

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

Withdrawal is blocked if it would drop your position below the required collateralization while you hold debt.

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

Pools are created by the Pool Factory; enumerate them over RPC (no indexer). The factory records deployed pools — inspect its interface for the exact getter, then read the list:

```bash
POOL_FACTORY=CBP7NO6F7FRDHSOFQBT2L2UWYIZ2PU76JKVRYAQTG3KZSQLYAOKIF2WB   # mainnet
stellar contract info interface --id "$POOL_FACTORY" --network "$NETWORK"

# The factory exposes an is-pool check; some deployments also expose a list.
# [VERIFY getter names against source: e.g. is_pool(address) / deployed pools event history]
```

`[VERIFY]` The Pool Factory tracks deployment via `deploy` events and an `is_pool` check rather than always exposing a full list getter. Where no list getter exists, enumerate pool-creation events from RPC (`getEvents` on the factory contract) — still RPC-only, no indexer. See the [data skill](../../data/SKILL.md) for the `getEvents` pattern. The [backstop reward zone](backstop.md#reading-backstop-state) is also a practical source of active pool addresses.

## Reading pool state

All reads simulate; no signing. Inspect the interface first (`stellar contract info interface --id "$POOL"`), then call the getters. `[VERIFY]` getter names below:

```bash
# Pool config: oracle, backstop take rate, status, max positions
stellar contract invoke --id "$POOL" --network "$NETWORK" -- get_config

# Reserve list: the asset addresses this pool supports
stellar contract invoke --id "$POOL" --network "$NETWORK" -- get_reserve_list

# One reserve's config + live data (rates, totals, utilization)
stellar contract invoke --id "$POOL" --network "$NETWORK" -- get_reserve --asset "$ASSET"

# A user's positions: collateral / liabilities / supply, keyed by reserve index
stellar contract invoke --id "$POOL" --network "$NETWORK" -- get_positions --user "$(stellar keys address "$ME")"
```

Key fields you will read:

- **`PoolConfig`** — `oracle` (price source), `bstop_rate` (fraction of interest routed to the backstop), `status`, `max_positions`.
- **`ReserveConfig`** — `decimals`, `c_factor` (collateral factor), `l_factor` (liability factor), the kinked interest-rate curve (`r_base`, `r_one`, `r_two`, `r_three`, `util`), `supply_cap` (v2), `enabled`.
- **`ReserveData`** — `b_rate` / `d_rate` (supply/borrow indexes), `b_supply` / `d_supply` (total b/d tokens), `ir_mod`, `backstop_credit`, `last_time`.
- **`Positions`** — `collateral`, `liabilities`, `supply` maps keyed by reserve index.

Convert shares to underlying with the rate index: underlying supply ≈ `bToken_balance × b_rate`; underlying debt ≈ `dToken_balance × d_rate` `[VERIFY scaling/decimals]`.

## Claim lender emissions

Suppliers and borrowers accrue BLND emissions, claimed from the pool `[VERIFY signature]`:

```bash
# reserve_token_ids identify which reserve emission streams to claim (supply/borrow sides)
stellar contract invoke --id "$POOL" --source "$ME" --network "$NETWORK" --send=yes \
  -- claim \
  --from "$ME" \
  --reserve_token_ids '[0,1]' \
  --to "$ME"
```

Backstop emissions are separate — see [backstop.md](backstop.md#claim-backstop-emissions).
