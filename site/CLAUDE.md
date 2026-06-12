# Claude Code Instructions for `site/`

The landing page that ships with this repo, served at
[skills.stellar.org](https://skills.stellar.org). See
[README.md](README.md) for the public-facing overview.

The skill markdown lives at `../skills/` (the repo root). This site
mirrors those files into `public/skills/` at build time and exposes
them as copy-pastable URLs plus an `/llms.txt` index.

## SSR is the point

The page is a server component, statically generated at build time and
exported (`next build` with `output: 'export'` produces `out/`). The
full HTML returned by `GET /` already contains every card's title,
description, URL, and `data-category`. AI agents and crawlers do not
need to run JavaScript. The same data builds `public/llms.txt`. Both
the UI and llms.txt read from `src/data/skills.ts`.

When making changes: anything that should be visible to agents must
render on the server in `src/app/page.tsx` or
`src/app/_components/SkillCard.tsx`. Don't move card data into a
client component.

## Where things live

- `src/data/skills.ts`: single source of truth.
  `SKILL_CARD_SOURCES` (main list), `ECOSYSTEM_CARDS` (community
  section), `FilterType` / `FILTERS` (category tabs).
- `src/lib/skill-meta.mjs`: parses each upstream SKILL.md's
  frontmatter `description` and first `# heading` so cards default to
  upstream metadata when `title` / `description` aren't overridden in
  skills.ts. Shared by `src/app/page.tsx` and
  `scripts/generate-llms-txt.mjs`.
- `src/app/page.tsx`: server-rendered landing page.
- `src/app/_components/`: `SkillCard` (server), `icons` (server, inline
  SVGs), `CopyButton` / `SkillsFilter` / `CommunitySearch` /
  `ThemeSwitchIsland` (client islands). `SkillsFilter` is used twice — once
  for the skills grid (`All` + categories) and once for the Installing
  section's tabs (Claude Code / Cursor / npx skills / Clone repo).
  `CommunitySearch` adds search + pagination to the community grid; the
  cards render server-side and are passed in as children, so every entry
  stays in the static HTML.
- `scripts/copy-skills.mjs`: mirrors `../skills/<source>` into
  `public/<source>` on `predev` / `prebuild`. No network; just `cp`.
- `scripts/generate-llms-txt.mjs`: writes `public/llms.txt` from
  `src/data/skills.ts`. Imports the frontmatter parser from
  `src/lib/skill-meta.mjs` so the index and the page agree.
- `next.config.js`: `output: 'export'` and a tree-shake hint for
  `@stellar/design-system`. No headers function (GitHub Pages doesn't
  set response headers), no middleware.

There is no routing beyond `/`, no API routes, no backend, no test
runner.

## Quick reference

```bash
pnpm dev                # predev: cached copy + regen llms.txt
pnpm build              # prebuild: strict copy + regen llms.txt; static export
pnpm lint               # eslint
pnpm lint:ts            # tsc --noEmit
pnpm sync:skills        # refresh public/skills/ from ../skills/
pnpm generate:llms-txt  # regenerate public/llms.txt
```

## Adding a skill

**Main list:** add `skills/<your-skill>/SKILL.md` at the repo root,
then append to `SKILL_CARD_SOURCES`:

```ts
{
  source: "skills/<your-skill>/SKILL.md",
  category: "Soroban", // any FilterType value
  // Optional overrides — both default to the upstream SKILL.md's
  // first H1 (title) and frontmatter `description`.
  title: "Your Skill Title",
  description: "Verb-led summary of what this skill teaches.",
}
```

`pnpm sync:skills && pnpm dev` to verify. New category? Add it to the
`FilterType` union and the `FILTERS` array.

**Ecosystem:** external link, no upstream copy. New entries are picked
up automatically by the community search, pagination, and llms.txt; no
other wiring needed.

```ts
{
  title: "Project Name",
  description: "Verb-led summary of what the skill does.",
  pathLabel: "owner/repo",
  copyValue: "https://github.com/owner/repo/blob/main/path/to/SKILL.md",
}
```

## Conventions

- Use `@stellar/design-system` components; don't hand-roll UI primitives.
- SCSS files only; no inline `style={}`.
- `@/` path alias for imports from `src/`.
- `"use client"` only for components using hooks, `window`, or
  `useSearchParams`.
- PascalCase components, camelCase helpers, `use` prefix for hooks.
- Skill descriptions: lead with a verb, list concrete topics, no em-dashes.

## Don't add

- No state libraries (Zustand, React Query). Plain `useState` is enough.
- No `@stellar/stellar-sdk`, no XDR, no transaction logic. The app
  makes no network requests at runtime.
- No Jest, Playwright, Sentry, or pre-commit hooks unless asked.
- No middleware. (Static export wouldn't run it anyway.)

## Before merging

- `pnpm lint:ts` passes
- `pnpm lint` passes
- `pnpm build` succeeds (produces `out/`)
- Card data still rendered server-side (visible in
  `curl out/index.html`)
- No em-dashes in descriptions or docs

## Deploy

`.github/workflows/deploy-pages.yml` at the repo root. Triggered on
push to `main` when `skills/**` or `site/**` changes. Builds the
static export and publishes to the `gh-pages` branch root, served at
`https://skills.stellar.org` via a custom domain. `site/public/CNAME`
ships the domain so every build republishes it.

PR previews live at `https://skills.stellar.org/pr/<N>/`. Only
`NEXT_BASE_PATH` differs between main and previews — `SITE_ORIGIN` is
the same so reviewers see canonical URLs in the hero pill and copy
buttons. See `README.md` → Deploying for the full setup.
