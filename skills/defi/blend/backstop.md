# Blend backstop: deposit, Q4W, withdraw, claim

The backstop is Blend's insurance layer. Depositors stake the **backstop token** — a Comet 80/20 BLND:USDC LP token `[VERIFY weights]` — behind a specific pool. In return they earn a share of that pool's interest plus BLND emissions. In exchange, backstop capital is **first-loss**: it absorbs bad debt before lenders take a hit. That risk is why exits are time-locked (see [Q4W](#queue-for-withdrawal-q4w)).

Everything here targets the Backstop contract:

```bash
BACKSTOP=CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3   # mainnet
NETWORK=mainnet
ME=alice
POOL=<POOL_CONTRACT>       # the pool you are backstopping

stellar contract info interface --id "$BACKSTOP" --network "$NETWORK"   # confirm the ABI
```

You deposit the **backstop token**, not BLND or USDC directly. Get its address from the backstop, then acquire/mint the LP token via its Comet pool before depositing:

```bash
# [VERIFY getter name]
stellar contract invoke --id "$BACKSTOP" --network "$NETWORK" -- backstop_token
```

## Deposit

`[VERIFY signature]` — deposits backstop LP tokens behind a pool, minting backstop shares:

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

`[VERIFY]` timelock duration — believed to be **21 days** (confirm the `Q4W_LOCK_TIME` constant in [`blend-contracts`](https://github.com/blend-capital/blend-contracts)).

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

Claim accrued BLND across one or more pools you backstop `[VERIFY signature]`:

```bash
stellar contract invoke --id "$BACKSTOP" --source "$ME" --network "$NETWORK" --send=yes \
  -- claim \
  --from "$ME" \
  --pool_addresses '["'"$POOL"'"]' \
  --to "$ME"
```

## Reading backstop state

All reads simulate; no signing, no indexer. `[VERIFY]` getter names against source:

```bash
# Total backstop size for a pool: shares, LP tokens, and queued-for-withdrawal amount
stellar contract invoke --id "$BACKSTOP" --network "$NETWORK" -- pool_balance --pool_address "$POOL"

# Your balance for a pool: shares + your Q4W entries (each with amount + expiration)
stellar contract invoke --id "$BACKSTOP" --network "$NETWORK" \
  -- user_balance --pool_address "$POOL" --user "$(stellar keys address "$ME")"

# The backstop LP token address (Comet BLND:USDC)
stellar contract invoke --id "$BACKSTOP" --network "$NETWORK" -- backstop_token
```

- **`PoolBalance`** — `shares`, `tokens` (LP tokens deposited), `q4w` (queued amount).
- **`UserBalance`** — `shares`, `q4w: Vec<Q4W { amount, exp }>` where `exp` is the unlock ledger timestamp.

## Find the most profitable backstop

Backstop yield for a pool comes from two streams, both measured against the pool's total backstop deposit value:

1. **Interest share** — the pool routes a fraction of borrower interest (`PoolConfig.bstop_rate`) to the backstop. Scales with borrow volume × borrow APR × `bstop_rate`.
2. **BLND emissions** — the Emitter streams BLND to reward-zone pools, split by backstop size and (within a pool) between the backstop and reserve suppliers/borrowers. `[VERIFY]` the exact split and reward-zone rules — v1 and v2 differ; do not hardcode percentages.

Approximate backstop APR:

```
APR ≈ (annualized_interest_share_USD + annualized_emissions_USD) / backstop_deposit_value_USD
```

The following script ranks pools by an approximate backstop APR using **RPC only**. It is a scaffold: it reads the real on-chain inputs and shows where each number comes from; the final APR math carries `[VERIFY]` flags because the emission split and LP-token valuation must be confirmed against source before trusting the ranking for real capital.

```bash
#!/usr/bin/env bash
# rank-backstops.sh — approximate backstop APR per Blend pool, RPC only.
# Requires: stellar-cli, jq. Usage: NETWORK=mainnet ./rank-backstops.sh
set -euo pipefail

NETWORK=${NETWORK:-mainnet}
BACKSTOP=${BACKSTOP:-CAO3AGAMZVRMHITL36EJ2VZQWKYRPWMQAPDQD5YEOF3GIF7T44U4JAL3}

invoke() { stellar contract invoke --id "$1" --network "$NETWORK" -- "${@:2}"; }

# 1. Get the candidate pools. The reward zone is the practical source of active,
#    emission-eligible pools. [VERIFY getter name: reward_zone / get_rz]
pools=$(invoke "$BACKSTOP" reward_zone | jq -r '.[]')

echo "pool,backstop_tokens,bstop_rate,note"
for POOL in $pools; do
  # 2. Backstop size (APR denominator): LP tokens deposited for this pool.
  bal=$(invoke "$BACKSTOP" pool_balance --pool_address "$POOL")
  tokens=$(echo "$bal" | jq -r '.tokens // .["1"] // "0"')   # [VERIFY field name]

  # 3. Interest-share input: the pool's backstop take rate.
  cfg=$(invoke "$POOL" get_config)
  bstop_rate=$(echo "$cfg" | jq -r '.bstop_rate // "0"')      # [VERIFY field name]

  # 4. To finish the APR you still need, per pool:
  #    - sum over reserves of (d_supply * d_rate * borrow_rate) * bstop_rate  -> interest to backstop
  #    - BLND emitted/sec allocated to this pool's backstop (from emission config) -> annualized
  #    - LP-token -> USD via the Comet pool reserves + oracle prices
  #    These require reading get_reserve per asset and the emission config. [VERIFY]
  echo "$POOL,$tokens,$bstop_rate,partial-see-VERIFY"
done
```

To complete the APR, add per-pool reserve reads (`get_reserve --asset <asset>` for `d_supply`, `d_rate`, and the current borrow rate — see [lending.md](lending.md#reading-pool-state)), the emission-config read for BLND/sec to the backstop, and an LP-token-to-USD conversion (Comet reserve balances + BLND/USDC oracle prices). Rank pools by the resulting APR. Every dynamic input above is read over RPC — no indexer.

## Related

- Supplying/borrowing in the pools you backstop → [lending.md](lending.md)
- Keys, signing, submission, and reading token balances → [`../../wallet/SKILL.md`](../../wallet/SKILL.md)
- The `getEvents` RPC pattern for enumerating pools → [`../../data/SKILL.md`](../../data/SKILL.md)
