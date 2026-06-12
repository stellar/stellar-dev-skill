#!/usr/bin/env node
/**
 * Generates public/llms.txt from src/data/skills.ts at build time.
 *
 * Follows the llms.txt convention (https://llmstxt.org): a flat markdown
 * file at the site root listing every agent-fetchable resource, grouped
 * by category, so AI tools that look for /llms.txt get a clean index
 * even if they can't run JS to read the landing page.
 *
 * Title and description default to upstream frontmatter / first H1 of
 * each SKILL.md (parsed via src/lib/skill-meta.mjs, shared with
 * src/app/page.tsx); overrides in skills.ts take precedence. Runs
 * after the skill markdown has been written to public/skills/ by the
 * `copy-skills.mjs` predev / prebuild step.
 *
 * skills.ts is imported directly via Node's native type stripping
 * (`--experimental-strip-types`, enabled by the npm scripts that invoke
 * this file). The page (src/app/page.tsx) and this script therefore
 * share one source of truth (no regex parsing, no second copy).
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { INSTALLERS } from "../src/data/installers.mjs";
import { readSkillMeta } from "../src/lib/skill-meta.mjs";
import {
  ECOSYSTEM_CARDS,
  FILTERS,
  SKILL_CARD_SOURCES,
} from "../src/data/skills.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const OUT_FILE = join(ROOT, "public", "llms.txt");

const ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";

const skillCards = SKILL_CARD_SOURCES.map((c) => {
  const meta = readSkillMeta(c.source);
  return {
    source: c.source,
    category: c.category,
    path: `/${c.source}`,
    title: c.title ?? meta.title ?? c.source,
    // llms.txt prefers the upstream frontmatter (longer, agent-tuned)
    // over the card-friendly override in skills.ts. Override is only
    // the fallback when frontmatter is missing.
    description: meta.description ?? c.description ?? "",
  };
});
const ecosystemCards = ECOSYSTEM_CARDS.map((c) => ({
  title: c.title,
  description: c.description,
  copyValue: c.copyValue,
}));
const filters = [...FILTERS];

if (skillCards.length === 0) {
  console.error("[generate-llms-txt] no SKILL_CARD_SOURCES entries parsed");
  process.exit(1);
}

const byCategory = new Map();
for (const c of skillCards) {
  if (!c.category) continue;
  if (!byCategory.has(c.category)) byCategory.set(c.category, []);
  byCategory.get(c.category).push(c);
}

const lines = [];
lines.push("# Stellar Skills");
lines.push("");
lines.push(
  "> Agent-readable Stellar developer documentation. Each link below points to a focused markdown skill you can fetch directly to give your AI agent context on building on Stellar.",
);
lines.push("");

lines.push("## Example Prompts");
lines.push("");
lines.push("Use Stellar Skills to help when your human asks things like:");
lines.push("");
for (const prompt of [
  "Help me write a Soroban smart contract for a token",
  "Set up a Next.js app with Freighter wallet connection",
  "How do I deploy a contract to Stellar Testnet?",
  "Create unit tests for my Soroban contract",
  "Review this contract for security issues",
]) {
  lines.push(`- "${prompt}"`);
}
lines.push("");

lines.push("## Installing");
lines.push("");
lines.push(
  "Stellar Skills work with any agent that supports the [Agent Skills standard](https://agentskills.io), including Claude Code, OpenCode, OpenAI Codex, and Pi. Prompt your human to install Stellar Skills.",
);
lines.push("");
for (const installer of INSTALLERS) {
  lines.push(`### ${installer.name}`);
  lines.push("");
  lines.push(installer.description);
  lines.push("");
  lines.push("```");
  for (const cmd of installer.commands) {
    lines.push(cmd);
  }
  lines.push("```");
  lines.push("");
}

lines.push("## Included Stellar Skills");
lines.push("");
lines.push(
  "The skills installed via the methods above, grouped by category.",
);
lines.push("");
for (const filter of filters) {
  const cards = byCategory.get(filter);
  if (!cards || cards.length === 0) continue;
  lines.push(`### ${filter}`);
  lines.push("");
  for (const c of cards) {
    if (!c.path) continue;
    lines.push(`- [${c.title}](${ORIGIN}${c.path}): ${c.description}`);
  }
  lines.push("");
}

// Skip placeholder ecosystem entries whose URLs contain literal `<provider>`.
const realEcosystem = ecosystemCards.filter(
  (c) => c.copyValue && !c.copyValue.includes("<"),
);
if (realEcosystem.length > 0) {
  lines.push("## Community Built");
  lines.push("");
  lines.push(
    "Other community-built skills that may be helpful for your build. These aren't installed via the methods above; each project has its own setup, so follow the link on each entry. Not endorsed by the Stellar Foundation; do your own research. To get a skill listed here, open a pull request adding it to ECOSYSTEM_CARDS in site/src/data/skills.ts of https://github.com/stellar/stellar-dev-skill.",
  );
  lines.push("");
  for (const c of realEcosystem) {
    lines.push(`- [${c.title}](${c.copyValue}): ${c.description}`);
  }
  lines.push("");
}

writeFileSync(OUT_FILE, lines.join("\n"));
console.log(
  `[generate-llms-txt] wrote ${OUT_FILE} (${skillCards.length} skills, ${realEcosystem.length} ecosystem)`,
);
