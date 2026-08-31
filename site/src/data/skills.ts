/**
 * Static content for the Stellar Skills landing page.
 *
 * Each entry in SKILL_CARD_SOURCES points at a markdown file in
 * stellar/stellar-dev-skill (via `source`). At build time we copy that
 * file to public/<source>, so it's served at the same path on
 * skills.stellar.org. Title and description default to the upstream
 * SKILL.md's frontmatter `description` and first `# heading`; override
 * them here when you want to tune the landing-page voice.
 */

/**
 * Categories used by `FILTERS` and by each card's `category`. Kept local
 * because nothing outside this file needs it: `SkillsFilter` takes any
 * `readonly string[]`, and consumers reference `FILTERS` directly.
 */
type FilterType =
  | "All"
  | "Agentic Payments"
  | "Smart Contracts"
  | "Frontend"
  | "Assets"
  | "APIs"
  | "ZK"
  | "Cross-Chain"
  | "Ecosystem";

/**
 * Filter tabs displayed above the skill cards. The order here is the order
 * shown in the UI.
 */
export const FILTERS: readonly FilterType[] = [
  "All",
  "Smart Contracts",
  "Agentic Payments",
  "Frontend",
  "Assets",
  "APIs",
  "ZK",
  "Cross-Chain",
  "Ecosystem",
] as const;

/**
 * A skill entry mirrored from stellar/stellar-dev-skill. `source` is the
 * upstream path; the site path and fetch destination are both derived
 * from it. `title` and `description` are optional — the page falls back
 * to upstream metadata when they're omitted.
 */
export type SkillCardSource = {
  /** Upstream path, e.g. "skills/smart-contracts/SKILL.md". Forms both the
   *  fetch source and the site URL ("/" + source). */
  source: string;
  category: FilterType;
  /** Optional title override; defaults to the first H1 of the markdown. */
  title?: string;
  /** Optional short summary used on the landing card (keep to ~2 lines
   *  so cards stay scannable). llms.txt always prefers the upstream
   *  frontmatter `description` over this; this value is the fallback
   *  there. */
  description?: string;
};

/**
 * An ecosystem-contributed skill. Unlike SkillCardSource, these point at
 * fully-qualified external URLs (typically GitHub) and are displayed
 * verbatim.
 */
export type EcosystemCardSource = {
  title: string;
  description: string;
  /** Display label for the link (shorter than the full URL). */
  pathLabel: string;
  /** Full URL copied to clipboard when the user clicks the pill. */
  copyValue: string;
};

/**
 * Skills mirrored from stellar/stellar-dev-skill. One entry per upstream
 * SKILL.md.
 */
export const SKILL_CARD_SOURCES: readonly SkillCardSource[] = [
  {
    source: "skills/smart-contracts/SKILL.md",
    category: "Smart Contracts",
    title: "Stellar Smart Contracts",
    description:
      "Write, test, secure, and ship Rust smart contracts on Stellar. Covers patterns, pitfalls, and architecture.",
  },
  {
    source: "skills/dapp/SKILL.md",
    category: "Frontend",
    title: "Frontend & Wallets",
    description:
      "Build Stellar dApps with the JavaScript SDK, Freighter, Wallets Kit, and passkey smart accounts.",
  },
  {
    source: "skills/assets/SKILL.md",
    category: "Assets",
    title: "Stellar Assets & SAC",
    description:
      "Issue and manage classic Stellar assets and trustlines, with the SAC bridge for smart contract interop.",
  },
  {
    source: "skills/data/SKILL.md",
    category: "APIs",
    title: "RPC & Horizon APIs",
    description:
      "Query Stellar chain data with RPC (preferred) and Horizon (legacy). Covers streaming, indexing, and migration.",
  },
  {
    source: "skills/agentic-payments/SKILL.md",
    category: "Agentic Payments",
    title: "Agent Payments (x402 + MPP)",
    description:
      "Charge AI agents for API calls with x402 paywalls or MPP sessions settled over payment channels.",
  },
  {
    source: "skills/zk-proofs/SKILL.md",
    category: "ZK",
    title: "ZK Proofs",
    description:
      "Verify Groth16 and UltraHonk proofs on-chain via BLS12-381 and BN254, with Circom, Noir, and RISC Zero toolchain walkthroughs.",
  },
  {
    source: "skills/standards/SKILL.md",
    category: "Ecosystem",
    title: "SEPs, CAPs & Ecosystem",
    description:
      "Pick the right SEP or CAP for your feature, with ecosystem projects, curated reference links, and MCPs.",
  },
  {
    source: "skills/cross-chain/SKILL.md",
    category: "Cross-Chain",
    title: "Cross-Chain (CCTP, Axelar)",
    description:
      "Bridge native USDC with Circle CCTP, pass messages and tokens with Axelar GMP/ITS, and route intent-based swaps with NEAR Intents.",
  },
] as const;

