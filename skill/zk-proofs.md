# Zero-Knowledge Proofs on Stellar (Protocol 25 X-Ray)

Protocol 25 "X-Ray" (Mainnet January 22, 2026) introduced native ZK cryptographic primitives, enabling privacy-preserving applications on Stellar.

## When to Use ZK on Stellar

- **On-chain proof verification** — Verify zk-SNARK proofs (Groth16, PLONK, UltraHonk)
- **Privacy pools** — Prove lawful source of funds without revealing transaction history
- **Confidential tokens** — Hidden balances with validity proofs
- **ZK Merkle trees** — Efficient membership proofs using Poseidon hashes
- **Cross-chain bridges** — Verify state proofs from other chains
- **Compliance-forward privacy** — KYC/AML compliance with minimal data exposure
- **ZK Email** — Prove email contents without revealing the full email

## Prerequisites

```toml
# Cargo.toml
[dependencies]
soroban-sdk = "25.0.1"
```

Ensure your Stellar CLI and network target Protocol 25+.

---

## Core Primitives

### BN254 Elliptic Curve (CAP-0074)

BN254 (alt_bn128) is a pairing-friendly curve matching Ethereum's EIP-196/EIP-197 precompiles. This enables migration of existing EVM ZK applications.

#### Access Pattern

```rust
use soroban_sdk::{Env, BytesN};
use soroban_sdk::crypto::bn254::{Bn254, Bn254G1Affine, Bn254G2Affine, Fr, Bn254Fp};

pub fn zk_operations(env: &Env) {
    let bn254: Bn254 = env.crypto().bn254();

    // Use bn254.g1_add(), bn254.g1_mul(), bn254.pairing_check()
}
```

#### Types

| Type | Size | Description |
|------|------|-------------|
| `Bn254Fp` | 32 bytes | Base field element |
| `Fr` | 32 bytes | Scalar field element (U256 internally) |
| `Bn254G1Affine` | 64 bytes | G1 point (x, y coordinates) |
| `Bn254G2Affine` | 128 bytes | G2 point (extension field coordinates) |

#### Host Functions

```rust
// G1 Point Addition
// Combines two points on the G1 curve
let sum: Bn254G1Affine = bn254.g1_add(&p1, &p2);

// G1 Scalar Multiplication
// Multiplies a G1 point by a scalar
let product: Bn254G1Affine = bn254.g1_mul(&point, &scalar);

// Multi-Pairing Check (core of zk-SNARK verification)
// Returns true if: e(g1[0], g2[0]) × e(g1[1], g2[1]) × ... = 1
let valid: bool = bn254.pairing_check(g1_points, g2_points);
```

#### Encoding Format

Points use **uncompressed big-endian** encoding (no flag bits):

- **G1**: `be_encode(X) || be_encode(Y)` — 64 bytes
- **G2**: `be_encode(X_c1) || be_encode(X_c0) || be_encode(Y_c1) || be_encode(Y_c0)` — 128 bytes
- **Point at infinity**: All zeros

Field element max value: `0x30644e72e131a029b85045b68181585d97816a916871ca8d3c208c16d87cfd47`

---

### Poseidon Hash Functions (CAP-0075)

Poseidon is optimized for ZK circuits — ~300 constraints vs ~27,000 for SHA-256. Essential for efficient Merkle trees and commitments in ZK applications.

#### Host Functions

The Poseidon functions expose the raw permutation primitive, requiring you to specify all parameters:

```rust
use soroban_sdk::{Env, Vec, U256, Symbol};

pub fn poseidon_example(env: &Env, inputs: Vec<U256>) -> U256 {
    // Poseidon permutation
    // Parameters: input, field_type, state_size, sbox_degree, full_rounds, partial_rounds, mds_matrix, round_constants
    let result = env.crypto().poseidon_permutation(
        inputs,
        0,           // 0 = BLS12-381 Fr, 1 = BN254 Fr
        3,           // state size (t)
        5,           // S-box degree (d)
        8,           // full rounds (must be even)
        22,          // partial rounds
        mds_matrix,  // t×t MDS matrix
        round_constants,
    );
    result.get(0).unwrap()
}
```

#### Field Types

| Field ID | Curve | Order |
|----------|-------|-------|
| 0 | BLS12-381 Fr | `0x73eda753299d7d483339d80809a1d80553bda402fffe5bfeffffffff00000001` |
| 1 | BN254 Fr | `0x30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001` |

#### Poseidon2 Variant

Poseidon2 uses optimized diagonal matrices instead of full MDS:

```rust
let result = env.crypto().poseidon2_permutation(
    inputs,
    1,                    // BN254 field
    3,                    // state size
    5,                    // S-box degree (also supports 3, 7, 11)
    8,                    // full rounds
    22,                   // partial rounds
    internal_diagonal,    // diagonal matrix (not full MDS)
    round_constants,
);
```

---

## Groth16 Verification Pattern

Groth16 is the most common zk-SNARK proof system. Verification uses the pairing equation:

