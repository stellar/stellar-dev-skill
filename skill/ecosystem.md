# Stellar Ecosystem Projects and Protocols

This guide catalogs the major projects, protocols, and tools in the Stellar ecosystem. Use this as a reference when building on Stellar to find relevant integrations, examples, and community projects.

> **Canonical directories** — For the most up-to-date project lists, check:
> - [Stellar Ecosystem](https://stellar.org/ecosystem) — Official directory (searchable by country, asset, category)
> - [SCF Projects](https://communityfund.stellar.org/projects) — Funded projects with status tracking
> - [Stellar on DefiLlama](https://defillama.com/chain/stellar) — Live DeFi TVL data
>
> Treat project metrics/status as volatile. Validate latest activity and production readiness before taking dependencies.

## DeFi Protocols

### Lending & Borrowing

#### Blend Protocol
Universal liquidity protocol enabling permissionless lending pools.
- **Use Case**: Lending, borrowing, yield generation
- **GitHub**: https://github.com/blend-capital/blend-contracts
- **GitHub (v2)**: https://github.com/blend-capital/blend-contracts-v2
- **Integrations**: Meru, Airtm, Lobstr, DeFindex, Beans

#### Slender
First non-custodial lending protocol on Soroban with flash loan support.
- **Use Case**: Lending, borrowing, flash loans
- **Features**: Pool-based strategy, sTokens, dTokens, utilization caps
- **Oracle**: SEP-40 compatible (Reflector)

### DEXs & AMMs

#### Soroswap
First DEX and aggregator on Stellar/Soroban.
- **Use Case**: Token swaps, liquidity provision, aggregation
- **Website**: https://soroswap.finance
- **GitHub (Core)**: https://github.com/soroswap/core
- **GitHub (Frontend)**: https://github.com/soroswap/frontend
- **GitHub (Aggregator)**: https://github.com/soroswap/aggregator
- **Docs**: https://docs.soroswap.finance
- **Features**: AMM + DEX aggregator across Aqua, Phoenix, Stellar Classic DEX

#### Aquarius / AQUA Network
Governance-driven liquidity layer with AMM functionality.
- **Use Case**: Liquidity incentives, AMM, governance
- **Website**: https://aqua.network
- **GitHub**: https://github.com/AquaToken/soroban-amm
- **GitHub (Org)**: https://github.com/AquaToken
- **Token**: AQUA (governance + rewards)
- **Docs**: https://docs.aqua.network

#### Phoenix Protocol
AMM protocol on Soroban.
- **GitHub**: https://github.com/Phoenix-Protocol-Group
- **Use Case**: Token swaps, liquidity pools

### Yield & Vaults

#### DeFindex
Yield aggregation and vault infrastructure by PaltaLabs.
- **Use Case**: Tokenized vaults, yield strategies, DeFi abstraction
- **Docs**: https://docs.defindex.io
- **Features**: Automated rebalancing, vault management, Blend integration

### Stablecoins & CDPs

#### Orbit CDP Protocol
Collateralized stablecoin issuance (USD, EUR, MXN).
- **Use Case**: Mint stablecoins against XLM/bond collateral
- **Docs**: https://docs.orbitcdp.finance
- **Features**: Multi-currency stablecoins, Pegkeeper automation, Blend integration

## Wallets

### Browser Extensions

#### Freighter
SDF's flagship non-custodial browser wallet.
- **Website**: https://freighter.app
- **Docs**: https://docs.freighter.app
- **GitHub**: https://github.com/stellar/freighter
- **GitHub (Mobile)**: https://github.com/stellar/freighter-mobile
- **API**: https://github.com/stellar/freighter/tree/master/library/freighter-api
- **Features**: Soroban support, mobile apps (iOS/Android), Discover browser

#### xBull
Feature-rich browser wallet with advanced capabilities.
- **Website**: https://xbull.app
- **Features**: Multi-account, hardware wallet support

#### Albedo
Lightweight web-based wallet and signing provider.
- **Website**: https://albedo.link
- **Use Case**: Web authentication, transaction signing

#### Rabet
Browser extension wallet for Stellar.
- **Website**: https://rabet.io

#### Hana Wallet
Modern Stellar wallet with DeFi features.
- **Website**: https://hana.network

### Mobile Wallets

#### LOBSTR
Most popular Stellar mobile wallet.
- **Website**: https://lobstr.co
- **Platforms**: iOS, Android, Web
- **Features**: DEX trading, multisig, 2FA, asset discovery

#### Beans
Payments platform with yield features.
- **Use Case**: Payments, earning (via DeFindex/Blend)
- **Features**: Non-custodial yield generation

### Multi-Wallet Integration

#### Stellar Wallets Kit
SDK for integrating multiple Stellar wallets.
- **GitHub**: https://github.com/Creit-Tech/Stellar-Wallets-Kit
- **Supports**: Freighter, LOBSTR, xBull, Albedo, Rabet, Hana, Ledger, Trezor, WalletConnect

## Developer Tools

### Smart Account & Authentication

#### Smart Account Kit (Recommended)
Comprehensive TypeScript SDK for OpenZeppelin Smart Accounts on Stellar/Soroban.
- **GitHub**: https://github.com/kalepail/smart-account-kit
- **Use Case**: Production smart wallets with passkeys
- **Built On**: [OpenZeppelin stellar-contracts](https://github.com/OpenZeppelin/stellar-contracts)
- **Features**:
  - Context rules with fine-grained authorization scopes
  - Policy support (threshold multisig, spending limits, custom policies)
  - Session management with automatic credential persistence
  - External wallet adapter support (Freighter, LOBSTR, etc.)
  - Built-in indexer for contract discovery
  - Multiple signer types (passkeys, Ed25519, policies)

#### Passkey Kit (Legacy)
Original TypeScript SDK for passkey-based smart wallets.
- **GitHub**: https://github.com/kalepail/passkey-kit
- **Status**: Legacy - use Smart Account Kit for new projects
- **Use Case**: Simple passkey wallet integration
- **Integration**: OpenZeppelin Relayer (gasless tx), Mercury (indexing)
- **Demo**: [passkey-kit-demo.pages.dev](https://passkey-kit-demo.pages.dev)
- **Example**: [Super Peach](https://github.com/kalepail/superpeach)

#### OpenZeppelin Relayer
Service for fee-sponsored transaction submission.
- **Docs**: https://docs.openzeppelin.com/relayer
- **Use Case**: Gasless transactions, fee sponsoring

### Data Indexing

For a full directory of indexing options, see [Stellar Indexer Docs](https://developers.stellar.org/docs/data/indexers).

#### Mercury
Stellar-native data indexing platform with Retroshades technology.
- **Website**: https://mercurydata.app
- **Docs**: https://docs.mercurydata.app
- **Use Case**: Event indexing, data queries, automation
- **Features**: Zephyr VM (serverless Rust execution at ledger close), GraphQL API

#### SubQuery
Multi-chain indexer supporting Stellar and Soroban.
- **Website**: https://subquery.network
- **Quick Start**: https://subquery.network/doc/indexer/quickstart/quickstart_chains/stellar.html
- **Features**: Block/transaction/operation/event handlers, multi-threading, 300+ chains

#### Goldsky
Real-time data replication and subgraph platform.
- **Website**: https://goldsky.com
- **Docs**: https://docs.goldsky.com/chains/stellar
- **Features**: Mirror (real-time pipelines), subgraphs, on-chain + off-chain data

#### Zephyr VM
Cloud execution environment for blockchain data processing.
- **GitHub**: https://github.com/xycloo/zephyr-vm
- **Use Case**: Indexing, monitoring, automation
- **Features**: Self-hostable, ledger-close execution

### Contract Libraries

#### OpenZeppelin Stellar Contracts
Audited smart contract library for Soroban (track latest release tags before pinning versions).
- **GitHub**: https://github.com/OpenZeppelin/stellar-contracts
- **Docs**: https://developers.stellar.org/docs/tools/openzeppelin-contracts
- **Contract Wizard**: https://wizard.openzeppelin.com/stellar
- **Includes**: Tokens (fungible/NFT), governance (timelock), vaults (SEP-56), access control, fee forwarder
- **Crates**: `stellar-tokens`, `stellar-access`, `stellar-contract-utils`

### Security Tools

#### Scout Soroban (CoinFabrik)
Open-source vulnerability detector with 23 detectors for Soroban contracts.
- **GitHub**: https://github.com/CoinFabrik/scout-soroban
- **Install**: `cargo install cargo-scout-audit`
- **Features**: CLI tool, VSCode extension, SARIF output for CI/CD
- **Examples**: https://github.com/CoinFabrik/scout-soroban-examples

#### OpenZeppelin Security Detectors SDK
Framework for building custom security detectors for Soroban.
- **GitHub**: https://github.com/OpenZeppelin/soroban-security-detectors-sdk
- **Detectors**: `auth_missing`, `unchecked_ft_transfer`, improper TTL, contract panics
- **Extensible**: Load external detector libraries, CI/CD ready

#### Certora Sunbeam Prover
Formal verification for Soroban — first WASM platform supported by Certora.
- **Docs**: https://docs.certora.com/en/latest/docs/sunbeam/index.html
- **Spec Language**: CVLR (Rust macros) — https://github.com/Certora/cvlr
- **Reports**: [Blend V1 verification](https://www.certora.com/reports/blend-smart-contract-verification-report)
- **Verifies at**: WASM bytecode level, eliminating compiler trust assumptions

#### Runtime Verification — Komet
Formal verification and testing tool designed for Soroban (SCF-funded).
- **Blog**: https://runtimeverification.com/blog/introducing-komet-smart-contract-testing-and-verification-tool-for-soroban-created-by-runtime-verification

#### Soroban Security Portal (Inferara)
Community security knowledge base (SCF-funded).
- **Website**: https://sorobansecurity.com
- **Features**: Searchable audit reports, vulnerability database, best practices

### CLI & SDKs

#### Stellar CLI
Official command-line interface for Stellar/Soroban.
- **Docs**: https://developers.stellar.org/docs/tools/stellar-cli
- **Features**: Contract build, deploy, invoke, bindings generation

#### Stellar SDK (JavaScript)
Official JavaScript/TypeScript SDK.
- **GitHub**: https://github.com/stellar/js-stellar-sdk
- **npm**: `@stellar/stellar-sdk`

#### Soroban Rust SDK
Rust SDK for Soroban contract development.
- **GitHub**: https://github.com/stellar/rs-soroban-sdk
- **Crate**: `soroban-sdk`

## Oracles

#### Reflector Network
Community-powered price oracle for Stellar.
- **Website**: https://reflector.network
- **Docs**: https://developers.stellar.org/docs/data/oracles/oracle-providers
- **Features**: SEP-40 compatible, on-chain/off-chain prices, webhooks
- **Integrations**: Blend, OrbitCDP, DeFindex, EquitX, Slender

#### DIA Oracle
Cross-chain oracle with 20,000+ asset support.
- **Website**: https://diadata.org
- **Blog**: https://www.diadata.org/blog/post/soroban-stellar-oracle-dia/
- **Features**: VWAPIR methodology, custom feeds

#### Band Protocol
Cross-chain data oracle on BandChain.
- **Website**: https://bandprotocol.com
- **Architecture**: Cosmos SDK-based, cross-chain

## Gaming & NFTs

#### Litemint
NFT marketplace and gaming platform.
- **GitHub**: https://github.com/litemint/litemint-soroban-contracts
- **Contracts**: Timed auctions, royalty payments
- **Features**: Open/sealed bids, ascending/descending price, buy-now

## Infrastructure

### Anchors & On/Off Ramps

#### Stellar Ramps
Suite of open standards for fiat-crypto bridges.
- **Docs**: https://stellar.org/use-cases/ramps
- **SEPs**: SEP-6, SEP-24, SEP-31 (deposits/withdrawals/cross-border)

#### Anchor Platform
SDF-maintained platform for building SEP-compliant anchors.
- **Docs**: https://developers.stellar.org/docs/learn/fundamentals/anchors
- **GitHub**: https://github.com/stellar/java-stellar-anchor-sdk

### Block Explorers

#### StellarExpert
Comprehensive network explorer with analytics.
- **Website**: https://stellar.expert
- **Features**: Transactions, accounts, assets, contracts

#### Stellar Lab
Developer tools and transaction builder.
- **Website**: https://lab.stellar.org

#### StellarChain
Alternative explorer with contract support.
- **Website**: https://stellarchain.io

### Disbursements

#### Stellar Disbursement Platform (SDP)
Bulk payment infrastructure for enterprises.
- **Docs**: https://developers.stellar.org/docs/category/use-the-stellar-disbursement-platform
- **GitHub**: https://github.com/stellar/stellar-disbursement-platform
- **Use Case**: Mass payments, aid distribution, payroll

## Example Repositories

### Official Examples

#### Soroban Examples
Official educational smart contract examples.
- **GitHub**: https://github.com/stellar/soroban-examples
- **Includes**: Tokens, atomic swaps, auth, events, liquidity pools, timelock, deployer, merkle distribution

#### Soroban Example dApp
Crowdfunding dApp with Next.js frontend.
- **GitHub**: https://github.com/stellar/soroban-example-dapp
- **Learning**: Full-stack Soroban development, Freighter integration

### Community Examples

#### Soroban Guide (Xycloo)
Learning resources and example contracts.
- **GitHub**: https://github.com/xycloo/soroban-guide
- **Includes**: Events, rock-paper-scissors, vaults, Dutch auctions

#### Soroban Contracts (icolomina)
Governance and investment contract examples.
- **GitHub**: https://github.com/icolomina/soroban-contracts
- **Includes**: Ballot voting, investment contracts, multisig

#### Oracle Example
Publisher-subscriber oracle pattern.
- **GitHub**: https://github.com/FredericRezeau/soroban-oracle-example
- **Uses**: soroban-kit oracle module

#### OZ Stellar NFT
Simple NFT using OpenZeppelin.
- **GitHub**: https://github.com/jamesbachini/OZ-Stellar-NFT

## Cross-Chain

#### Axelar
Cross-chain gateway and Interchain Token Service for Soroban.
- **GitHub**: https://github.com/axelarnetwork/axelar-amplifier-stellar
- **Use Case**: Cross-chain messaging, token bridging, interoperability
- **Status**: Active development (verify latest activity before integrating)

#### Allbridge Core
Cross-chain stable swap bridge (Stellar is 10th supported chain).
- **Use Case**: Cross-chain stablecoin transfers (USDC between Stellar, Base, Arbitrum, etc.)
- **Features**: Automatic Stellar account activation, liquidity pools

#### LayerZero
Omnichain interoperability protocol with Stellar support.
- **Use Case**: Cross-chain messaging, token bridging (OFT/ONFT), dApp interoperability
- **Features**: OApp standard, Omni-Chain Fungible Tokens, native issuer minting/burning control

## Builder Teams & Companies

Notable teams shipping production-level code on Stellar/Soroban. For a broader directory, see [Stellar Ecosystem](https://stellar.org/ecosystem).

| Team | Website | GitHub | X/Twitter | Notable Projects |
|------|---------|--------|-----------|-----------------|
| **Lightsail Network** | [lightsail.network](https://lightsail.network) | [lightsail-network](https://github.com/lightsail-network) | [@overcat_me](https://x.com/overcat_me) | Quasar RPC, Java/Python SDKs, Ledger app, validators |
| **PaltaLabs** | [paltalabs.io](https://paltalabs.io) | [paltalabs](https://github.com/paltalabs) | [@PaltaLabs](https://x.com/PaltaLabs) | Soroswap, DeFindex |
| **Aha Labs** | [ahalabs.dev](https://ahalabs.dev) | [AhaLabs](https://github.com/AhaLabs) | [@AhaLabsDev](https://x.com/AhaLabsDev) | Scaffold Stellar, Soroban CLI contributions |
| **OpenZeppelin** | [openzeppelin.com](https://www.openzeppelin.com/networks/stellar) | [OpenZeppelin](https://github.com/OpenZeppelin/stellar-contracts) | [@OpenZeppelin](https://x.com/OpenZeppelin) | Contracts library, Relayer, Monitor, Security Detectors SDK |
| **Cheesecake Labs** | [cheesecakelabs.com](https://cheesecakelabs.com) | [CheesecakeLabs](https://github.com/CheesecakeLabs) | [@CheesecakeLabs](https://x.com/CheesecakeLabs) | Stellar Plus library |
| **Script3 / Blend Capital** | [script3.io](https://script3.io) | [script3](https://github.com/script3), [blend-capital](https://github.com/blend-capital) | [@script3official](https://x.com/script3official) | Blend Protocol |
| **Xycloo Labs** | [xycloo.com](https://xycloo.com) | [Xycloo](https://github.com/Xycloo) | [@heytdep](https://x.com/heytdep) | Mercury indexer, Zephyr VM |
| **CoinFabrik** | [coinfabrik.com](https://www.coinfabrik.com) | [CoinFabrik](https://github.com/CoinFabrik) | [@coinfabrik](https://x.com/coinfabrik) | Scout Soroban (static analysis) |
| **Creit Tech** | [creit.tech](https://creit.tech) | [Creit-Tech](https://github.com/Creit-Tech) | [@CreitTech_](https://x.com/CreitTech_) | Stellar Wallets Kit, xBull, SorobanHub |
| **Ultra Stellar** | [ultrastellar.com](https://ultrastellar.com) | [lobstrco](https://github.com/lobstrco) | [@Lobstrco](https://x.com/Lobstrco) | LOBSTR wallet, StellarExpert |

## Project Directories

### Official Directories

#### Stellar Ecosystem Directory
The canonical, up-to-date project directory maintained by SDF.
- **Website**: https://stellar.org/ecosystem
- **Features**: Search by country, asset, category
- **Includes**: DeFi, wallets, anchors, on/off ramps, exchanges, infrastructure

#### SCF Project Tracker
All Stellar Community Fund–funded projects with status and milestones.
- **Website**: https://communityfund.stellar.org/projects

### Funding Programs

#### Stellar Community Fund (SCF)
Grants up to $150K per funding round.
- **Website**: https://communityfund.stellar.org
- **Funded**: 100+ projects across DeFi, NFT, GameFi, Web3

#### Soroban Audit Bank
Security audit funding for SCF projects.
- **Website**: https://stellar.org/grants-and-funding/soroban-audit-bank
- **Features**: Pre-negotiated audit rates, readiness checklist

## Real-World Assets

### Major Issuers on Stellar
- **Franklin Templeton**: Regulated fund tokens
- **Ondo**: Tokenized real estate
- **RedSwan**: $100M commercial real estate
- **Centrifuge**: Yield-generating tokens
- **WisdomTree**: Asset-backed tokens

### Stablecoins
- **USDC** (Circle): Primary USD stablecoin
- **EURC** (Circle): EUR stablecoin
- **PYUSD** (PayPal): Verify current issuance and distribution details before launch planning

## Enterprise Integrations

Major companies building on Stellar:
- **PayPal**: PYUSD stablecoin
- **Visa**: Settlement infrastructure
- **Mastercard**: Payment rails
- **Wirex**: USDC/EURC settlement
- **U.S. Bank**: Custom stablecoin testing
- **PwC**: Stablecoin exploration
