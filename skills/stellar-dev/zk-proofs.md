# Zero-Knowledge Proofs on Stellar (Status-Sensitive)

## When to use this guide
Use this guide when the user asks for:
- On-chain ZK proof verification patterns
- Privacy-preserving smart contract architecture
- BN254/Poseidon readiness planning
- Groth16 or PLONK integration strategy
- Cross-chain proof verification design

This guide is intentionally status-aware. ZK capabilities on Stellar evolve with protocol and SDK releases.

## Source-of-truth checks (required)
Before implementation, always verify:
1. CAP status in `stellar/stellar-protocol` (`Accepted`/`Implemented` vs draft/awaiting decision)
2. Target network protocol/software version
3. `soroban-sdk` support for required cryptographic host functions
4. Availability of production examples matching your proving system

Primary references:
- [CAP-0059](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0059.md) (BLS12-381)
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md) (BN254 proposal)
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) (Poseidon/Poseidon2 proposal)
- [Stellar protocol/software versions](https://developers.stellar.org/docs/networks/software-versions)
- [RPC providers](https://developers.stellar.org/docs/data/apis/rpc/providers)

## Capability model
Treat advanced cryptography as capability-gated:
- Capability A: proof verification primitive support
- Capability B: hash primitive support
- Capability C: SDK ergonomics and bindings
- Capability D: operational cost envelope

Do not assume all capabilities are present on all networks/environments.

## Architecture patterns

### 1) Verification gateway
Use a dedicated verifier contract (or module) for cryptographic checks:
- Normalize and validate inputs
- Enforce domain separation for statements
- Verify proof
- Emit explicit success/failure events

Benefits:
- Smaller audit surface
- Easier upgrades/migrations
- Cleaner operational telemetry

### 2) Policy-and-proof split
Separate concerns:
- `Verifier`: cryptographic validity only
- `Policy`: business/risk/compliance logic
- `Application`: state transition after verifier + policy pass

Benefits:
- Better testability
- Safer upgrades
- Clearer incident response

### 3) Feature flags and graceful fallback
Gate advanced paths by environment support:
- Enable ZK flows only where required primitives are verified available
- Keep deterministic fallback behavior for unsupported environments
- Document supported network/protocol matrix in deployment notes

## Integration checklist
- [ ] Target network supports required primitives
- [ ] SDK pin supports required APIs
- [ ] Proof statement includes anti-replay binding (nonce/context)
- [ ] Full simulation path is covered (proof + policy + state transition)
- [ ] Negative-path tests exist for malformed/tampered inputs
- [ ] Resource budget checks are documented for realistic proof sizes
- [ ] Security review documents all cryptographic assumptions

## Common pitfalls

### Over-trusting proof payload shape
A payload that parses is not equivalent to a valid statement for your application.

Mitigation:
- Validate public-input semantics and statement domain explicitly.

### Missing anti-replay controls
Valid proofs can be replayed without context binding.

Mitigation:
- Bind proofs to session/nonce/action scope and persist replay guards.

### Monolithic contract design
Combining verifier, policy, and state logic increases audit complexity.

Mitigation:
- Keep verifier logic isolated and narrow.

### Hardcoded protocol assumptions
Assuming primitive availability across all networks causes runtime failures.

Mitigation:
- Capability-gate and verify at deployment time.

## Testing strategy

### Unit tests
- Input domain validation
- Replay protection behavior
- Event correctness

### Integration tests
- End-to-end proof submission flow
- Negative cases: tampered input, stale nonce, unsupported feature path
- Network-configuration differences (local/testnet/mainnet)

### Operational tests
- Cost/resource envelope under realistic proof sizes
- Load behavior on verifier hot paths
- Upgrade/migration safety tests for verifier changes

## Security review focus
- Authorization and anti-replay guarantees
- Statement domain separation
- Upgrade controls around verifier/policy modules
- Denial-of-service resistance and bounded workloads
- Event/log coverage for forensic traceability

## Example starting points
- [Soroban examples](https://github.com/stellar/soroban-examples)
- [Groth16 verifier example](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier)
- [Security guide](security.md)
- [Advanced patterns](advanced-patterns.md)
- [Standards reference](standards-reference.md)

## What not to do
- Do not claim specific primitives are production-ready without checking CAP status and network support.
- Do not hardcode draft-spec behavior as guaranteed runtime behavior.
- Do not skip simulation and negative-path testing for verifier flows.
