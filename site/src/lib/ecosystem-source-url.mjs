const RAW_GITHUBUSERCONTENT_PATTERN =
  /^https:\/\/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)\/([^/]+)\/(.+)$/;

/**
 * An ECOSYSTEM_CARDS `copyValue` is the agent-fetchable raw markdown
 * (`raw.githubusercontent.com`, enforced by `check-ecosystem-links.mjs`),
 * not a page a human would want to click through to. This derives the
 * human-facing "View source" link, GitHub's own rendered blob page,
 * from the same URL rather than storing it as a second field that could
 * drift out of sync. Falls back to `copyValue` unchanged for a card not
 * hosted on GitHub at all (e.g. a project serving its own SKILL.md from
 * a custom domain), where there is no blob-page equivalent.
 */
export function ecosystemSourceUrl(copyValue) {
  const match = copyValue.match(RAW_GITHUBUSERCONTENT_PATTERN);
  if (!match) return copyValue;
  const [, owner, repo, ref, path] = match;
  return `https://github.com/${owner}/${repo}/blob/${ref}/${path}`;
}
