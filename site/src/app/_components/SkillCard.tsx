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

        <CopyButton
          variant="path"
          value={copyValue}
          displayValue={pathLabel}
        />
      </div>
    </Card>
  );
};
