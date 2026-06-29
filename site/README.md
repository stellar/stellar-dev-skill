# skills.stellar.org

The landing page that ships with [stellar/stellar-dev-skill](../README.md). A
static Next.js site that mirrors every `SKILL.md` under `../skills/` and
exposes them as a copy-pastable directory at
[skills.stellar.org](https://skills.stellar.org), plus an `/llms.txt`
index for AI agents.

The same data drives both surfaces, so `curl /` returns the full
catalog inline.

## Local development

Prerequisites: Node.js >= 22.22.0, pnpm >= 10.15.1.

```sh
pnpm install
pnpm dev
```

Scripts:

```sh
pnpm dev                # next dev (cached sibling-skill copy)
pnpm build              # static export to out/ (fresh copy + llms.txt)
pnpm lint               # eslint
pnpm lint:ts            # tsc --noEmit
pnpm sync:skills        # refresh public/skills/ from ../skills/
pnpm generate:llms-txt  # regenerate public/llms.txt
```

## How content stays in sync

The site lives in `site/` alongside `skills/` at the repo root. Each
entry in `src/data/skills.ts` has a `source` field pointing at an
upstream path (e.g. `skills/smart-contracts/SKILL.md`).
`scripts/copy-skills.mjs` mirrors that path verbatim into `public/`
on `predev` / `prebuild`. There's no network fetch and no upstream ref
to pin: the site always reflects whatever's on disk in `../skills/`,
so a PR touching a skill and the site stays internally consistent.

Both `public/skills/` and `public/llms.txt` are generated and
gitignored.

Card titles and descriptions default to the upstream SKILL.md's first
H1 and frontmatter `description`. Override them per card in
`src/data/skills.ts` when you want a shorter title or a different
summary for the landing card. (llms.txt always prefers the upstream
frontmatter so AI agents still see the longer, agent-tuned summary.)

## Deploying

GitHub Pages, branch-based, via two workflows at the repo root:

- `.github/workflows/deploy-pages.yml` — runs on push to `main` when
  `skills/**` or `site/**` changes. Publishes `site/out/` to the root
  of the `gh-pages` branch with `keep_files: true` so it doesn't
  trample PR preview subdirectories.
- `.github/workflows/preview-pr.yml` — runs on every internal-branch
  PR targeting `main`. Publishes to `gh-pages:/pr/<N>/` and comments
  the preview URL on the PR. Cleans up the subdirectory when the PR
  closes. PRs from forks are skipped (no write token).

PR authors and branch creators do nothing: open a PR, wait ~1–2
minutes, click the bot comment.

**Why `SITE_ORIGIN` is pinned to production in both workflows.** The
hero pill, copy-pastable card URLs, and `llms.txt` are the *product* —
reviewers must see the URLs the merged build will publish, not
ephemeral preview URLs that 404 on PR close. Previews vary only
`NEXT_BASE_PATH` so Next.js routes assets to the preview subpath; a
small banner identifies preview builds.

URLs:

- Main: `https://skills.stellar.org/`
- PR-N: `https://skills.stellar.org/pr/<N>/`

### One-time repo setup

Already configured on `stellar/stellar-dev-skill`. For reference, or
when bootstrapping a fork:

1. **Settings → Pages → Build and deployment → Source:** choose
   **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`. The
   `gh-pages` branch is created automatically the first time
   `deploy-pages.yml` runs.
2. **Settings → Actions → General → Workflow permissions:** confirm
   **Read and write permissions** (the workflows also declare
   `contents: write` per-job, so this is belt-and-braces).
3. **Custom domain:** `site/public/CNAME` ships
   `skills.stellar.org`, so every build republishes it to the
   `gh-pages` root. Set the same domain under **Settings → Pages →
   Custom domain** and point DNS at GitHub Pages (`A` records for the
   apex or a `CNAME` for a subdomain).

To redeploy a fork at a different origin, set the repo variable
`SITE_ORIGIN` under **Settings → Secrets and variables → Actions →
Variables** (apex URL, no trailing slash). The override is read by
both workflows, so main and previews stay in lockstep.

### Build-time env vars

All have local-dev-safe defaults — `pnpm dev` needs no env setup.

| Env var | Set by | Purpose |
|---|---|---|
| `SITE_ORIGIN` | both workflows | Canonical public origin in displayed/copied URLs and `llms.txt`. Default: `http://localhost:3000` locally; `https://skills.stellar.org` in CI |
| `NEXT_BASE_PATH` | preview-pr.yml only | Next.js asset path prefix for PR previews (`/pr/<N>`). Unset for main builds |
| `IS_PREVIEW` | preview-pr.yml | Renders the preview banner when `"true"` |
| `GITHUB_SOURCE_REF` | preview-pr.yml | Git ref for card "view source" links. Default: `main` |
| `GITHUB_PR_NUMBER` | preview-pr.yml | PR number for the banner link |
| `GITHUB_REPOSITORY` | runner default | `owner/repo` for "view source" links. Default: `stellar/stellar-dev-skill` |

## Adding a skill

### Main list (`SKILL_CARD_SOURCES`)

For skills hosted in this repo. Add `skills/<your-skill>/SKILL.md` at
the repo root, then append to `SKILL_CARD_SOURCES` in
`src/data/skills.ts`:

```ts
{
  source: "skills/<your-skill>/SKILL.md",
  category: "Soroban", // any FilterType value
  // Optional overrides — default to the upstream SKILL.md's first H1
  // (title) and frontmatter `description`.
  title: "Your Skill Title",
  description: "What this skill teaches.",
}
```

Run `pnpm sync:skills && pnpm dev` to verify. `pnpm build` fails if
the upstream file is missing. New category? Add it to the `FilterType`
union and the `FILTERS` array.

### Community section (`ECOSYSTEM_CARDS`)

For skills hosted elsewhere (typically a third-party GitHub repo).
These render in the "Community skills" section at the bottom of the
page. There's no upstream copy — the card just links out to the
external SKILL.md, and the user copies that URL to install it with
their agent.

Append to `ECOSYSTEM_CARDS` in `src/data/skills.ts`:

```ts
{
  title: "Project Name",
  description: "Verb-led summary of what the skill does.",
  pathLabel: "owner/repo",
  copyValue: "https://github.com/owner/repo/blob/main/path/to/SKILL.md",
}
```

- `pathLabel` is the short label shown on the card (typically
  `owner/repo`).
- `copyValue` is the full URL written to the clipboard when the user
  clicks the pill — point it directly at the raw SKILL.md so an agent
  can fetch it.

Run `pnpm dev` to verify the card renders. No `sync:skills` step
needed since ecosystem entries aren't mirrored locally.

## Tech stack

Next.js 15 (App Router) with static export, React 19, TypeScript 5,
Stellar Design System, Sass. See `package.json` for exact versions.

## License

Apache 2.0. See [`LICENSE`](../LICENSE).
