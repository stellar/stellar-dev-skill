# Blend backstop: deposit, Q4W, withdraw, claim

## Contents

- [Deposit](#deposit)
- [Queue for withdrawal (Q4W)](#queue-for-withdrawal-q4w)
- [Claim backstop emissions](#claim-backstop-emissions)
- [Reading backstop state](#reading-backstop-state)
- [Find the most profitable backstop](#find-the-most-profitable-backstop) (incl. `scripts/rank-backstops.sh`)

The backstop is Blend's insurance layer. Depositors stake the **backstop token** — a Comet 80/20 BLND:USDC LP token (confirm weights with the LP token's `get_normalized_weight`) — behind a specific pool. In return they earn a share of that pool's interest plus BLND emissions. In exchange, backstop capital is **first-loss**: it absorbs bad debt before lenders take a hit. That risk is why exits are time-locked (see [Q4W](#queue-for-withdrawal-q4w)).

Everything here targets the Backstop contract. `BACKSTOP`, `NETWORK`, and `ME` come from [network setup](SKILL.md#network-setup) (both networks' addresses are there):

```bash
POOL=<POOL_CONTRACT>       # the pool you are backstopping — see lending.md "Discovering pools"

stellar contract info interface --id "$BACKSTOP" --network "$NETWORK"   # confirm the ABI
```

You deposit the **backstop token**, not BLND or USDC directly. Get its address from the backstop, then mint LP tokens via the Comet pool — a single-sided join with USDC (or BLND) works and needs no second asset:

```bash
LP_TOKEN=$(stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no -- backstop_token | tr -d '"')

# Its underlying tokens, in weight order: [BLND, USDC]
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" --send=no -- get_tokens

# Single-sided join: deposit USDC into the Comet pool, receive LP tokens (returns the LP amount minted)
stellar contract invoke --id "$LP_TOKEN" --source "$ME" --network "$NETWORK" --send=yes \
  -- dep_tokn_amt_in_get_lp_tokns_out \
  --token_in <USDC_ADDRESS> --token_amount_in 100000000 --min_pool_amount_out 0 --user "$ME"
```

If all you hold is XLM, you can't join the Comet pool directly — first obtain USDC (or BLND) by **borrowing it against XLM collateral** ([lending.md](lending.md)) or swapping via a DEX path payment; make sure it's the *right* USDC (`name()` — see [getting assets](SKILL.md#getting-the-assets-these-flows-assume)).

## Deposit

`deposit(from, pool_address, amount)` deposits backstop LP tokens behind a pool, minting backstop shares:

```bash
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- deposit \
  --from "$ME" \
  --pool_address "$POOL" \
  --amount "1000000000"
```

Shares represent your claim on that pool's backstop; their value rises as the backstop accrues interest and falls if it absorbs bad debt.

## Queue for withdrawal (Q4W)

Backstop deposits are **not** instantly withdrawable — this stops depositors from fleeing right before a liquidation. To exit you queue, wait out the timelock, then withdraw. **While queued, the funds stay at risk** (they still absorb bad debt) and keep accruing.

The v2 timelock is **17 days** (v1 was 21): `queue_withdrawal` returns a `Q4W` whose `exp` is exactly 17 days out. Withdrawing before `exp` fails simulation with contract error `#1001` (`NotExpired`).

```bash
# Start the timelock on part of your position
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- queue_withdrawal \
  --from "$ME" --pool_address "$POOL" --amount "1000000000"

# Change your mind while still locked — return it to the active backstop
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- dequeue_withdrawal \
  --from "$ME" --pool_address "$POOL" --amount "1000000000"

# After the timelock elapses — withdraw the LP tokens
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- withdraw \
  --from "$ME" --pool_address "$POOL" --amount "1000000000"
```

Check whether a queued entry has unlocked before calling `withdraw` — read the user balance and compare each Q4W entry's expiration against the current ledger time (see [reading backstop state](#reading-backstop-state)).

## Claim backstop emissions

In v2, `claim(from, pool_addresses, min_lp_tokens_out)` does **not** pay BLND out to you — it converts the claimed BLND into backstop LP tokens and deposits them back behind the pools you claim from (auto-compound). `min_lp_tokens_out` is a slippage floor on that conversion; the call returns the LP tokens minted:

```bash
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- claim \
  --from "$ME" \
  --pool_addresses '["'"$POOL"'"]' \
  --min_lp_tokens_out "0"   # set a real floor for meaningful amounts
```

To preview what's claimable without submitting, simulate the same call with `--send=no` — the returned value is the LP tokens the claim would mint (use it to set a sensible `min_lp_tokens_out`).

## Reading backstop state

All reads simulate — pass `--send=no` so they stay reads even against archived state (see [reading Blend state](SKILL.md#reading-blend-state-over-rpc)); no indexer.

```bash
# Total backstop data for a pool: shares, LP tokens, queued %, and LP spot price
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no -- pool_data --pool "$POOL"

# Your balance for a pool: shares + your Q4W entries (each with amount + expiration)
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no \
  -- user_balance --pool "$POOL" --user "$(stellar keys address "$ME")"

# The backstop LP token address (Comet BLND:USDC)
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=no -- backstop_token
```

- **`PoolBackstopData`** — `shares`, `tokens` (LP tokens deposited), `q4w_pct` (fraction of shares queued for withdrawal, **7-decimal** fixed point: `3333334` ≈ 33%), `blnd` / `usdc` (underlying amounts), `token_spot_price` (LP token spot price — useful for USD conversion).
- **`UserBalance`** — `shares`, `q4w: Vec<Q4W { amount, exp }>` where `exp` is the unlock time as a **unix timestamp** (seconds) — compare against the latest ledger's close time.

## Find the most profitable backstop

Backstop yield for a pool comes from two streams, both measured against the pool's total backstop deposit value:

1. **Interest share** — the pool routes a fraction of borrower interest (`PoolConfig.bstop_rate`) to the backstop. Scales with borrow volume × borrow APR × `bstop_rate`.
2. **BLND emissions** — the Emitter streams BLND to the backstop, which distributes it across reward-zone pools in proportion to non-queued backstop size. Within a pool's allocation, **70% goes to backstop depositors and 30% to pool users**.

Approximate backstop APR:

```
APR ≈ (annualized_interest_share_USD + annualized_emissions_USD) / backstop_deposit_value_USD
```

Your own projected earnings are pro-rata: `(your user_balance.shares / pool_data.shares) × the pool-level totals above`. For already-accrued (unclaimed) emissions, simulate `claim` with `--send=no` — see [claiming](#claim-backstop-emissions).

The bundled script [`scripts/rank-backstops.sh`](scripts/rank-backstops.sh) ranks pools by an approximate backstop APR using **RPC only**. It is a scaffold: it reads the real on-chain inputs and shows where each number comes from (its comments walk through each step); finishing the APR still requires the per-reserve reads sketched in the script's step 4. Requires stellar-cli, jq, and a funded key alias. It knows the v2 backstop for testnet and mainnet (override with `BACKSTOP=` for anything else; mainnet needs an [RPC configured](SKILL.md#network-setup) first). Run it:

```bash
NETWORK=testnet SOURCE=alice scripts/rank-backstops.sh
```

Output is CSV: `pool,backstop_tokens,bstop_rate,note`, one row per reward-zone pool.

To complete the APR, add per-pool reserve reads (`get_reserve --asset <asset>` for `d_supply` and `d_rate`, then compute the borrow rate with [the borrow-rate formula](lending.md#the-borrow-rate)), the pool-side emission reads (`get_reserve_emissions` per reserve side, scaled by 70/30 to get the backstop's BLND/sec — see [projected earnings](lending.md#projected-earnings)), and an LP-token-to-USD conversion (`token_spot_price` from `pool_data`). Rank pools by the resulting APR.

## Related

- Supplying/borrowing in the pools you backstop; discovering pools → [lending.md](lending.md)
- Keys, signing, submission, and reading token balances → [`../../wallet/SKILL.md`](../../wallet/SKILL.md)
- Reading chain data over RPC → [`../../data/SKILL.md`](../../data/SKILL.md)
