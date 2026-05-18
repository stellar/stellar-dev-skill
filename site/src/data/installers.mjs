/**
 * Installer methods shown on the landing page and in llms.txt.
 *
 * Used by:
 * - src/app/page.tsx — one Card per entry inside the Installing section's
 *   filtered tablist.
 * - scripts/generate-llms-txt.mjs — same data under the `## Installing`
 *   heading.
 *
 * @typedef {{
 *   name: string,
 *   description: string,
 *   commands: readonly string[],
 * }} Installer
 */

/** @type {readonly Installer[]} */
export const INSTALLERS = [
  {
    name: "Claude Code",
    description: "Install using the plugin marketplace:",
    commands: [
      "/plugin marketplace add stellar/stellar-dev-skill",
      "/plugin install stellar-dev@stellar-dev-skill",
    ],
  },
  {
    name: "Cursor",
    description:
      "Install from the Cursor Marketplace, or add manually via Settings → Rules → Add Rule → Remote Rule (GitHub) with this slug:",
    commands: ["stellar/stellar-dev-skill"],
  },
  {
    name: "npx skills",
    description: "Install using the npx skills CLI:",
    commands: ["npx skills add https://github.com/stellar/stellar-dev-skill"],
  },
  {
    name: "Clone repo",
    description:
      "Clone the repo and copy the skills directory to your agent's skills location:",
    commands: ["git clone https://github.com/stellar/stellar-dev-skill"],
  },
];
