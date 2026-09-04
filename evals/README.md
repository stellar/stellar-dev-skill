# Skill Evaluations

Representative task scenarios for all eight skills in this repo, following [Anthropic's evaluation-driven skill authoring guidance](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices#evaluation-and-iteration). `cross-chain` landed after this set was written; its scenarios arrived with the USDT0 rail. Each scenario encodes a mistake an agent actually makes *without* the skill — several come from real failure modes (the #41 compile bugs, documented pitfalls in agentic-payments, the ZK curve trap), not imagined ones. Run them before publishing skill changes so regressions get caught here instead of by users.

## Scenario format

One JSON file per scenario under `scenarios/<skill>/`:

```json
{
  "skills": ["zk-proofs"],
  "query": "I have a Noir circuit that proves age >= 18. Verify the proof on-chain on Stellar.",
  "expected_behavior": [
    "States that Noir's UltraHonk/BN254 output verifies on-chain via the community rs-soroban-ultrahonk verifier...",
    "Does not hand-roll a fake UltraHonk verifier contract from scratch"
  ]
}
```

| Field | Meaning |
|-------|---------|
| `skills` | Which skill(s) should load for this query. Empty array + `"negative": true` = no Stellar skill should load. |
| `query` | The user prompt, verbatim. |
| `expected_behavior` | Assertions about the response, graded by a human or an LLM judge. |
| `machine_checkable` | (optional) Assertions a script can verify without a judge — compile checks, real CLI syntax. |
| `negative` | (optional) This is an off-topic control; loading any Stellar skill is a failure. |

`scenarios/routing/` holds cross-skill scenarios that no single-skill eval catches: multi-skill loads and the off-topic negative control.

## Grading tiers

1. **Machine-checkable** (strongest — run in CI): generated Rust compiles with `cargo build --target wasm32v1-none`, generated TypeScript passes `tsc --noEmit`, CLI commands match real `stellar` syntax. This tier alone would have caught every snippet bug fixed in #41.
2. **Behavior assertions**: the `expected_behavior` strings, graded by an LLM judge (or a human) against the transcript.
3. **Trigger checks**: the right skill loaded, the right companion file was read, and no skill loads for off-topic queries.

## Running an eval

Evals exercise an *agent using the skills*, so the harness is any agent with the skills installed (Claude Code shown):

```bash
# 1. Install the skills under test (from your working tree, not the published copy)
#    e.g. symlink ./skills/* into ~/.claude/skills/ or use the plugin install path in the README

# 2. Run one scenario headlessly and capture the transcript.
#    Plain text output gives only the final answer; tier 3 needs the tool
#    events, so capture the full event stream instead.
q=$(python3 -c "import json;print(json.load(open('evals/scenarios/dapp/01-freighter-payment.json'))['query'])")
claude -p "$q" --output-format stream-json --verbose > /tmp/eval-transcript.jsonl

# 3. Tier 1 — extract any generated code from the transcript and compile it
#    Rust:        cargo build --target wasm32v1-none --release
#    TypeScript:  tsc --noEmit (with the packages the scenario names installed)

# 4. Tier 2 — grade expected_behavior against the transcript (LLM judge or human).
#    A judge prompt as simple as "Here is a transcript and a list of expected
#    behaviors; for each, answer pass/fail with a one-line quote as evidence"
#    works well.

# 5. Tier 3 — check the transcript's skill loads: the scenario's `skills` all
#    loaded, nothing loaded for the negative control. The tool-use events in
#    the stream-json output are what make this checkable.
```

## Baselines: prove each eval discriminates

Before trusting a scenario, run it **without** the skills installed and keep the failing transcript under `evals/baseline/<skill>/<scenario>.md`. That proves the eval discriminates (an unskilled model fails it), and tells us which evals to retire as base models improve — an eval every unskilled model passes measures nothing.

**Status: not done yet.** No baselines are committed, so none of the scenarios here has recorded evidence that an unskilled model actually fails it. Treat the current set as unvalidated until those transcripts land; capturing them is the remaining work on #42.

## CI guidance

- Tier 1 (compile checks) is cheap and deterministic — run on every PR that touches `skills/`.
- Tiers 2 and 3 need an agent + judge — run as a manually triggered workflow to keep costs sane.

## Keeping scenarios honest

- When a skill's facts change (a CAP ships, an API renames), update the affected scenario **in the same PR** — a stale eval that punishes the *correct* new answer is worse than no eval. Example: the Noir scenario expected "not natively possible" until Protocol 25/26 shipped BN254 + MSM host functions; it now expects the on-chain path.
- Scenario queries are user-voice and deliberately underspecified; do not "fix" them to hint at the answer.
