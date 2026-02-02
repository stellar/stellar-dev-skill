# Zero-Knowledge Proofs on Stellar (Protocol 25 X-Ray)

Protocol 25 "X-Ray" (Mainnet January 22, 2026) introduced native ZK cryptographic primitives, enabling privacy-preserving applications on Stellar.

## When to Use ZK on Stellar

- **On-chain proof verification** — Verify zk-SNARK proofs (Groth16, PLONK, UltraHonk)
- **Privacy pools** — Prove lawful source of funds without revealing transaction history
- **Confidential tokens** — Hidden balances with validity proofs
- **ZK Merkle trees** — Efficient membership proofs using Poseidon hashes
- **Cross-chain bridges** — Verify state proofs from other chains
- **Compliance-forward privacy** — KYC/AML compliance with minimal data exposure

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

#### Types

```rust
use soroban_sdk::crypto::bn254::{Fr, G1Affine, G2Affine};
```

| Type | Size | Description |
|------|------|-------------|
| `Fr` | 32 bytes | Scalar field element (converts to/from U256) |
| `G1Affine` | 64 bytes | G1 point (x, y coordinates) |
| `G2Affine` | 128 bytes | G2 point (extension field coordinates) |

#### Operations

BN254 uses **operator overloading** for point arithmetic:

```rust
use soroban_sdk::{contract, contractimpl, Env, BytesN, U256, Vec};
use soroban_sdk::crypto::bn254::{Fr, G1Affine, G2Affine};

#[contract]
pub struct Bn254Example;

#[contractimpl]
impl Bn254Example {
    /// Add two G1 points
    pub fn g1_add(a: BytesN<64>, b: BytesN<64>) -> BytesN<64> {
        let a = G1Affine::from_bytes(a);
        let b = G1Affine::from_bytes(b);
        (a + b).to_bytes()  // Use + operator
    }

    /// Scalar multiplication
    pub fn g1_mul(p: BytesN<64>, s: U256) -> BytesN<64> {
        let p = G1Affine::from_bytes(p);
        let s = Fr::from(s);
        (p * s).to_bytes()  // Use * operator
    }

    /// Multi-pairing check (core of zk-SNARK verification)
    /// Returns true if: e(g1[0], g2[0]) × e(g1[1], g2[1]) × ... = 1
    pub fn verify_pairing(env: Env, g1_bytes: Vec<BytesN<64>>, g2_bytes: Vec<BytesN<128>>) -> bool {
        let mut g1_points = Vec::new(&env);
        for bytes in g1_bytes.iter() {
            g1_points.push_back(G1Affine::from_bytes(bytes));
        }

        let mut g2_points = Vec::new(&env);
        for bytes in g2_bytes.iter() {
            g2_points.push_back(G2Affine::from_bytes(bytes));
        }

        env.crypto().bn254().pairing_check(g1_points, g2_points)
    }
}
```

#### Encoding Format

Points use **uncompressed big-endian** encoding (no flag bits):

- **G1**: 64 bytes — `be_encode(X) || be_encode(Y)`
- **G2**: 128 bytes — `be_encode(X_c1) || be_encode(X_c0) || be_encode(Y_c1) || be_encode(Y_c0)`
- **Point at infinity**: All zeros
- **Fr (scalar)**: U256 / 32 bytes

---

### Poseidon Hash Functions (CAP-0075)

Poseidon is optimized for ZK circuits — ~300 constraints vs ~27,000 for SHA-256. Essential for efficient Merkle trees and commitments in ZK applications.

#### API

```rust
use soroban_sdk::{contract, contractimpl, Env, Symbol, U256, Vec};

#[contract]
pub struct PoseidonExample;

#[contractimpl]
impl PoseidonExample {
    /// Poseidon hash over BN254 scalar field
    pub fn poseidon(env: Env, inputs: Vec<U256>) -> U256 {
        let field = Symbol::new(&env, "BN254");
        env.crypto().poseidon_hash(&inputs, field)
    }

    /// Poseidon2 hash (optimized variant)
    pub fn poseidon2(env: Env, inputs: Vec<U256>) -> U256 {
        let field = Symbol::new(&env, "BN254");
        env.crypto().poseidon2_hash(&inputs, field)
    }
}
```

