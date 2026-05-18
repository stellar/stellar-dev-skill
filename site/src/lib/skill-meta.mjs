import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Parse the title (first H1 of the body) and description (frontmatter
 * `description` field) from an upstream SKILL.md.
 *
 * Used at SSG time by the page render (src/app/page.tsx) and at build
 * time by the llms.txt generator (scripts/generate-llms-txt.mjs) so
 * both agree on the metadata each card displays.
 *
 * @typedef {{ title: string | null, description: string | null }} SkillMeta
 */

const PUBLIC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "public",
);

const parseFrontmatter = (content) => {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n?/.exec(content);
  if (!match) return { frontmatter: {}, body: content };
  const frontmatter = {};
  for (const line of match[1].split("\n")) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    frontmatter[kv[1]] = value;
  }
  return { frontmatter, body: content.slice(match[0].length) };
};

const firstH1 = (body) => {
  const m = /^#\s+(.+)$/m.exec(body);
  return m ? m[1].trim() : null;
};

/**
 * @param {string} source - upstream path like "skills/soroban/SKILL.md"
 * @returns {SkillMeta}
 */
export const readSkillMeta = (source) => {
  const filePath = join(PUBLIC_DIR, source);
  if (!existsSync(filePath)) return { title: null, description: null };
  const content = readFileSync(filePath, "utf8");
  const { frontmatter, body } = parseFrontmatter(content);
  return {
    title: firstH1(body),
    description: frontmatter.description ?? null,
  };
};
