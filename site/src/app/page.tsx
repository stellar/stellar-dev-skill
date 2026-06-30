import { INSTALLERS } from "@/data/installers.mjs";
import {
  ECOSYSTEM_CARDS,
  FILTERS,
  SKILL_CARD_SOURCES,
} from "@/data/skills";
import { readSkillMeta } from "@/lib/skill-meta.mjs";

import { CopyButton } from "./_components/CopyButton";
import { SkillCard } from "./_components/SkillCard";
import { SkillsFilter } from "./_components/SkillsFilter";
import { SiteFooter } from "./_components/SiteFooter";
import { SiteHeader } from "./_components/SiteHeader";

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

      <SiteHeader />

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
            Skills built and maintained by members of the Stellar community.
            Each project has its own install instructions; follow the link on a
            card to set it up with your agent.
          </p>
          <p className="SkillsLanding__sectionDescription">
            Community skills are independently developed and are not reviewed,
            endorsed, or maintained by the Stellar Development Foundation.
            Inclusion in this directory does not imply any warranty, security
            audit, or recommendation by SDF. You are solely responsible for
            evaluating any community skill before use, including reviewing its
            code, license, and security practices.
          </p>
          <div className="SkillsLanding__ecosystemGrid">
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
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
