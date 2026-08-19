# Stellar Ecosystem


This guide catalogs the major projects, protocols, and tools in the Stellar ecosystem. Use this as a reference when building on Stellar to find relevant integrations, examples, and community projects.

Companion to [SKILL.md](SKILL.md) (SEP/CAP standards routing); curated docs/SDK/learning links live in [resources.md](resources.md).

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

#### K2
Money market on Stellar with a modular router architecture (Aave V3-inspired). Live on mainnet.
- **Use Case**: Supply to earn variable interest, borrow against collateral, collateral swaps, flash loans
- **Website**: https://k2lend.com
- **Docs**: https://docs.k2lend.com — agent-friendly: every page has a `.md` twin, plus [llms.txt](https://docs.k2lend.com/llms.txt) and a full corpus export at [llms-full.txt](https://docs.k2lend.com/llms-full.txt)
- **Position model**: per reserve, an **aToken** (interest-bearing supply receipt) and a **debt ledger** token; balances are `scaled balance x current index`, so they accrue without user action. Separate liquidity index (linear approximation per interval) and borrow index (full compound). The index updates on the first interaction with a reserve in a ledger.
- **Rates**: variable only, two-slope curve with a kink at optimal utilization (typically 80%). `Supply Rate = Borrow Rate x Utilization x (1 - Reserve Factor)`. Up to 64 reserves.
- **Risk**: liquidation threshold 65–85% by asset (85% stables, 65% volatile); health factor < 1.0 is liquidatable with no grace period; partial liquidation by default, 100% when HF < 0.5 or the debt/collateral leg is under $2,000. Liquidation bonus 10% for XLM/SolvBTC/wBTC.
- **Fees**: reserve factor typically 10–20%; flash loan premium 9 bps default; liquidation protocol fee 0.3% default. No deposit/withdraw/repay fees.
- **Oracle**: RedStone primary, Reflector fallback. Staleness rejection (1h default, per-asset override), 20% circuit breaker that keeps the last good price, zero-price rejection, and a global oracle pause.
- **Flash loans**: enabled per reserve plus a global kill switch; repay principal + premium in the same transaction or the whole thing reverts.
- **DEX integration**: Soroswap and Aquarius adapters power collateral swaps and flash liquidations. **Direct pairs only — no multi-hop routing**, so a swap fails if no direct pair exists.
- **Liquidation access**: whitelisted liquidators during the launch period, opening to permissionless over time — check current state before building a liquidation bot.
- **Audits**: Halborn, WatchPug, and a Code4rena contest; Hypernative for runtime monitoring.

**Mainnet contracts.** `kinetic_router` is the entry point you call; the rest are the modules it routes to.

| Contract | Address |
|----------|---------|
| `kinetic_router` | `CCTUJZLYFAW7ZNQD2SXMUZIHBUUJJICYRKWLZJ6SK6TGNAWNXOJIV6J7` |
| `configurator` | `CAYS7DTBBBG6TDT326KYTE72L6Q7NSEI2U2CA7TKCQIWPXB2GNJWU7M4` |
| `price_oracle` | `CCHRZE2K5TCERZLDO5IXDUWUKLRPVE72DI3TDF2RP6EQKEW6BNOMQRMU` |
| `interest_rate` | `CATBSCEN73MFGD4LCCC6SFJHGNEHC2QLSSXFZXFCW3NK45BBPGEYDXOC` |
| `treasury` | `CCQ4J5VLQHM2ORP4K7GBVAJJPK5SGG23DH4RD7QEHAZDHTN7JNESNXKZ` |
| `incentives` | `CAAMA46SQXQKHZDWAS2CNZVAX67TOMGBVH3DVSZSMDKKVP25VGTDQIRX` |
| `flash_liquidation` | `CACGHPQB2QOKNAPH3PVGKXXSULNGMNZYWVZQVPTHMWHFRXAGASSRNQ7H` |
| `reward_token` | `CA4V5C3KWDXBJEPIIKZT2PQWQZB4SY3G3G3S4PYPD5XXGXF5RKQUBE2N` |
| `soroswap_swap_adapter` | `CDL35ZAOYVDBMSTIKOF4HJKXA7MWHF5ZJNZKES6EAZAOOHLXURSGSYAJ` |
| `aquarius_swap_adapter` | `CBJBQMSBXYBOSRK6WLBAEVGF2GXQVPTYVVMVDGZF7ZBJHHFT2IGJNDMN` |
| `aquarius_multihop_swap_handler` | `CB3EHO42TDWT5EG6X62QTMPQPWIETVFLM7Q7DT62Z6MT5J4HP33XKXWE` |
| `solvbtc_composite_oracle` | `CABOR5KOCMIC226J5B63W5MV75VH5ZPAFEXZFET2JDD2H6IGJY5UPWP4` |

**Reserve tokens.** Read a user's supply balance from the aToken and their debt from the debt ledger. The `underlying` column is the asset's SAC, not a K2 contract.

