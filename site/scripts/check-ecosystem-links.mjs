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
 *
 * Parses with `URL` and compares `hostname`/`pathname` rather than
 * matching a fixed-scheme regex, so `http://github.com/...` and
 * `www.github.com/...` are caught too, not just the canonical
 * `https://github.com/...` form.
 */
import { ECOSYSTEM_CARDS } from "../src/data/skills.ts";

export function isGithubBlobUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return host === "github.com" && /^\/[^/]+\/[^/]+\/blob\//.test(url.pathname);
}

function main() {
  const offenders = ECOSYSTEM_CARDS.filter((c) => isGithubBlobUrl(c.copyValue));

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
}

// `import.meta.filename` (raw filesystem path) compared directly against
// `process.argv[1]`, not `import.meta.url` against a hand-built `file://`
// string: a checkout path needing URL-encoding (spaces, non-ASCII) would
// make `import.meta.url` percent-encode while `process.argv[1]` stays
// literal, so the comparison would silently never match, main() would
// never run, and the script would exit 0 having checked nothing.
if (import.meta.filename === process.argv[1]) {
  main();
}