```
e(A, B) = e(α, β) × e(L, γ) × e(C, δ)
```

Where:
- `(A, B, C)` = proof elements
- `(α, β, γ, δ)` = verification key
- `L` = linear combination of public inputs

### Verification Contract Structure

```rust
use soroban_sdk::{contract, contractimpl, Env, Vec, BytesN};
use soroban_sdk::crypto::bn254::{Bn254G1Affine, Bn254G2Affine, Fr};

#[derive(Clone)]
pub struct VerifyingKey {
    pub alpha_g1: Bn254G1Affine,
    pub beta_g2: Bn254G2Affine,
    pub gamma_g2: Bn254G2Affine,
    pub delta_g2: Bn254G2Affine,
    pub ic: Vec<Bn254G1Affine>,  // Input commitments
}

#[derive(Clone)]
pub struct Proof {
    pub a: Bn254G1Affine,
    pub b: Bn254G2Affine,
    pub c: Bn254G1Affine,
}

#[contract]
pub struct Groth16Verifier;

#[contractimpl]
impl Groth16Verifier {
    /// Verify a Groth16 proof with public inputs
    pub fn verify(
        env: Env,
        vk: VerifyingKey,
        proof: Proof,
        public_inputs: Vec<Fr>,
    ) -> bool {
        let bn254 = env.crypto().bn254();

        // Compute vk_x = ic[0] + sum(public_inputs[i] * ic[i+1])
        let mut vk_x = vk.ic.get(0).unwrap();
        for i in 0..public_inputs.len() {
            let ic_i = vk.ic.get(i + 1).unwrap();
            let input_i = public_inputs.get(i).unwrap();
            let term = bn254.g1_mul(&ic_i, &input_i);
            vk_x = bn254.g1_add(&vk_x, &term);
        }

        // Negate proof.a for the pairing equation
        let neg_a = negate_g1(&env, &proof.a);

        // Pairing check: e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) = 1
        let g1_points = Vec::from_array(&env, [
            neg_a,
            vk.alpha_g1,
            vk_x,
            proof.c,
        ]);
        let g2_points = Vec::from_array(&env, [
            proof.b,
            vk.beta_g2,
            vk.gamma_g2,
            vk.delta_g2,
        ]);

        bn254.pairing_check(g1_points, g2_points)
    }
}

/// Negate a G1 point (flip y-coordinate in the field)
fn negate_g1(env: &Env, point: &Bn254G1Affine) -> Bn254G1Affine {
    // y_neg = p - y where p is the field modulus
    // Implementation depends on how you access the point coordinates
    // This is a simplified placeholder
    todo!("Implement G1 negation")
}
```

---

## ZK Development Workflow

### 1. Write the Circuit (Off-chain)

Choose a proving system and write your circuit logic:

**Noir (Aztec)** — Domain-specific language for ZK:
```noir
// circuit.nr
fn main(x: Field, y: pub Field) {
    assert(x * x == y);
}
```

**RISC Zero** — Write in Rust, prove any computation:
```rust
// guest/src/main.rs
#![no_main]
risc0_zkvm::guest::entry!(main);

fn main() {
    let input: u64 = risc0_zkvm::guest::env::read();
    let result = expensive_computation(input);
    risc0_zkvm::guest::env::commit(&result);
}
```

### 2. Generate Proofs (Off-chain)

Compile the circuit and generate proofs using the respective toolchain:

```bash
# Noir
nargo compile
nargo prove

# RISC Zero
cargo risczero build
cargo run --release
```

### 3. Deploy Verifier Contract (On-chain)

Deploy a Soroban contract that verifies the proofs using BN254 primitives.

### 4. Verify Proofs (On-chain)

Submit proofs to your verifier contract for on-chain verification.

---

## Multi-Scalar Multiplication (MSM)

Soroban doesn't provide native MSM. Implement it using g1_mul and g1_add:

```rust
/// Compute sum of scalar[i] * point[i]
pub fn g1_msm(
    env: &Env,
    scalars: &Vec<Fr>,
    points: &Vec<Bn254G1Affine>,
) -> Bn254G1Affine {
    let bn254 = env.crypto().bn254();

    assert_eq!(scalars.len(), points.len());

    // Start with point at infinity (identity)
    let mut result = identity_g1(env);

    for i in 0..scalars.len() {
        let scalar = scalars.get(i).unwrap();
        let point = points.get(i).unwrap();
        let term = bn254.g1_mul(&point, &scalar);
        result = bn254.g1_add(&result, &term);
    }

    result
}
```

---

## ZK Merkle Tree with Poseidon

```rust
use soroban_sdk::{Env, Vec, U256, BytesN};

/// Verify a Merkle proof using Poseidon hash
pub fn verify_merkle_proof(
    env: &Env,
    leaf: U256,
    proof: Vec<U256>,
    path_indices: Vec<bool>,  // true = right, false = left
    root: U256,
) -> bool {
    let mut current = leaf;

    for i in 0..proof.len() {
        let sibling = proof.get(i).unwrap();
        let is_right = path_indices.get(i).unwrap();

        // Hash pair in correct order
        let inputs = if is_right {
            Vec::from_array(env, [sibling, current])
        } else {
            Vec::from_array(env, [current, sibling])
        };

        current = poseidon_hash(env, inputs);
    }

    current == root
}
```

