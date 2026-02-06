# Curated Resources (Source-of-Truth First)

## Official Documentation

### Stellar Developer Docs
- [Stellar Documentation](https://developers.stellar.org/docs) - Primary documentation
- [Build Smart Contracts](https://developers.stellar.org/docs/build/smart-contracts) - Soroban guides
- [Build Apps](https://developers.stellar.org/docs/build/apps) - Client application guides
- [Tools & SDKs](https://developers.stellar.org/docs/tools) - Available tooling
- [Networks](https://developers.stellar.org/docs/networks) - Network configuration
- [Learn Fundamentals](https://developers.stellar.org/docs/learn/fundamentals) - Core concepts
- [Security Best Practices](https://developers.stellar.org/docs/build/security-docs)

### API References
- [Stellar RPC Methods](https://developers.stellar.org/docs/data/apis/rpc/api-reference/methods) - RPC API
- [Horizon API](https://developers.stellar.org/docs/data/apis/horizon/api-reference) - REST API (legacy-focused)
- [Oracle Providers](https://developers.stellar.org/docs/data/oracles/oracle-providers)

## SDKs

### Client SDKs (Application Development)
- [JavaScript SDK](https://github.com/stellar/js-stellar-sdk) - `@stellar/stellar-sdk`
- [Python SDK](https://github.com/StellarCN/py-stellar-base) - `stellar-sdk`
- [Java SDK](https://github.com/lightsail-network/java-stellar-sdk) - `network.lightsail:stellar-sdk` (Lightsail Network)
- [Go SDK](https://github.com/stellar/go-stellar-sdk) - `txnbuild`, Horizon & RPC clients
- [Rust SDK (RPC Client)](https://github.com/stellar/rs-stellar-rpc-client)
- [SDK Documentation](https://developers.stellar.org/docs/tools/sdks/client-sdks)

### Contract SDK (Soroban Development)
- [Soroban Rust SDK](https://github.com/stellar/rs-soroban-sdk) - `soroban-sdk`
- [Soroban SDK Docs](https://docs.rs/soroban-sdk/latest/soroban_sdk/) - Rust docs

## CLI Tools

### Stellar CLI
- [Stellar CLI Repository](https://github.com/stellar/stellar-cli)
- [CLI Installation](https://developers.stellar.org/docs/tools/stellar-cli)
- [CLI Commands Reference](https://developers.stellar.org/docs/tools/stellar-cli/stellar-cli-commands)

### Scaffold Stellar
- [Scaffold Stellar](https://scaffoldstellar.org) - Full-stack dApp scaffolding (contracts + React/Vite/TS frontend)
- [Scaffold Docs](https://developers.stellar.org/docs/tools/scaffold-stellar) - Official documentation
- [GitHub](https://github.com/theahaco/scaffold-stellar) - Open source (Apache 2.0)

### Quickstart (Local Development)
- [Quickstart Docker](https://github.com/stellar/quickstart)
- [Quickstart Guide](https://developers.stellar.org/docs/tools/quickstart)

## Contract Libraries & Tools

### OpenZeppelin Stellar Contracts
- [OpenZeppelin Contracts](https://github.com/OpenZeppelin/stellar-contracts)
- [Documentation](https://developers.stellar.org/docs/tools/openzeppelin-contracts)
- [Contract Wizard](https://wizard.openzeppelin.com/stellar) - Generate contracts

### Smart Account SDKs
- [Smart Account Kit](https://github.com/kalepail/smart-account-kit) - Production smart wallet SDK (recommended)
- [Passkey Kit](https://github.com/kalepail/passkey-kit) - Legacy passkey wallet SDK
- [Super Peach](https://github.com/kalepail/superpeach) - Smart wallet implementation example

### Developer Tools
- [Stellar Wallets Kit](https://github.com/Creit-Tech/Stellar-Wallets-Kit) - Multi-wallet integration
- [OpenZeppelin Relayer](https://docs.openzeppelin.com/relayer) - Fee-sponsored transactions

## Example Repositories

### Official Examples
- [Soroban Examples](https://github.com/stellar/soroban-examples) - Core contract patterns
- [Soroban Example dApp](https://github.com/stellar/soroban-example-dapp) - Crowdfunding Next.js app
- [Stellar Repositories](https://github.com/orgs/stellar/repositories)

### Community Examples
- [Scout Soroban Examples](https://github.com/CoinFabrik/scout-soroban-examples) - Security-audited examples
- [Soroban Guide (Xycloo)](https://github.com/xycloo/soroban-guide) - Learning resources
- [Soroban Contracts (icolomina)](https://github.com/icolomina/soroban-contracts) - Governance examples
- [Oracle Example](https://github.com/FredericRezeau/soroban-oracle-example) - Pub-sub oracle pattern
- [OZ Stellar NFT](https://github.com/jamesbachini/OZ-Stellar-NFT) - Simple NFT with OpenZeppelin

## Ecosystem Projects

For DeFi protocols, wallets, oracles, gaming/NFTs, cross-chain bridges, and builder teams, see [ecosystem.md](ecosystem.md).

## Security

For vulnerability patterns, checklists, and detailed tooling guides, see [security.md](security.md).

### Bug Bounty Programs
- [Stellar Bug Bounty (Immunefi)](https://immunefi.com/bug-bounty/stellar/) - Up to $250K, covers core + Soroban
- [OpenZeppelin Stellar Bounty (Immunefi)](https://immunefi.com/bug-bounty/openzeppelin-stellar/) - Up to $25K
- [HackerOne VDP](https://stellar.org/grants-and-funding/bug-bounty) - Web application vulnerabilities

### Audit Bank & Audit Firms
- [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank) - $3M+ deployed, 43+ audits
- [Audited Projects List](https://stellar.org/audit-bank/projects) - Public audit registry
- Partners: OtterSec, Veridise, Runtime Verification, CoinFabrik, QuarksLab, Coinspect, Certora, Halborn, Zellic, Code4rena

### Static Analysis
- [Scout Soroban](https://github.com/CoinFabrik/scout-soroban) - 23 vulnerability detectors, VSCode extension
- [OZ Security Detectors SDK](https://github.com/OpenZeppelin/soroban-security-detectors-sdk) - Custom detector framework

### Formal Verification
- [Certora Sunbeam Prover](https://docs.certora.com/en/latest/docs/sunbeam/index.html) - WASM-level formal verification
- [CVLR Spec Language](https://github.com/Certora/cvlr) - Certora Verification Language for Rust
- [Runtime Verification Komet](https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification) - Soroban verification tool

### Security Resources
- [Veridise Security Checklist](https://veridise.com/blog/audit-insights/building-on-stellar-soroban-grab-this-security-checklist-to-avoid-vulnerabilities/) - Soroban-specific
- [Soroban Security Portal](https://sorobansecurity.com) - Community vulnerability database
- [CoinFabrik Audit Reports](https://www.coinfabrik.com/smart-contract-audit-reports/)
- [Certora Security Reports](https://github.com/Certora/SecurityReports) - Includes Stellar verifications

## Zero-Knowledge Proofs (Status-Sensitive)

For comprehensive ZK development guidance, see [zk-proofs.md](zk-proofs.md).

Always verify CAP status and network support before treating any ZK primitive as production-available.

### Protocol & Specifications
- [Protocol upgrades](https://stellar.org/protocol-upgrades) - Upgrade timeline and network context
- [CAP-0074](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0074.md) - BN254 host functions proposal
- [CAP-0075](https://github.com/stellar/stellar-protocol/blob/master/core/cap-0075.md) - Poseidon/Poseidon2 host functions proposal

### SDK Documentation
- [Soroban SDK BN254 module](https://docs.rs/soroban-sdk/latest/soroban_sdk/crypto/bn254/) - Verify availability in your pinned SDK version
- [Soroban SDK Crypto](https://docs.rs/soroban-sdk/latest/soroban_sdk/crypto/) - Full crypto module reference

### Proving Systems & Tooling
- [Noir Documentation](https://noir-lang.org/docs/) - Aztec's ZK domain-specific language
- [RISC Zero](https://dev.risczero.com/) - General-purpose zkVM for Rust programs

### Example Contracts
- [Soroban Examples](https://github.com/stellar/soroban-examples) - Official examples (includes `groth16_verifier`, `privacy-pools`, `import_ark_bn254`)

## Testing

### Testing Guides
- [Definitive Guide to Testing Smart Contracts](https://stellar.org/blog/developers/the-definitive-guide-to-testing-smart-contracts-on-stellar) - Comprehensive overview
- [Fuzzing Guide](https://developers.stellar.org/docs/build/guides/testing/fuzzing) - cargo-fuzz + SorobanArbitrary
- [Fuzzing Example Contract](https://developers.stellar.org/docs/build/smart-contracts/example-contracts/fuzzing)
- [Differential Testing](https://developers.stellar.org/docs/build/guides/testing/differential-tests-with-test-snapshots) - Automatic test snapshots
- [Fork Testing](https://developers.stellar.org/docs/build/guides/testing/fork-testing) - Test against production state
- [Mutation Testing](https://developers.stellar.org/docs/build/guides/testing/mutation-testing) - cargo-mutants

### Local Development
- [Stellar Quickstart](https://github.com/stellar/quickstart)
- [Docker Setup](https://developers.stellar.org/docs/tools/quickstart)

### Test Networks
- [Testnet Info](https://developers.stellar.org/docs/networks/testnet)
- [Friendbot](https://friendbot.stellar.org) - Testnet faucet

## Data & Analytics

### Data Documentation Hub
- [Stellar Data Overview](https://developers.stellar.org/docs/data) - Choose the right tool (APIs, indexers, analytics, oracles)
- [Indexer Directory](https://developers.stellar.org/docs/data/indexers) - All supported indexers
- [RPC Provider Directory](https://developers.stellar.org/docs/data/apis/rpc/providers) - All RPC infrastructure providers

### Block Explorers
- [StellarExpert](https://stellar.expert) - Network explorer & analytics
- [StellarExpert API](https://stellar.expert/openapi.html) - Free REST API (no auth, CORS-enabled)
- [Stellar Lab](https://lab.stellar.org) - Developer tools
- [StellarChain](https://stellarchain.io) - Alternative explorer

### Data Indexers
- [Mercury](https://mercurydata.app) - Stellar-native indexer with Retroshades + GraphQL ([docs](https://docs.mercurydata.app))
- [SubQuery](https://subquery.network) - Multi-chain indexer with Stellar/Soroban support ([quick start](https://subquery.network/doc/indexer/quickstart/quickstart_chains/stellar.html))
- [Goldsky](https://goldsky.com) - Real-time data replication pipelines + subgraphs ([Stellar docs](https://docs.goldsky.com/chains/stellar))
- [Zephyr VM](https://github.com/xycloo/zephyr-vm) - Serverless Rust execution at ledger close

### Historical Data & Analytics
- [Hubble](https://developers.stellar.org/docs/data/analytics/hubble) - BigQuery dataset (updated every 30 min)
- [Galexie](https://developers.stellar.org/docs/data/indexers/build-your-own/galexie) - Data pipeline for building data lakes
- [Data Lake](https://developers.stellar.org/docs/data/apis/rpc/admin-guide/data-lake-integration) - Powers RPC Infinite Scroll (public via AWS Open Data)

## Infrastructure

### Anchors & On/Off Ramps
- [Anchor Platform](https://github.com/stellar/java-stellar-anchor-sdk)
- [Anchor Docs](https://developers.stellar.org/docs/category/anchor-platform)
- [Anchor Fundamentals](https://developers.stellar.org/docs/learn/fundamentals/anchors)
- [Stellar Ramps](https://stellar.org/use-cases/ramps)

### Disbursements
- [Stellar Disbursement Platform](https://github.com/stellar/stellar-disbursement-platform)
- [SDP Documentation](https://developers.stellar.org/docs/category/use-the-stellar-disbursement-platform)

### RPC Providers
- [RPC Provider Directory](https://developers.stellar.org/docs/data/apis/rpc/providers) - Full list of providers
- [Quasar (Lightsail Network)](https://quasar.lightsail.network) - Stellar-native RPC, Archive RPC, hosted Galexie Data Lake
- [Blockdaemon](https://www.blockdaemon.com/soroban) - Enterprise RPC
- [Validation Cloud](https://www.validationcloud.io) - Testnet & Mainnet
- [QuickNode](https://www.quicknode.com) - Testnet, Mainnet & Dedicated
- [Ankr](https://www.ankr.com) - Testnet & Mainnet
- [NOWNodes](https://nownodes.io) - All networks incl. Futurenet
- [GetBlock](https://getblock.io) - Testnet & Mainnet

## Protocol & Governance

### Stellar Protocol
- [Stellar Protocol Repo](https://github.com/stellar/stellar-protocol)
- [CAPs](https://github.com/stellar/stellar-protocol/tree/master/core) - Core Advancement Proposals
- [SEPs](https://github.com/stellar/stellar-protocol/tree/master/ecosystem) - Stellar Ecosystem Proposals

### Key SEP Standards
- [SEP-0001](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0001.md) - stellar.toml
- [SEP-0010](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0010.md) - Web Authentication
- [SEP-0024](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0024.md) - Hosted Deposit/Withdrawal
- [SEP-0030](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0030.md) - Account Recovery
- [SEP-0031](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0031.md) - Cross-Border Payments
- [SEP-0041](https://developers.stellar.org/docs/tokens/token-interface) - Token Interface
- [SEP-0045](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0045.md) - Web Auth for Contract Accounts (Draft)
- [SEP-0046](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0046.md) - Contract Meta (Active)
- [SEP-0048](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0048.md) - Contract Interface Specification (Active)
- [SEP-0050](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0050.md) - Non-Fungible Tokens (Draft)
- [SEP-0056](https://github.com/stellar/stellar-protocol/blob/master/ecosystem/sep-0056.md) - Tokenized Vault Standard (Draft, ERC-4626 equivalent)

### Network Upgrades
- [Protocol Upgrades](https://stellar.org/protocol-upgrades)
- [SDF Blog](https://stellar.org/blog)

## Project Directories & Funding

### Ecosystem Discovery
- [Stellar Ecosystem](https://stellar.org/ecosystem) - Official project directory
- [Stellar Community Fund Projects](https://communityfund.stellar.org/projects)

### Funding Programs
- [Stellar Community Fund](https://communityfund.stellar.org) - Grants up to $150K
- [Soroban Audit Bank](https://stellar.org/grants-and-funding/soroban-audit-bank)
- [$100M Soroban Adoption Fund](https://stellar.org/soroban)

## Learning Resources

### Official Tutorials
- [Getting Started](https://developers.stellar.org/docs/build/smart-contracts/getting-started)
- [Hello World Contract](https://developers.stellar.org/docs/build/smart-contracts/getting-started/hello-world)
- [Deploy to Testnet](https://developers.stellar.org/docs/build/smart-contracts/getting-started/deploy-to-testnet)
- [TypeScript Bindings](https://developers.stellar.org/docs/build/apps/guestbook/bindings)
- [Passkey Prerequisites](https://developers.stellar.org/docs/build/apps/guestbook/passkeys-prerequisites)

### Video Content
- [Stellar YouTube](https://www.youtube.com/@StellarDevelopmentFoundation)
- [Learn Rust for Smart Contracts (DAO Series)](https://www.youtube.com/watch?v=VeQM5N-0DrI)
- [Call Option Contract Walkthrough](https://www.youtube.com/watch?v=Z8FHVllP_D0)
- [Blend Protocol Tutorial](https://www.youtube.com/watch?v=58j0QkXKiDU)

### Developer Tools
- [Stella AI Bot](https://developers.stellar.org/docs/tools/developer-tools) - AI assistant for Stellar developer questions
- [Soroban Playground](https://soropg.com) - Browser-based Soroban IDE ([GitHub](https://github.com/jamesbachini/Soroban-Playground))

### Blog Posts & Guides
- [Composability on Stellar](https://stellar.org/blog/developers/composability-on-stellar-from-concept-to-reality)
- [Testing Smart Contracts Guide](https://stellar.org/blog/developers/the-definitive-guide-to-testing-smart-contracts-on-stellar)
- [Sorobounty Spectacular Tutorials](https://stellar.org/blog/developers/sorobounty-spectacular-dapp-tutorials)
- [Learn Soroban 1-2-3 (Community Tools)](https://stellar.org/blog/developers/learn-soroban-as-easy-as-1-2-3-with-community-made-tooling)
- [SCF Infrastructure Recap](https://stellar.org/blog/ecosystem/stellar-community-fund-recap-soroban-infrastructure)
- [Native vs Soroban Tokens](https://cheesecakelabs.com/blog/native-tokens-vs-soroban-tokens/)
- [57Blocks Integration Testing](https://57blocks.com/blog/soroban-integration-testing-best-practices)

## Stablecoins on Stellar

### Major Stablecoins
- [USDC on Stellar](https://www.circle.com/usdc/stellar) - Circle
- [EURC on Stellar](https://www.circle.com/en/eurc) - Circle
- PYUSD (PayPal) - Verify current issuer/distribution details before integration

### Asset Discovery
- [StellarExpert Asset Directory](https://stellar.expert/explorer/public/asset)

## Community

### Developer Resources
- [Stellar Developers Discord](https://discord.gg/stellar)
- [Stellar Stack Exchange](https://stellar.stackexchange.com)
- [GitHub Discussions](https://github.com/stellar/stellar-protocol/discussions)

### Key People to Follow

Builders and contributors actively shaping the Stellar/Soroban ecosystem:

| Name | GitHub | X/Twitter | Focus |
|------|--------|-----------|-------|
| Tyler van der Hoeven | [kalepail](https://github.com/kalepail) | [@kalepail](https://x.com/kalepail) | SDF DevRel, Smart Account Kit, Passkey Kit, Launchtube |
| Leigh McCulloch | [leighmcculloch](https://github.com/leighmcculloch) | [@___leigh___](https://x.com/___leigh___) | SDF core engineer, Stellar CLI, Soroban SDK |
| James Bachini | [jamesbachini](https://github.com/jamesbachini) | [@james_bachini](https://x.com/james_bachini) | SDF Dev in Residence, Soroban Playground, tutorials |
| Elliot Voris | [ElliotFriend](https://github.com/ElliotFriend) | [@ElliotFriend](https://x.com/ElliotFriend) | SDF DevRel, community education |
| Carsten Jacobsen | [carstenjacobsen](https://github.com/carstenjacobsen) | — | SDF, weekly dev meetings, Soroban examples |
| Esteban Iglesias | [esteblock](https://github.com/esteblock) | [@esteblock_dev](https://x.com/esteblock_dev) | PaltaLabs, Soroswap, DeFindex |
| Markus Paulson-Luna | [markuspluna](https://github.com/markuspluna) | [@script3official](https://x.com/script3official) | Script3, Blend Protocol |
| Alexander Mootz | [mootz12](https://github.com/mootz12) | — | Script3, Blend contracts |
| Tommaso | [heytdep](https://github.com/heytdep) | [@heytdep](https://x.com/heytdep) | Xycloo Labs, Mercury indexer, ZephyrVM |
| OrbitLens | [orbitlens](https://github.com/orbitlens) | [@orbitlens](https://x.com/orbitlens) | Reflector oracle, StellarExpert, Albedo |
| Frederic Rezeau | [FredericRezeau](https://github.com/FredericRezeau) | [@FredericRezeau](https://x.com/FredericRezeau) | Litemint, soroban-kit, gaming |
| Jun Luo (Overcat) | [overcat](https://github.com/overcat) | [@overcat_me](https://x.com/overcat_me) | Lightsail Network, Quasar RPC, Java/Python SDKs, Ledger app |
| Jay Geng | [jayz22](https://github.com/jayz22) | — | SDF, Soroban SDK, confidential tokens |
| Chad Ostrowski | [chadoh](https://github.com/chadoh) | [@chadoh](https://x.com/chadoh) | Aha Labs CEO, Scaffold Stellar, Soroban CLI |
| Willem Wyndham | [willemneal](https://github.com/willemneal) | [@willemneal](https://x.com/willemneal) | Aha Labs co-founder, Scaffold Stellar, JS contract client |

### Builder Teams & Companies
See [ecosystem.md](ecosystem.md) for a table of teams shipping production code on Stellar/Soroban, with GitHub orgs, websites, and Twitter handles.

### Foundation
- [Stellar Development Foundation](https://stellar.org/foundation)
- [Foundation Roadmap](https://stellar.org/foundation/roadmap)
- [Ecosystem Blog](https://stellar.org/blog/ecosystem)
