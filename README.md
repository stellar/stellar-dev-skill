# Stellar Development Skill

A comprehensive AI skill for modern Stellar development with current best practices. https://skills.stellar.org/

Inspired by [solana-foundation/solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill) and [cloudflare/skills](https://github.com/cloudflare/skills).

> [!NOTE]
> This skill was AI-generated using [Claude Code](https://claude.ai/code) and is currently under manual review. We welcome contributions! Please submit PRs, open issues, or provide feedback to help improve this resource for the Stellar ecosystem.

## Overview

This skill provides AI assistants with deep knowledge of the current Stellar development ecosystem:

- **Smart Contracts**: Stellar smart contracts (Rust soroban-sdk, WebAssembly)
- **Client SDKs**: stellar-sdk (JavaScript), Python, Go, Rust
- **APIs**: Stellar RPC (preferred), Horizon (legacy)
- **Assets**: Stellar Assets, Stellar Asset Contract (SAC)
- **Wallets**: Freighter, Stellar Wallets Kit, Smart Accounts (passkeys)
- **Testing**: Local Quickstart, Testnet, Unit tests
- **Security**: Smart contract security patterns, audit checklists
- **Ecosystem**: DeFi protocols, developer tools, community projects

## Raven: live MCP server

These skills give your agent durable Stellar context, baked in. [Raven](https://raven.stellar.buzz) is a complementary **remote Model Context Protocol (MCP) server** for on-demand lookups: connect an agent and it searches Stellar docs and live ecosystem data, cross-referenced into single answers. Its catalog also includes these skills, so Raven is a live delivery gateway for them. Use both: skills for durable best practices, Raven for current lookups.

Raven is open source at [kalepail/stellar-raven](https://github.com/kalepail/stellar-raven). Connect it in Claude Code:

```bash
claude mcp add --transport http stellar-raven "https://raven.stellar.buzz/mcp"
```

You can also try Raven in the browser at the [playground](https://raven.stellar.buzz/playground), a hosted chat UI for asking Raven questions (sign-in required).

## Installing

These skills work with any agent that supports the [Agent Skills](https://agentskills.io) standard.

### [Claude Code](https://code.claude.com/docs/en/discover-plugins#add-from-github)

```bash
# Add this repo as a marketplace
/plugin marketplace add stellar/stellar-dev-skill

# Then install the skill
/plugin install stellar-dev@stellar-dev
```

### [OpenAI Codex](https://developers.openai.com/codex/skills/)

```bash
git clone https://github.com/stellar/stellar-dev-skill ~/.codex/skills/stellar-dev-skill
```

### [npx skills](https://skills.sh)

```bash
npx skills add https://github.com/stellar/stellar-dev-skill
```

### Clone / Copy

```bash
git clone https://github.com/stellar/stellar-dev-skill
```

Copy the `skills/` directory contents to your assistant's skills location.

| Agent | Skill Directory | Docs |
|-------|-----------------|------|
| Claude Code | `~/.claude/skills/` | [docs](https://code.claude.com/docs/en/skills) |
| OpenCode | `~/.config/opencode/skill/` | [docs](https://opencode.ai/docs/skills/) |
| OpenAI Codex | `~/.codex/skills/` | [docs](https://developers.openai.com/codex/skills/) |
| Pi | `~/.pi/agent/skills/` | [docs](https://github.com/badlogic/pi-mono/tree/main/packages/coding-agent#skills) |

## Skill Structure

```
skills/
├── smart-contracts/           # Stellar smart contracts — SKILL.md entry + development/testing/security files
├── dapp/SKILL.md              # Frontend, wallets (Freighter, Wallets Kit), signing, smart accounts
├── assets/SKILL.md            # Stellar Assets, trustlines, SAC bridge
├── data/SKILL.md              # Stellar RPC (preferred) + Horizon (legacy), indexing
├── agentic-payments/SKILL.md  # x402 + MPP (Charge + Channel) for AI/machine payments
├── zk-proofs/SKILL.md         # ZK verification (BLS12-381 Groth16), Circom/Noir/RISC Zero walkthroughs
└── standards/SKILL.md         # SEPs, CAPs, ecosystem projects, curated reference links
```

Each sub-skill is a self-contained Agent Skill with its own frontmatter. Cross-references link related skills (e.g., the `agentic-payments` skill points to `smart-contracts` for the SACs the protocols call, and to `assets` for USDC). The AI reads only the sub-skills relevant to the task at hand.

## Example Prompts

```
"Help me write a Stellar smart contract for a token"
"Set up a Next.js app with Freighter wallet connection"
"How do I deploy a contract to Stellar Testnet?"
"Create unit tests for my smart contract"
"Review this contract for security issues"
```

## Contributing

Contributions are welcome! Please ensure any updates reflect current Stellar ecosystem best practices.

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Guidelines
- Keep information current (check stellar.org/developers for updates)
- Focus on practical, actionable guidance
- Include code examples where helpful
- Cite official documentation when possible

## Resources

- [Stellar Developers](https://developers.stellar.org)
- [Stellar Discord](https://discord.gg/stellar)
- [Stellar Stack Exchange](https://stellar.stackexchange.com)
- [SDF Blog](https://stellar.org/blog)

## License

Apache-2.0 License - see [LICENSE](LICENSE) for details.

---

> **Note:** This repository is not in scope for the Stellar Development Foundation bug bounty program. Vulnerabilities found in this repo are not eligible for rewards.
