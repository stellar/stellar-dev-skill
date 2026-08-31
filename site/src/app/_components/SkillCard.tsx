import { Card } from "@stellar/design-system";

import { CopyButton } from "./CopyButton";
import { LinkExternal01Icon } from "./icons";

export type SkillCardProps = {
  title: string;
  description: string;
  pathLabel: string;
  copyValue: string;
  /** External link rendered as a real anchor so crawlers see the URL. */
  sourceUrl: string;
  /** h2 in the main grid, h3 in the ecosystem section. */
  headingLevel?: 2 | 3;
};

/**
 * Server component. Emits the full card markup as static HTML. The only
 * client-side bit is `<CopyButton>`, which hydrates over the rendered
 * button.
 */
export const SkillCard = ({
  title,
  description,
  pathLabel,
  copyValue,
  sourceUrl,
  headingLevel = 2,
}: SkillCardProps) => {
  const Heading = headingLevel === 3 ? "h3" : "h2";
  // Skill cards copy the mirrored markdown URL, which nothing else links
  // to, so the chip always shows. Ecosystem cards used to copy the same
  // URL the header already linked to (copyValue === sourceUrl), so the
  // chip never rendered there; now that ecosystem copyValue is raw
  // markdown and sourceUrl is GitHub's rendered blob page (see
  // ecosystemSourceUrl in page.tsx), the two differ for every
  // GitHub-hosted card, so the chip renders there too, a second, direct
  // link to the raw file alongside the header's link to the rendered
  // page. A card not hosted on GitHub at all keeps copyValue and
  // sourceUrl equal, so it still shows none.
  const showOpenLink = copyValue !== sourceUrl;
  return (
    <Card>
      <div className="SkillsCard">
        <div className="SkillsCard__header">
          <Heading className="SkillsCard__title">{title}</Heading>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${title} source`}
            className="SkillsCard__sourceLink"
          >
            <LinkExternal01Icon />
          </a>
        </div>

        <p className="SkillsCard__description">{description}</p>

        <div className="SkillsCard__pathRow">
          <CopyButton
            variant="path"
            value={copyValue}
            displayValue={pathLabel}
          />
          {showOpenLink && (
            <a
              href={copyValue}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${pathLabel} in a new tab`}
              className="SkillsCard__pathButton SkillsCard__openLink"
            >
              <LinkExternal01Icon />
            </a>
          )}
        </div>
      </div>
    </Card>
  );
};
