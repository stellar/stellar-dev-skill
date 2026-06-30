import Link from "next/link";

import { Badge, Logo } from "@stellar/design-system";

import { LinkExternal01Icon } from "./icons";
import { ThemeSwitchIsland } from "./ThemeSwitchIsland";

export function SiteHeader() {
  return (
    <header className="SkillsLanding__header">
      <Link href="/" className="SkillsLanding__logo">
        <Logo.Stellar />
        <Badge variant="secondary" size="md">
          Skills
        </Badge>
      </Link>

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
  );
}
