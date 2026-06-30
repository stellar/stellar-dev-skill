import { GitHubIcon } from "./icons";

export function SiteFooter() {
  return (
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
      <span className="SkillsLanding__footerSep" aria-hidden="true">
        ·
      </span>
      <a href="/terms" className="SkillsLanding__footerLink">
        Terms of Service
      </a>
      <span className="SkillsLanding__footerSep" aria-hidden="true">
        ·
      </span>
      <a
        href="https://stellar.org/privacy-policy"
        target="_blank"
        rel="noopener noreferrer"
        className="SkillsLanding__footerLink"
      >
        Privacy Policy
      </a>
    </footer>
  );
}