#### Supported Fields

| Field Symbol | Curve |
|--------------|-------|
| `"BN254"` | BN254 scalar field |
| `"BLS12_381"` | BLS12-381 scalar field |

#### CLI Example

```bash
# Hash two field elements [3, 4]
stellar contract invoke --id poseidon --network futurenet -- poseidon \
  --inputs '["3", "4"]'

# Output: "14763215145315200506921711489642608356394854266165572616578112107564877678998"
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
use soroban_sdk::{contract, contractimpl, contracttype, contracterror, Env, Vec, BytesN, U256};
use soroban_sdk::crypto::bn254::{Fr, G1Affine, G2Affine};

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum ZkError {
    InvalidVerifyingKey = 1,
    InvalidPublicInputs = 2,
}

#[derive(Clone)]
#[contracttype]
pub struct VerifyingKey {
    pub alpha_g1: BytesN<64>,
    pub beta_g2: BytesN<128>,
    pub gamma_g2: BytesN<128>,
    pub delta_g2: BytesN<128>,
    pub ic: Vec<BytesN<64>>,  // Input commitments
}

#[derive(Clone)]
#[contracttype]
pub struct Proof {
    pub a: BytesN<64>,
    pub b: BytesN<128>,
    pub c: BytesN<64>,
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
        public_inputs: Vec<U256>,
    ) -> Result<bool, ZkError> {
        // Compute vk_x = ic[0] + sum(public_inputs[i] * ic[i+1])
        let mut vk_x = G1Affine::from_bytes(
            vk.ic.get(0).ok_or(ZkError::InvalidVerifyingKey)?
        );

        for i in 0..public_inputs.len() {
            let ic_i = G1Affine::from_bytes(
                vk.ic.get(i + 1).ok_or(ZkError::InvalidVerifyingKey)?
            );
            let input_i = Fr::from(
                public_inputs.get(i).ok_or(ZkError::InvalidPublicInputs)?
            );
            let term = ic_i * input_i;
            vk_x = vk_x + term;
        }

        // Negate proof.a for the pairing equation
        let proof_a = G1Affine::from_bytes(proof.a);
        let neg_a = -proof_a;

        // Build point vectors for pairing check
        let g1_points = Vec::from_array(&env, [
            neg_a,
            G1Affine::from_bytes(vk.alpha_g1),
            vk_x,
            G1Affine::from_bytes(proof.c),
        ]);

        let g2_points = Vec::from_array(&env, [
            G2Affine::from_bytes(proof.b),
            G2Affine::from_bytes(vk.beta_g2),
            G2Affine::from_bytes(vk.gamma_g2),
            G2Affine::from_bytes(vk.delta_g2),
        ]);

        // Pairing check: e(-A, B) * e(alpha, beta) * e(vk_x, gamma) * e(C, delta) = 1
        Ok(env.crypto().bn254().pairing_check(g1_points, g2_points))
    }
}
```

> **Note**: The official `groth16_verifier` example in soroban-examples uses BLS12-381. The pattern above adapts it for BN254 (Ethereum-compatible).

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

Soroban doesn't provide native MSM. Implement using operator overloading:

```rust
use soroban_sdk::{Vec, BytesN, U256};
use soroban_sdk::crypto::bn254::{Fr, G1Affine};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MsmError { EmptyInput, LengthMismatch }

/// Compute sum of scalar[i] * point[i]
pub fn g1_msm(
    scalars: &Vec<U256>,
    points: &Vec<BytesN<64>>,
) -> Result<G1Affine, MsmError> {
    if scalars.len() != points.len() { return Err(MsmError::LengthMismatch); }
    if scalars.is_empty() { return Err(MsmError::EmptyInput); }

    // Start with first term
    let mut result = G1Affine::from_bytes(points.get(0).unwrap())
        * Fr::from(scalars.get(0).unwrap());

    for i in 1..scalars.len() {
        let scalar = Fr::from(scalars.get(i).unwrap());
        let point = G1Affine::from_bytes(points.get(i).unwrap());
        let term = point * scalar;
        result = result + term;
    }

    Ok(result)
}
```

---

## ZK Merkle Tree with Poseidon

