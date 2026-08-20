#!/usr/bin/env node
/**
 * Fails if any ECOSYSTEM_CARDS entry's `copyValue` points at GitHub's
 * HTML blob viewer (`github.com/.../blob/...`) instead of raw content.
 *
 * `copyValue` is written directly into `public/llms.txt`'s "Community
 * Built" section by generate-llms-txt.mjs, and is the exact string an
 * agent fetches to install the skill, so it has to resolve to markdown
 * (`raw.githubusercontent.com/...`), not GitHub's rendered page
 * (`content-type: text/html`, not `text/plain` or `text/markdown`).
 * Static check, no network calls: catches the mistake at review time
 * instead of relying on a future skills.stellar.org/llms.txt spot check.
 */
import { ECOSYSTEM_CARDS } from "../src/data/skills.ts";

const BLOB_PATTERN = /^https:\/\/github\.com\/[^/]+\/[^/]+\/blob\//;

const offenders = ECOSYSTEM_CARDS.filter((c) => BLOB_PATTERN.test(c.copyValue));

if (offenders.length > 0) {
  console.error(
    `[check-ecosystem-links] ${offenders.length} ECOSYSTEM_CARDS entr${offenders.length === 1 ? "y uses" : "ies use"} a github.com/.../blob/... copyValue instead of raw.githubusercontent.com:`,
  );
  for (const c of offenders) {
    console.error(`  - "${c.title}": ${c.copyValue}`);
  }
  console.error(
    "\nRewrite as https://raw.githubusercontent.com/<owner>/<repo>/<branch>/<path>.",
  );
  process.exit(1);
}

console.log(
  `[check-ecosystem-links] ${ECOSYSTEM_CARDS.length} entries checked, no blob-URL copyValue found`,
);
