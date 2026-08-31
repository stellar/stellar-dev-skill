import { test } from "node:test";
import assert from "node:assert/strict";
import { isGithubBlobUrl } from "./check-ecosystem-links.mjs";

test("catches the canonical https://github.com/.../blob/... form", () => {
  assert.equal(isGithubBlobUrl("https://github.com/owner/repo/blob/main/SKILL.md"), true);
});

test("catches http:// (not just https://)", () => {
  assert.equal(isGithubBlobUrl("http://github.com/owner/repo/blob/main/SKILL.md"), true);
});

test("catches www.github.com", () => {
  assert.equal(isGithubBlobUrl("https://www.github.com/owner/repo/blob/main/SKILL.md"), true);
});

test("catches a mixed-case host", () => {
  assert.equal(isGithubBlobUrl("https://GitHub.com/owner/repo/blob/main/SKILL.md"), true);
});

test("allows a raw.githubusercontent.com URL", () => {
  assert.equal(
    isGithubBlobUrl("https://raw.githubusercontent.com/owner/repo/main/SKILL.md"),
    false,
  );
});

test("allows a github.com URL that isn't a blob path", () => {
  assert.equal(isGithubBlobUrl("https://github.com/owner/repo"), false);
});

test("does not throw on a malformed value", () => {
  assert.equal(isGithubBlobUrl("not a url"), false);
});
