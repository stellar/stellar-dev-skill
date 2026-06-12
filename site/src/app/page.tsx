import { Badge, Logo } from "@stellar/design-system";

import { INSTALLERS } from "@/data/installers.mjs";
import {
  ECOSYSTEM_CARDS,
  FILTERS,
  SKILL_CARD_SOURCES,
} from "@/data/skills";
import { readSkillMeta } from "@/lib/skill-meta.mjs";

import { CommunitySearch } from "./_components/CommunitySearch";
import { CopyButton } from "./_components/CopyButton";
import { GitHubIcon, LinkExternal01Icon } from "./_components/icons";
import { SkillCard } from "./_components/SkillCard";
import { SkillsFilter } from "./_components/SkillsFilter";
import { ThemeSwitchIsland } from "./_components/ThemeSwitchIsland";

import "./styles.scss";

const INSTALL_TABS = [
  "Use without installing",
  "Install Stellar Skills",
] as const;

/**
 * Build-time environment. All values have local-dev-safe defaults so
 * `pnpm dev` works without any env setup.
 *
 * - SITE_ORIGIN: canonical public origin used in displayed/copied URLs
 *   and llms.txt. CI pins it to production for BOTH main and PR
 *   previews — the displayed URLs are the product, and previews would
 *   hand out URLs that die on PR close. Mirrored in
 *   scripts/generate-llms-txt.mjs.
 * - IS_PREVIEW + GITHUB_PR_NUMBER: render the "PR preview" banner;
 *   only preview-pr.yml sets them.
 * - GITHUB_SOURCE_REF: git ref used in card "view source" links.
 *   Defaults to "main"; preview-pr.yml sets it to the PR head SHA so
 *   links resolve for files added by the PR.
 * - GITHUB_REPOSITORY: owner/repo for "view source" + banner links.
 *   Set by the Actions runner; defaults to the upstream repo locally.
 */
const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";
const IS_PREVIEW = process.env.IS_PREVIEW === "true";
const GITHUB_SOURCE_REF = process.env.GITHUB_SOURCE_REF || "main";
const GITHUB_PR_NUMBER = process.env.GITHUB_PR_NUMBER;
const GITHUB_REPOSITORY =
  process.env.GITHUB_REPOSITORY || "stellar/stellar-dev-skill";

