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
      "Charge AI agents for API calls with x402 paywalls or MPP payment channels.",
  },
  {
    source: "skills/zk-proofs/SKILL.md",
    category: "ZK",
    title: "ZK Proofs",
    description:
      "Verify Groth16 proofs on-chain via BLS12-381, with Circom, Noir, and RISC Zero toolchain walkthroughs.",
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
    title: "Cross-Chain (CCTP + Axelar)",
    description:
      "Bridge native USDC with Circle CCTP, pass messages and interchain tokens with Axelar GMP and ITS, and route intent-based swaps with NEAR Intents.",
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
      "https://github.com/OpenZeppelin/openzeppelin-skills/blob/main/skills/setup-stellar-contracts/SKILL.md",
  },
  {
    title: "DeFindex SDK",
    description:
      "Integrate DeFindex vaults on Stellar with the @defindex/sdk TypeScript package. Covers vault deposits and withdrawals, balance and APY queries, programmatic vault creation, and the unsigned-XDR signing pattern for backend and bot integrations.",
    pathLabel: "paltalabs/defindex-sdk",
    copyValue:
      "https://github.com/paltalabs/defindex-sdk/blob/main/defindex-sdk-skill.md",
  },
  {
    title: "Soroswap SDK",
    description:
      "Trade on Soroswap DEX from a backend, bot, or swap widget using the @soroswap/sdk TypeScript package. Covers token swaps, liquidity pool operations, price and route queries, API key handling, and signing flows for both server keypairs and browser wallets.",
    pathLabel: "soroswap/sdk",
    copyValue: "https://github.com/soroswap/sdk/blob/main/soroswap-sdk-skill.md",
  },
  {
    title: "Trustless Work Escrow",
    description:
      "Build escrow and milestone-based payment workflows on Stellar with the Trustless Work platform. Covers single-release and multi-release escrows, trustline configuration, dispute handling, and three integration paths: REST API, React SDK hooks, and pre-built Blocks UI components.",
    pathLabel: "Trustless-Work/trustless-work-dev-skill",
    copyValue:
      "https://github.com/Trustless-Work/trustless-work-dev-skill/blob/main/SKILL.md",
  },
  {
    title: "Agent Browser WebAuthn",
    description:
      "Drive passkey and Stellar smart account browser tests with agent-browser and Chrome DevTools virtual WebAuthn authenticators.",
    pathLabel: "kalepail/skills",
    copyValue:
      "https://github.com/kalepail/skills/blob/main/skills/agent-browser-webauthn/SKILL.md",
  },
  {
    title: "Anchors",
    description:
      "Integrate with or build Stellar anchors (fiat on/off-ramps, deposits/withdrawals, KYC). Covers core SEP flows (1/6/10/12/24/31/38) and common integration pitfalls.",
    pathLabel: "CheesecakeLabs/stellar-anchor-skill",
    copyValue:
      "https://github.com/CheesecakeLabs/stellar-anchor-skill/blob/main/SKILL.md",
  },
  {
    title: "PRISM Bounded Agent Treasury",
    description:
      "Give an AI agent a non-custodial, contract-bounded spending account on Stellar with PRISM. Covers treasury deployment with per-payment and rolling daily limits, payee whitelists, time-bound agent session keys, escrow, x402-gated payments, and Groth16/BN254 ZK compliance proofs verified on-chain.",
    pathLabel: "Bekirerdem/prism",
    copyValue: "https://github.com/Bekirerdem/prism/blob/main/SKILL.md",
  },
  {
    title: "ROZO Intents",
    description:
      "Send USDC and USDT across Stellar, Ethereum, Arbitrum, Base, BSC, Polygon, and Solana using natural language. Covers cross-chain bridging, wallet detection, fee estimation, tiered confirmation logic, and QR code payment parsing inside Claude Code.",
    pathLabel: "RozoAI/rozo-intents-skills",
    copyValue:
      "https://github.com/RozoAI/rozo-intents-skills/blob/main/SKILL.md",
  },
] as const;