```rust
use soroban_sdk::{Env, Vec, U256, Symbol};

#[derive(Copy, Clone, Debug, Eq, PartialEq)]
pub enum MerkleError { LengthMismatch, InvalidProof }

/// Verify a Merkle proof using Poseidon hash
pub fn verify_merkle_proof(
    env: &Env,
    leaf: U256,
    proof: Vec<U256>,
    path_indices: Vec<bool>,  // true = right, false = left
    root: U256,
) -> Result<bool, MerkleError> {
    if proof.len() != path_indices.len() { return Err(MerkleError::LengthMismatch); }

    let field = Symbol::new(env, "BN254");
    let mut current = leaf;

    for i in 0..proof.len() {
        let sibling = proof.get(i).ok_or(MerkleError::InvalidProof)?;
        let is_right = path_indices.get(i).ok_or(MerkleError::InvalidProof)?;

        // Hash pair in correct order
        let inputs = if is_right {
            Vec::from_array(env, [sibling, current])
        } else {
            Vec::from_array(env, [current, sibling])
        };

        current = env.crypto().poseidon_hash(&inputs, field.clone());
    }

    Ok(current == root)
}
```

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
use soroban_sdk::{contracttype, Env, U256};

#[contracttype]
pub enum DataKey {
    Nullifier(U256),
}

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
    use soroban_sdk::Env;

    #[test]
    fn test_poseidon_hash() {
        let env = Env::default();
        let field = Symbol::new(&env, "BN254");

        let inputs = Vec::from_array(&env, [U256::from_u32(&env, 1), U256::from_u32(&env, 2)]);
        let hash = env.crypto().poseidon_hash(&inputs, field);

        // Expected: 7853200120776062878684798364095072458815029376092732009249414926327459813530
        assert!(hash != U256::from_u32(&env, 0));
    }

    #[test]
    fn test_pairing_check() {
        let env = Env::default();

        // TODO: Add test vectors from your proving system
        // let g1_points = Vec::from_array(&env, [/* G1 points */]);
        // let g2_points = Vec::from_array(&env, [/* G2 points */]);
        // let result = env.crypto().bn254().pairing_check(g1_points, g2_points);
        // assert!(result);
    }
}
```

### Integration Tests

1. Generate real proofs using your off-chain prover
2. Deploy verifier to Futurenet or Testnet
3. Submit proofs via Stellar CLI or SDK
4. Verify correct acceptance/rejection

```bash
# Deploy verifier
stellar contract deploy \
  --wasm target/wasm32v1-none/release/verifier.optimized.wasm \
  --alias verifier \
  --network futurenet

# Invoke with proof data
stellar contract invoke --id verifier --network futurenet \
  -- verify --proof <PROOF_HEX> --public_inputs <INPUTS_HEX>
```

---

## Examples & Resources

### Official Resources
- [X-Ray Announcement](https://stellar.org/blog/developers/announcing-stellar-x-ray-protocol-25) — Protocol 25 overview
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md) — BN254 specification
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) — Poseidon specification
- [Soroban SDK BN254 Source](https://github.com/stellar/rs-soroban-sdk/blob/v25.0.1/soroban-sdk/src/crypto/bn254.rs) — Implementation reference

### Example Contracts
- [P25 Preview Examples](https://github.com/jayz22/soroban-examples/tree/p25-preview/p25-preview) — BN254 and Poseidon examples
- [Groth16 Verifier (BLS12-381)](https://github.com/stellar/soroban-examples/tree/main/groth16_verifier) — Official verifier example
- [Import Ark BN254](https://github.com/jayz22/soroban-examples/tree/p25-preview/import_ark_bn254) — Using ark-bn254 crate

### Proving Systems
- [Noir Documentation](https://noir-lang.org/docs/) — Aztec's ZK DSL
- [RISC Zero](https://dev.risczero.com/) — General-purpose zkVM

> **Note**: Protocol 25 launched January 22, 2026. Always verify SDK version compatibility (soroban-sdk v25+) when using examples.

---

## Keywords
zero-knowledge, zk, zk-snark, groth16, plonk, bn254, alt_bn128, poseidon, poseidon2, pairing, elliptic curve,
privacy, confidential, merkle tree, nullifier, proof verification, noir, risc zero, x-ray, protocol 25