| Market | Underlying (SAC) | aToken | Debt ledger |
|--------|------------------|--------|-------------|
| USDC | `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75` | `CDHRPTO3NLGQ2CV75LFV6NF6ZMXIPGPID5GTAZTEICBYLMLKJICOMFZK` | `CBN4GDHRJN7AIARTSTUD3OK7IOCU5V6HTSOTVARFUA5KVE7XSNBZUQG6` |
| XLM | `CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA` | `CDTHJR27QWKAPCFTZWKP7GTX3RZO7HACVAC2KLCW2RENCMOCI35ORU5K` | `CC3OKG4VDLGFBS7V6UTSJVP3YL3A4OLV63EMTNUU3MQ2AOAU4M65H7QG` |
| PYUSD | `CCCRWH6Q3FNP3I2I57BDLM5AFAT7O6OF6GKQOC6SSJNDAVRZ57SPHGU2` | `CA7ELGRS4FNCYJPRZSNLF7NDD6VVOFZKFKMY56VVSG3RMNYTFQNNFUTD` | `CAVFE34MWBIXT4AOFXPTI7U7JTLPHKG4YWDDMRXVJOIZKG6HFJW3IHXV` |
| SolvBTC | `CBIJBDNZNF4X35BJ4FFZWCDBSCKOP5NB4PLG4SNENRMLAPYG4P5FM6VN` | `CDDTJ7OZU2WZAEZNTUZWIRAE4EMP5CF63M3INFQWTLX4ENMYUFK6RCTX` | `CADGKVZKBNLPKFIWDWTRSQAPBWH77H2OPJIF3WGVL7VADVLCXDZ5CSNH` |

wBTC appears in K2's risk-parameter and liquidation tables as a supported asset but has no published reserve token set — treat only the four markets above as live.

**External contracts K2 reads or routes through** (not K2-owned): Reflector Stellar mainnet DEX oracle `CALI2BYU2JE6WVRUFYTS6MSBNEHGJ35P4AVCZYF3B6QOE3QKOB2PLE6M`, Reflector external CEX/DEX oracle `CAFJZQWSED6YAWZU3GWRTOCNPPCGBN32L7QV43XX5LZLFTK6JLN34DLN`, RedStone batch adapter `CA526Y2NQWGWVVQ7RFFPGAZMU66PSYJ3UC2MTVAV4ZU7OM5BOPHDXUSG`.

> Every address above was resolved on pubnet (2026-07-31). Legacy manual reserve tokens and published-but-uninstantiated WASM hashes are omitted; [docs.k2lend.com/contracts](https://docs.k2lend.com/contracts) is the source of truth — re-check it before hard-coding, since reserves and adapters can be added or rotated.

#### Slender
First non-custodial lending protocol on Stellar with flash loan support.
- **Use Case**: Lending, borrowing, flash loans
- **Features**: Pool-based strategy, sTokens, dTokens, utilization caps
- **Oracle**: SEP-40 compatible (Reflector)

### DEXs & AMMs

#### Soroswap
First DEX and aggregator on Stellar.
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
AMM protocol on Stellar.
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
- **Features**: Smart contract support, mobile apps (iOS/Android), Discover browser

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
Comprehensive TypeScript SDK for OpenZeppelin Smart Accounts on Stellar.
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
Multi-chain indexer supporting Stellar.
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
Audited smart contract library for Stellar (track latest release tags before pinning versions).
- **GitHub**: https://github.com/OpenZeppelin/stellar-contracts
- **Docs**: https://developers.stellar.org/docs/tools/openzeppelin-contracts
- **Contract Wizard**: https://wizard.openzeppelin.com/stellar
- **Includes**: Tokens (fungible/NFT), governance (timelock), vaults (SEP-56), access control, fee forwarder
- **Crates**: `stellar-tokens`, `stellar-access`, `stellar-contract-utils`

### Security Tools

Usage details, detector lists, and workflow guidance live in [the smart contract security guide](../smart-contracts/security.md#tooling). Catalog:

- [Scout Soroban](https://github.com/CoinFabrik/scout-soroban) (CoinFabrik) - static analysis, 20+ detectors, VSCode extension, SARIF output ([examples](https://github.com/CoinFabrik/scout-soroban-examples))
- [Security Detectors SDK](https://github.com/OpenZeppelin/soroban-security-detectors-sdk) (OpenZeppelin) - pre-built detectors plus a framework for custom ones
- [Certora Sunbeam Prover](https://docs.certora.com/en/latest/docs/sunbeam/index.html) - formal verification at WASM level, CVLR spec language ([Blend V1 report](https://www.certora.com/reports/blend-smart-contract-verification-report))
- [Komet](https://docs.runtimeverification.com/komet) (Runtime Verification) - property testing and formal verification via KWasm semantics ([reports](https://github.com/runtimeverification/publications))
- [Soroban Security Portal](https://sorobansecurity.com) (Inferara) - searchable audit reports and vulnerability database

### CLI & SDKs

#### Stellar CLI
Official command-line interface for Stellar.
- **Docs**: https://developers.stellar.org/docs/tools/stellar-cli
- **Features**: Contract build, deploy, invoke, bindings generation

#### Stellar SDK (JavaScript)
Official JavaScript/TypeScript SDK.
- **GitHub**: https://github.com/stellar/js-stellar-sdk
- **npm**: `@stellar/stellar-sdk`

#### Soroban Rust SDK
Rust SDK for smart contract development.
- **GitHub**: https://github.com/stellar/rs-soroban-sdk
- **Crate**: `soroban-sdk`

### AI & MCP Tools

#### Raven
Remote Model Context Protocol (MCP) server for AI agents. Searches Stellar docs and live ecosystem data, cross-referenced into single answers. Its catalog also serves these skills.
- **Server**: https://raven.stellar.buzz (MCP endpoint: https://raven.stellar.buzz/mcp)
- **Playground**: https://raven.stellar.buzz/playground (hosted chat UI for humans; sign-in required)
- **GitHub**: https://github.com/kalepail/stellar-raven
- **Connect (Claude Code)**: `claude mcp add --transport http stellar-raven "https://raven.stellar.buzz/mcp"`
- **Tools**: `search`, `execute`

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
- **Learning**: Full-stack contract development, Freighter integration

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
Cross-chain gateway and Interchain Token Service for Stellar.
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

Notable teams shipping production-level code on Stellar. For a broader directory, see [Stellar Ecosystem](https://stellar.org/ecosystem).

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