/**
 * Community-contributed skills hosted on third-party sites (e.g. GitHub).
 * Displayed in the "Community skills" section at the bottom of the page.
 */
export const ECOSYSTEM_CARDS: readonly EcosystemCardSource[] = [
  {
    title: "OpenZeppelin Contracts",
    description:
      "Scaffold a Stellar smart contract project with OpenZeppelin's audited Stellar contract libraries. Walks through Rust toolchain setup, Stellar CLI install, workspace dependencies, and applying the pausable and ownable macros to your contract.",
    pathLabel: "OpenZeppelin/openzeppelin-skills",
    copyValue:
      "https://raw.githubusercontent.com/OpenZeppelin/openzeppelin-skills/main/skills/setup-stellar-contracts/SKILL.md",
  },
  {
    title: "DeFindex SDK",
    description:
      "Integrate DeFindex vaults on Stellar with the @defindex/sdk TypeScript package. Covers vault deposits and withdrawals, balance and APY queries, programmatic vault creation, and the unsigned-XDR signing pattern for backend and bot integrations.",
    pathLabel: "paltalabs/defindex-sdk",
    copyValue:
      "https://raw.githubusercontent.com/paltalabs/defindex-sdk/main/defindex-sdk-skill.md",
  },
  {
    title: "Soroswap SDK",
    description:
      "Trade on Soroswap DEX from a backend, bot, or swap widget using the @soroswap/sdk TypeScript package. Covers token swaps, liquidity pool operations, price and route queries, API key handling, and signing flows for both server keypairs and browser wallets.",
    pathLabel: "soroswap/sdk",
    copyValue: "https://raw.githubusercontent.com/soroswap/sdk/main/soroswap-sdk-skill.md",
  },
  {
    title: "Trustless Work Escrow",
    description:
      "Build escrow and milestone-based payment workflows on Stellar with the Trustless Work platform. Covers single-release and multi-release escrows, trustline configuration, dispute handling, and three integration paths: REST API, React SDK hooks, and pre-built Blocks UI components.",
    pathLabel: "Trustless-Work/trustless-work-dev-skill",
    copyValue:
      "https://raw.githubusercontent.com/Trustless-Work/trustless-work-dev-skill/main/SKILL.md",
  },
  {
    title: "Agent Browser WebAuthn",
    description:
      "Drive passkey and Stellar smart account browser tests with agent-browser and Chrome DevTools virtual WebAuthn authenticators.",
    pathLabel: "kalepail/skills",
    copyValue:
      "https://raw.githubusercontent.com/kalepail/skills/main/skills/agent-browser-webauthn/SKILL.md",
  },
  {
    title: "Anchors",
    description:
      "Integrate with or build Stellar anchors (fiat on/off-ramps, deposits/withdrawals, KYC). Covers core SEP flows (1/6/10/12/24/31/38) and common integration pitfalls.",
    pathLabel: "CheesecakeLabs/stellar-anchor-skill",
    copyValue:
      "https://raw.githubusercontent.com/CheesecakeLabs/stellar-anchor-skill/main/SKILL.md",
  },
  {
    title: "Eunomia Bounded Agent Treasury",
    description:
      "Give an AI agent a non-custodial, contract-bounded spending account on Stellar with Eunomia (formerly PRISM). Covers treasury deployment with per-payment and rolling daily limits, payee whitelists, time-bound agent session keys, escrow, x402-gated payments, and Groth16/BN254 ZK compliance proofs verified on-chain.",
    pathLabel: "eunomia-finance/eunomia",
    copyValue: "https://raw.githubusercontent.com/eunomia-finance/eunomia/main/SKILL.md",
  },
  {
    title: "ROZO Intents",
    description:
      "Send USDC and USDT across Stellar, Ethereum, Arbitrum, Base, BSC, Polygon, and Solana using natural language. Covers cross-chain bridging, wallet detection, fee estimation, tiered confirmation logic, and QR code payment parsing inside Claude Code.",
    pathLabel: "RozoAI/rozo-intents-skills",
    copyValue:
      "https://raw.githubusercontent.com/RozoAI/rozo-intents-skills/main/SKILL.md",
  },
  {
    title: "Caatinga",
    description:
      "Deploy and manage Soroban contract lifecycles with the Caatinga CLI (ctg). Covers the init → doctor → build → deploy → generate → invoke workflow, the multi-contract Deployment Graph, versioned caatinga.artifacts.json as the source of truth for contract IDs, generated TypeScript bindings, and wallet adapters (Freighter, Stellar Wallets Kit) — with hard rules against raw secret keys on the command line and hand-edited artifacts or bindings.",
    pathLabel: "Dione-b/caatinga-skill",
    copyValue:
      "https://raw.githubusercontent.com/Dione-b/caatinga-skill/master/skills/caatinga/SKILL.md",
  },
  {
    title: "Sozu Testnet USDC Faucet",
    description:
      "Claim Circle USDC on Stellar testnet with a PoW-gated CLI, using an existing C…/G… address or a newly generated G… wallet with a USDC trustline.",
    pathLabel: "blessedux/agent-skills",
    copyValue:
      "https://raw.githubusercontent.com/blessedux/agent-skills/main/sozu-faucet/SKILL.md",
  },
  {
    title: "LumenLoop MCP Connect",
    description:
      "Connect any MCP client (Claude, ChatGPT, Gemini, Cursor) to LumenLoop's free read-only Stellar ecosystem MCP and learn its query tools for directory, content, and SCF data.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/lumenloop-mcp-connect/SKILL.md",
  },
  {
    title: "SCF Submission Radar",
    description:
      "Position a Stellar Community Fund idea against prior submissions before applying: find similar past proposals, check what's been funded in an area, and sharpen positioning.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/scf-submission-radar/SKILL.md",
  },
  {
    title: "Stellar Builder Quickstart",
    description:
      "Go from a Stellar product idea to a build path: pick the right primitives, check ecosystem prior art via LumenLoop, and route to the relevant build skill.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-builder-quickstart/SKILL.md",
  },
  {
    title: "Stellar Content Auditor",
    description:
      "Audit draft posts and announcements against Stellar ecosystem data: resolve project names and X handles, pull supporting citations, and flag unsupported claims.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-content-auditor/SKILL.md",
  },
  {
    title: "Stellar Ecosystem Digest",
    description:
      "Produce a dated, cited digest of recent Stellar ecosystem activity on a theme or entity from indexed news, talks, events, and research.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-ecosystem-digest/SKILL.md",
  },
  {
    title: "Stellar Ecosystem Scout",
    description:
      "Map a sector of the Stellar ecosystem into a landscape of projects, categories, and regions using the LumenLoop directory and semantic search.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-ecosystem-scout/SKILL.md",
  },
  {
    title: "Stellar Integration Finder",
    description:
      "Find the right existing Stellar project or tool to integrate (wallet, oracle, anchor, DEX, indexer) via the LumenLoop directory, then route to the matching build skill.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-integration-finder/SKILL.md",
  },
  {
    title: "Stellar Project Dossier",
    description:
      "Build a due-diligence profile of a single Stellar project: details, related content, talks, SCF history, and similar projects from the LumenLoop directory.",
    pathLabel: "lumenloop/lumenloop-skills",
    copyValue:
      "https://raw.githubusercontent.com/lumenloop/lumenloop-skills/main/skills/stellar-project-dossier/SKILL.md",
  },
  {
    title: "Stellar Scout",
    description:
      "Scout the Stellar ecosystem before you build: validate ideas against shipped projects, match open SCF-funded RFPs, draft SCF pitches, find audit firms, and pull cited prior art from 2,000+ indexed repos.",
    pathLabel: "stellarlight.xyz/scout",
    copyValue: "https://stellarlight.xyz/skills/stellar-scout.md",
  },
  {
    title: "Sub Rosa",
    description:
      "Integrate sealed coordination into Stellar apps with @sub-rosa/sdk: run sealed-bid asset auctions with SAC escrow and atomic lot settlement, confidential proposal rounds, Drand-timed reveal, permissionless lifecycle automation, and verifiable Core v2 receipts.",
    pathLabel: "karagozemin/Sub-Rosa",
    copyValue:
      "https://raw.githubusercontent.com/karagozemin/Sub-Rosa/main/skills/sub-rosa/SKILL.md",
  },
  {
    title: "ROZO Checkout",
    description:
      "Pay for AI services with Stellar USDC — e.g. OpenRouter and Venice.ai, which cannot take Stellar directly — through a one-time deposit order and automatic invoice settlement. More AI services coming.",
    pathLabel: "RozoAI/rozo-checkout-skill",
    copyValue:
      "https://raw.githubusercontent.com/RozoAI/rozo-checkout-skill/main/SKILL.md",
  },
  {
    title: "MPP Discover",
    description:
      "Find and pay APIs from 90+ services with Stellar USDC through MPP Router — including OpenAI, Anthropic, DeepSeek, Perplexity, Exa, Firecrawl, and Tavily. An agent fetches the live service catalog, picks a service, and settles per request. Every verified service is backed by a real paid call with a published Stellar transaction hash.",
    pathLabel: "mpprouter/stellar-agent-wallet-skill",
    copyValue:
      "https://raw.githubusercontent.com/mpprouter/stellar-agent-wallet-skill/main/skills/discover/SKILL.md",
  },
  {
    title: "Stellar Agent Search",
    description:
      "Read-only, keyless MCP server that lets an AI agent discover, rank, and vet on-chain Stellar 8004 agents on mainnet by natural-language query, stopping before any payment or signing.",
    pathLabel: "berkingurcan/stellar-agent-search",
    copyValue:
      "https://raw.githubusercontent.com/berkingurcan/stellar-agent-search/main/skills/mcp/SKILL.md",
  },
  {
    title: "Cogladius",
    description:
      "Register an AI agent to earn XLM by completing on-chain tasks: one-call permissionless registration, task polling, solution submission, and payout from a non-custodial Soroban escrow on an ed25519-verified judge verdict.",
    pathLabel: "furkanyesildag/cogladius",
    copyValue:
      "https://raw.githubusercontent.com/furkanyesildag/cogladius/main/SKILL.md",
  },
  {
    title: "Soroban Common Mistakes",
    description:
      "Review Soroban contracts against 23 recurring security mistakes before shipping: missing authorization, storage and TTL pitfalls, arithmetic overflow, and unsafe panic handling. Ships with a reviewable checklist, a PR template, and a Scout CI workflow. Available in English and Spanish.",
    pathLabel: "mariaelisaaraya/stellar-security-guide",
    copyValue:
      "https://raw.githubusercontent.com/mariaelisaaraya/stellar-security-guide/main/skills/soroban-common-mistakes/SKILL.md",
  },
  {
    title: "StellarTools",
    description:
      "Stripe-level payment infrastructure for Stellar. Accept crypto and fiat payments with hosted checkouts, Soroban-powered subscriptions with flexible billing periods, customer portals, and normalized webhooks. Includes WooCommerce and Shopify adapters, an apps marketplace, and an MCP server for agent-driven payment management. ⁠",
    pathLabel: "payrouteshq/stellartools",
    copyValue: "https://raw.githubusercontent.com/payrouteshq/stellartools/main/SKILL.md",
  },
  {
    title: "Nirium Agentic Payments",
    description:
      "Charge AI agents per API call on Stellar with the Nirium toolkit: scaffold a working x402 seller with nirium-cli in one command, charge per route with x402Serve() from the nirium SDK, and read live protocol data, market state, autonomous loop status, and execution nodes through the nirium-mcp server. Live on mainnet since July 9, 2026.",
    pathLabel: "nirium-protocol/nirium-sdk",
    copyValue:
      "https://raw.githubusercontent.com/nirium-protocol/nirium-sdk/main/skills/nirium-agentic-payments/SKILL.md",
  },
  {
    title: "Contextio SDK",
    description:
      "Integrate contextio-sdk: verifiable, non-custodial legal context binding (Legal Context Protocol / LCP) for Stellar treasury and payroll. Covers Sign In With Stellar (SEP-53) wallet auth, reading a tenant's treasury/payroll/agent state, triggering an agent proposal, and independently hashing/verifying an LCP document against an on-chain hash.",
    pathLabel: "Eras256/Contextio",
    copyValue:
      "https://raw.githubusercontent.com/Eras256/Contextio/main/packages/sdk/SKILL.md",
  },
  {
    title: "PMLL",
    description:
      "Gives AI agents persistent spatial memory so they can retain long-term context, form symbiotic memory layers, and maintain durable state across sessions; supports PPM-based context stitching, Context+ pipelines, and supermodeltools/cli for graphing and analysis. On-chain commitment anchoring on Stellar (32-byte hashes via a Soroban contract) is planned.",
    pathLabel: "drQedwards/pmll",
    copyValue: "https://raw.githubusercontent.com/drQedwards/pmll/main/SKILL.md",
  },
] as const;
