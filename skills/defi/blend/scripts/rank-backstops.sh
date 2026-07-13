#!/usr/bin/env bash
# rank-backstops.sh — approximate backstop APR per Blend pool, RPC only.
# Requires: stellar-cli, jq, a funded key alias (reads simulate but need a source account).
# Usage: NETWORK=testnet SOURCE=alice ./rank-backstops.sh
#        NETWORK=mainnet SOURCE=alice ./rank-backstops.sh   (needs `stellar network add mainnet` first)
set -euo pipefail

NETWORK=${NETWORK:-testnet}
SOURCE=${SOURCE:?set SOURCE to a funded key alias}

# Blend v2 backstop per network; pass BACKSTOP explicitly to override.
if [[ -z "${BACKSTOP:-}" ]]; then
  case "$NETWORK" in
    mainnet) BACKSTOP=CAQQR5SWBXKIGZKPBZDH3KM5GQ5GUTPKB7JAFCINLZBC5WXPJKRG3IM7 ;;
    testnet) BACKSTOP=CBDVWXT433PRVTUNM56C3JREF3HIZHRBA64NB2C3B2UNCKIS65ZYCLZA ;;
    *) echo "error: no default backstop for NETWORK=$NETWORK — set BACKSTOP=C..." >&2; exit 1 ;;
  esac
fi

# Errors surface on stderr; --send=no keeps every call a pure read.
invoke() { stellar contract invoke --id "$1" --source "$SOURCE" --network "$NETWORK" --send=no -- "${@:2}"; }

# 1. Get the candidate pools. The reward zone is the practical source of active,
#    emission-eligible pools (see lending.md "Discovering pools").
pools=$(invoke "$BACKSTOP" reward_zone | jq -r '.[]')
if [[ -z "$pools" ]]; then
  echo "error: reward_zone returned no pools on $NETWORK (backstop $BACKSTOP)" >&2
  exit 1
fi

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
  #      (borrow_rate: compute from get_reserve fields with the formula in
  #       lending.md "The borrow rate")
  #    - backstop BLND/sec: no direct getter, but pool-side streams are readable —
  #      sum get_reserve_emissions eps over the pool's reserve sides, then
  #      backstop_eps = pool_eps_sum * 70/30
  #    - LP-token -> USD: token_spot_price from pool_data
  echo "$POOL,$tokens,$bstop_rate,partial"
done
