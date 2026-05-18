#!/usr/bin/env node
/**
 * Mirrors `<repo-root>/skills/` into `<site>/public/skills/` so each
 * upstream SKILL.md is served at the same path on the deployed site.
 *
 * The site lives at `<repo-root>/site/` alongside `<repo-root>/skills/`.
 * Each card in src/data/skills.ts has a `source` field — an
 * upstream-relative path like "skills/soroban/SKILL.md" — that we copy
 * verbatim into public/, so the upstream layout drives the site URL.
 *
 * Flags:
 *   --cached   skip the copy if every advertised source already exists.
 *              Used by `predev` so subsequent dev starts work offline.
 *   --lenient  warn instead of failing when an advertised source has no
 *              corresponding upstream file. Used by `predev` for DX.
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const args = new Set(process.argv.slice(2));
const cached = args.has("--cached");
const strict = !args.has("--lenient");

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_ROOT = dirname(__dirname);
const REPO_ROOT = dirname(SITE_ROOT);
const PUBLIC_DIR = join(SITE_ROOT, "public");
const PUBLIC_SKILLS_DIR = join(PUBLIC_DIR, "skills");
const UPSTREAM_SKILLS_DIR = join(REPO_ROOT, "skills");
const SKILLS_DATA_FILE = join(SITE_ROOT, "src/data/skills.ts");

if (!existsSync(UPSTREAM_SKILLS_DIR)) {
  console.error(
    `[copy-skills] expected sibling skills/ at ${UPSTREAM_SKILLS_DIR}`,
  );
  process.exit(1);
}

// `source:` only appears in SKILL_CARD_SOURCES — ECOSYSTEM_CARDS uses
// `pathLabel:` / `copyValue:`, which the word boundary excludes.
const skillsSource = readFileSync(SKILLS_DATA_FILE, "utf8");
const sources = [
  ...skillsSource.matchAll(/\bsource:\s*"([^"]+)"/g),
].map((m) => m[1]);
if (sources.length === 0) {
  console.error(`[copy-skills] no sources found in ${SKILLS_DATA_FILE}`);
  process.exit(1);
}

// `--cached` skips the copy when every dest exists AND every dest is at
// least as fresh as its upstream source. Without the mtime check, editing
// a SKILL.md during `pnpm dev` wouldn't show up until the next manual
// `pnpm sync:skills`.
const isFresh = (source) => {
  const dest = join(PUBLIC_DIR, source);
  if (!existsSync(dest)) return false;
  const src = join(REPO_ROOT, source);
  if (!existsSync(src)) {
    // Upstream missing; --lenient will warn later. Treat as fresh so we
    // don't trigger a full re-copy just to discover the same missing file.
    return true;
  }
  return statSync(dest).mtimeMs >= statSync(src).mtimeMs;
};

if (cached && sources.every(isFresh)) {
  console.log(
    `[copy-skills] cached (${sources.length} files) — run \`pnpm sync:skills\` to refresh`,
  );
  process.exit(0);
}

// Clean stale files before copying so removed skills don't linger.
rmSync(PUBLIC_SKILLS_DIR, { recursive: true, force: true });

const missing = [];
for (const source of sources) {
  const src = join(REPO_ROOT, source);
  const dest = join(PUBLIC_DIR, source);
  if (!existsSync(src)) {
    missing.push(source);
    continue;
  }
  mkdirSync(dirname(dest), { recursive: true });
  cpSync(src, dest, { dereference: false });
}

// Apache-2.0 attribution alongside the content.
const upstreamLicense = join(REPO_ROOT, "LICENSE");
if (existsSync(upstreamLicense)) {
  mkdirSync(PUBLIC_SKILLS_DIR, { recursive: true });
  cpSync(upstreamLicense, join(PUBLIC_SKILLS_DIR, "LICENSE"), {
    dereference: false,
  });
}

if (missing.length > 0) {
  const lines = missing.map((s) => `  ${s}`).join("\n");
  const msg = `[copy-skills] ${missing.length} advertised source(s) missing under ${UPSTREAM_SKILLS_DIR}:\n${lines}`;
  if (strict) {
    console.error(msg);
    process.exit(1);
  }
  console.warn(msg);
}

const ok = sources.length - missing.length;
console.log(`[copy-skills] copied ${ok}/${sources.length} files`);