const hostFromOrigin = (origin: string) => origin.replace(/^https?:\/\//, "");

const githubSourceUrl = (source: string) =>
  `https://github.com/${GITHUB_REPOSITORY}/blob/${GITHUB_SOURCE_REF}/${source}`;

// Example ECOSYSTEM_CARDS entry shown in the "Add your skill" block.
// Mirrors the format documented in site/CLAUDE.md.
const ADD_SKILL_SNIPPET = `{
  title: "Project Name",
  description: "Verb-led summary of what the skill does.",
  pathLabel: "owner/repo",
  copyValue: "https://github.com/owner/repo/blob/main/path/to/SKILL.md",
}`;

export default function LandingPage() {
  const host = hostFromOrigin(SITE_ORIGIN);
  const heroValue = `Read ${host} before you start building on Stellar.`;

  const skillCards = SKILL_CARD_SOURCES.map((s) => {
    const meta = readSkillMeta(s.source);
    const sitePath = `/${s.source}`;
    return {
      title: s.title ?? meta.title ?? s.source,
      description: s.description ?? meta.description ?? "",
      category: s.category,
      pathLabel: `${host}${sitePath}`,
      copyValue: `${SITE_ORIGIN}${sitePath}`,
      sourceUrl: githubSourceUrl(s.source),
    };
  });

  return (
    <div className="SkillsLanding">
      {IS_PREVIEW && (
        <div className="SkillsLanding__previewBanner" role="status">
          Preview of{" "}
          {GITHUB_PR_NUMBER ? (
            <a
              href={`https://github.com/${GITHUB_REPOSITORY}/pull/${GITHUB_PR_NUMBER}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              PR #{GITHUB_PR_NUMBER}
            </a>
          ) : (
            "a PR"
          )}
          . Copy-pastable URLs point to post-merge production.
        </div>
      )}

      <header className="SkillsLanding__header">
        <div className="SkillsLanding__logo">
          <Logo.Stellar />
          <Badge variant="secondary" size="md">
            Skills
          </Badge>
        </div>

        <div className="SkillsLanding__headerActions">
          <ThemeSwitchIsland />

          <a
            href="https://developers.stellar.org/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="SkillsLanding__headerLink"
          >
            Developer docs
            <LinkExternal01Icon />
          </a>
        </div>
      </header>

      <main className="SkillsLanding__main">
        <section className="SkillsLanding__hero">
          <h1 className="SkillsLanding__title">
            Give your AI the right Stellar context before it writes code. Works
            with any AI agent.
          </h1>
        </section>

        <section className="SkillsLanding__installing" aria-label="Installing">
          <SkillsFilter
            filters={INSTALL_TABS}
            defaultFilter="Use without installing"
            panelClassName="SkillsLanding__installerPanel"
            ariaLabel="Installation method"
          >
            <div
              className="SkillsLanding__filterItem"
              data-category="Use without installing"
            >
              <div className="SkillsLanding__installOneTime">
                <span className="SkillsLanding__installLabel">
                  Tell your agent:
                </span>
                <CopyButton variant="path" value={heroValue} />
              </div>
            </div>

            <div
              className="SkillsLanding__filterItem"
              data-category="Install Stellar Skills"
            >
              <div className="SkillsLanding__installRows">
                {INSTALLERS.map((installer, index) => (
                  <div
                    key={installer.name}
                    className="SkillsLanding__installRow"
                    data-first={index === 0}
                  >
                    <span className="SkillsLanding__installToolName">
                      {installer.name}
                    </span>
                    <div className="SkillsLanding__installCommands">
                      {installer.commands.map((cmd) => (
                        <CopyButton key={cmd} variant="path" value={cmd} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SkillsFilter>
        </section>

        <section className="SkillsLanding__cards" aria-label="Skills list">
          <SkillsFilter filters={FILTERS}>
            {skillCards.map((c) => (
              <div
                key={c.copyValue}
                data-category={c.category}
                className="SkillsLanding__filterItem"
              >
                <SkillCard {...c} />
              </div>
            ))}
          </SkillsFilter>
        </section>

        <section className="SkillsLanding__ecosystem" aria-label="Community">
          <h2 className="SkillsLanding__sectionTitle">Community skills</h2>
          <p className="SkillsLanding__sectionDescription">
            Skills built and maintained by the Stellar community. Each project
            has its own install instructions, so follow the link on a card to
            set it up with your agent. The resources listed here are
            community-contributed and are not endorsed by the Stellar
            Foundation. Always do your own research (DYOR) before using any
            tool or resource. Inclusion in this list does not imply any
            warranty, security audit, or official recommendation.
          </p>
          <CommunitySearch
            searchTexts={ECOSYSTEM_CARDS.map((c) =>
              `${c.title} ${c.description}`.toLowerCase(),
            )}
          >
            {ECOSYSTEM_CARDS.map((c) => (
              <SkillCard
                key={c.copyValue}
                title={c.title}
                description={c.description}
                pathLabel={c.pathLabel}
                copyValue={c.copyValue}
                sourceUrl={c.copyValue}
                headingLevel={3}
              />
            ))}
          </CommunitySearch>

          <div className="SkillsLanding__addSkill">
            <h3 className="SkillsLanding__addSkillTitle">Add your skill</h3>
            <p className="SkillsLanding__addSkillText">
              Built a skill that helps people develop on Stellar?{" "}
              <a
                href={`https://github.com/${GITHUB_REPOSITORY}/edit/main/site/src/data/skills.ts`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open a pull request
              </a>{" "}
              that adds an entry to <code>ECOSYSTEM_CARDS</code> in{" "}
              <a
                href={`https://github.com/${GITHUB_REPOSITORY}/blob/main/site/src/data/skills.ts`}
                target="_blank"
                rel="noopener noreferrer"
              >
                site/src/data/skills.ts
              </a>
              . Once merged, your skill shows up here and in{" "}
              <a href={`${SITE_ORIGIN}/llms.txt`}>llms.txt</a>.
            </p>
            <pre className="SkillsLanding__addSkillSnippet">
              <code>{ADD_SKILL_SNIPPET}</code>
            </pre>
          </div>
        </section>
      </main>

      <footer className="SkillsLanding__footer">
        <span className="SkillsLanding__footerText">
          Powered by{" "}
          <a
            href="https://stellar.org"
            target="_blank"
            rel="noopener noreferrer"
            className="SkillsLanding__footerLink"
          >
            Stellar
          </a>
        </span>
        <a
          href="https://github.com/stellar/stellar-dev-skill"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View source on GitHub"
          className="SkillsLanding__footerGithub"
        >
          <GitHubIcon />
        </a>
      </footer>
    </div>
  );
}