---

## Resource Costs

BN254 operations have associated cost types for metering:

| Cost Type | Operation |
|-----------|-----------|
| `Bn254G1Add` | G1 point addition |
| `Bn254G1Mul` | G1 scalar multiplication |
| `Bn254Pairing` | Pairing (linear with vector length) |
| `Bn254EncodeFp` / `Bn254DecodeFp` | Field element encoding |
| `Bn254G1CheckPointOnCurve` | Curve membership check |
| `Bn254G2CheckPointInSubgroup` | Subgroup membership check |
| `Bn254FrFromU256` / `Bn254FrToU256` | Scalar conversion |
| `Bn254FrMul` / `Bn254FrAddSub` | Scalar arithmetic |
| `Bn254FrPow` / `Bn254FrInv` | Exponentiation / Inversion |

Poseidon costs scale linearly with rounds and quadratically with state size.

---

## Security Considerations

### Proof Verification

- **Validate all inputs** — Malformed G1/G2 points will cause host function traps
- **Check proof freshness** — Prevent replay attacks with nullifiers or nonces
- **Verify public inputs** — Don't trust client-provided public input commitments

### Encoding Errors

Host functions trap on:
- G1 point byte length ≠ 64
- G2 point byte length ≠ 128
- Point not on curve
- G2 point not in correct subgroup
- Mismatched vector lengths in pairing_check

### Privacy Pool Patterns

```rust
// Use nullifiers to prevent double-spending
pub fn withdraw(
    env: Env,
    proof: Proof,
    nullifier_hash: U256,
    // ... other params
) {
    // Check nullifier hasn't been used
    if env.storage().persistent().has(&DataKey::Nullifier(nullifier_hash)) {
        panic!("nullifier already used");
    }

    // Verify the ZK proof
    if !verify_proof(&env, &proof) {
        panic!("invalid proof");
    }

    // Mark nullifier as used
    env.storage().persistent().set(&DataKey::Nullifier(nullifier_hash), &true);

    // Process withdrawal...
}
```

---

## Testing ZK Contracts

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Env as _;

    #[test]
    fn test_pairing_check() {
        let env = Env::default();
        let bn254 = env.crypto().bn254();

        // Test with known valid pairing inputs
        // (You'll need actual test vectors from your proving system)
        let g1_points = create_test_g1_points(&env);
        let g2_points = create_test_g2_points(&env);

        let result = bn254.pairing_check(g1_points, g2_points);
        assert!(result);
    }

    #[test]
    fn test_invalid_proof_rejected() {
        let env = Env::default();

        // Modify a valid proof to make it invalid
        let invalid_proof = create_invalid_proof(&env);

        let result = Groth16Verifier::verify(
            env.clone(),
            get_vk(&env),
            invalid_proof,
            get_public_inputs(&env),
        );

        assert!(!result);
    }
}
```

### Integration Tests

1. Generate real proofs using your off-chain prover
2. Deploy verifier to local Quickstart or Testnet
3. Submit proofs via Stellar CLI or SDK
4. Verify correct acceptance/rejection

```bash
# Deploy verifier
stellar contract deploy --wasm target/wasm32-unknown-unknown/release/verifier.wasm \
  --source alice --network testnet

# Invoke with proof data
stellar contract invoke --id <CONTRACT_ID> --source alice --network testnet \
  -- verify --proof <PROOF_HEX> --public_inputs <INPUTS_HEX>
```

---

## Examples & Resources

### Official Resources
- [X-Ray Announcement](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25) — Protocol 25 overview
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md) — BN254 specification
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) — Poseidon specification
- [Soroban SDK BN254 Docs](https://docs.rs/soroban-sdk/latest/soroban_sdk/crypto/bn254/) — Type and function reference

### Example Contracts
- [Soroban Examples](https://github.com/stellar/soroban-examples) — Official examples (check for `groth16_verifier`, `privacy-pools`, `import_ark_bn254`)

### Proving Systems
- [Noir Documentation](https://noir-lang.org/docs/) — Aztec's ZK DSL
- [RISC Zero](https://dev.risczero.com/) — General-purpose zkVM

### Community Resources
- [UltraHonk Soroban Verifier](https://github.com/indextree/ultrahonk_soroban_contract) — Noir proof verification (verify SDK compatibility)

> **Note**: Protocol 25 launched January 22, 2026. Some community projects may still be updating to soroban-sdk v25. Always verify SDK version compatibility before using third-party code.

---

## Keywords
zero-knowledge, zk, zk-snark, groth16, plonk, bn254, alt_bn128, poseidon, pairing, elliptic curve,
privacy, confidential, merkle tree, nullifier, proof verification, noir, risc zero, x-ray, protocol 25
