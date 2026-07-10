#!/usr/bin/env bash
# rank-backstops.sh — approximate backstop APR per Blend pool, RPC only.
# Requires: stellar-cli, jq, a funded key alias (reads simulate but need a source account).
# Usage: NETWORK=mainnet SOURCE=alice ./rank-backstops.sh
set -euo pipefail

NETWORK=${NETWORK:-mainnet}
BACKSTOP=${BACKSTOP:-CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7}
SOURCE=${SOURCE:?set SOURCE to a funded key alias}

invoke() { stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" -- "${@:2}" 2>/dev/null; }

# 1. Get the candidate pools. The reward zone is the practical source of active,
#    emission-eligible pools.
pools=$(invoke "$BACKSTOP" reward_zone | jq -r '.[]')

echo "pool,backstop_tokens,bstop_rate,note"
for POOL in $pools; do
  # 2. Backstop size (APR denominator): LP tokens deposited for this pool.
  #    pool_data also returns token_spot_price for LP -> USD conversion.
  bal=$(invoke "$BACKSTOP" pool_data --pool "$POOL")
  tokens=$(echo "$bal" | jq -r '.tokens // "0"')

  # 3. Interest-share input: the pool's backstop take rate.
  cfg=$(invoke "$POOL" get_config)
  bstop_rate=$(echo "$cfg" | jq -r '.bstop_rate // "0"')

  # 4. To finish the APR you still need, per pool:
  #    - sum over reserves of (d_supply * d_rate * borrow_rate) * bstop_rate  -> interest to backstop
  #    - backstop BLND/sec: no direct getter, but pool-side streams are readable —
  #      sum get_reserve_emissions eps over the pool's reserve sides, then
  #      backstop_eps = pool_eps_sum * 70/30
  #    - LP-token -> USD: token_spot_price from pool_data
  echo "$POOL,$tokens,$bstop_rate,partial"
done
