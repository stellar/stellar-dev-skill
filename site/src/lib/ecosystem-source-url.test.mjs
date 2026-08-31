import { test } from "node:test";
import assert from "node:assert/strict";
import { ecosystemSourceUrl } from "./ecosystem-source-url.mjs";

test("derives the GitHub blob page from a raw.githubusercontent.com URL", () => {
  assert.equal(
    ecosystemSourceUrl("https://raw.githubusercontent.com/drQedwards/pmll/main/SKILL.md"),
    "https://github.com/drQedwards/pmll/blob/main/SKILL.md",
  );
});

test("preserves a nested path", () => {
  assert.equal(
    ecosystemSourceUrl(
      "https://raw.githubusercontent.com/Eras256/Contextio/main/packages/sdk/SKILL.md",
    ),
    "https://github.com/Eras256/Contextio/blob/main/packages/sdk/SKILL.md",
  );
});

test("preserves a non-main branch", () => {
  assert.equal(
    ecosystemSourceUrl("https://raw.githubusercontent.com/owner/repo/master/SKILL.md"),
    "https://github.com/owner/repo/blob/master/SKILL.md",
  );
});

test("falls back to the original value for a non-GitHub URL", () => {
  assert.equal(
    ecosystemSourceUrl("https://stellarlight.xyz/skills/stellar-scout.md"),
    "https://stellarlight.xyz/skills/stellar-scout.md",
  );
});

test("falls back to the original value for a github.com URL that isn't raw content", () => {
  // Defensive: copyValue should never actually be this shape (the
  // check-ecosystem-links gate rejects it), but the derivation itself
  // must not produce a broken URL if one ever slips through.
  assert.equal(
    ecosystemSourceUrl("https://github.com/owner/repo/blob/main/SKILL.md"),
    "https://github.com/owner/repo/blob/main/SKILL.md",
  );
});
