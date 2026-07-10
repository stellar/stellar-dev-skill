import type { Metadata } from "next";

import { SiteFooter } from "../_components/SiteFooter";
import { SiteHeader } from "../_components/SiteHeader";
import "../styles.scss";
import "./styles.scss";

export const metadata: Metadata = {
  title: "Terms of Service | Stellar Skills",
  description: "Stellar Skills Terms of Service — skills.stellar.org",
};

export default function TermsPage() {
  return (
    <div className="TermsPage">
      <SiteHeader />

      <main className="TermsPage__main">
        <h1>Stellar Skills Terms of Service</h1>
        <p className="TermsPage__meta">Effective Date: June 30, 2026</p>

        <p>
          These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and
          use of skills.stellar.org (the &ldquo;Site&rdquo;), operated by the
          Stellar Development Foundation (&ldquo;SDF,&rdquo; &ldquo;we,&rdquo;
          or &ldquo;us&rdquo;).
        </p>

        <p>
          By accessing or using the Site, you agree to be bound by the{" "}
          <a
            href="https://stellar.org/terms-of-service"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stellar.org Terms of Service
          </a>{" "}
          (the &ldquo;Stellar ToS&rdquo;) and the{" "}
          <a
            href="https://stellar.org/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stellar.org Privacy Policy
          </a>
          , each of which is incorporated herein by reference.
        </p>

        <p>
          To the extent these Terms address a topic not covered by the Stellar
          ToS, these Terms apply. To the extent of any direct conflict between
          these Terms and the Stellar ToS, these Terms control with respect to
          your use of this Site.
        </p>

        <h2>1. About Stellar Skills</h2>
        <p>
          The Site provides technical documentation (&ldquo;Skills&rdquo;)
          designed to help AI coding assistants and developers produce more
          accurate code when building on Stellar. Skills are served as
          plain-text markdown files at predictable URLs. The Site does not
          require authentication, does not create user accounts, and does not
          process any financial transactions.
        </p>

        <h2>2. Content Licensing</h2>
        <p>
          Skill content hosted on this Site is made available under the{" "}
          <a
            href="https://www.apache.org/licenses/LICENSE-2.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            Apache License 2.0
          </a>
          , or such other open-source license as may be indicated in the
          applicable source repository. You may use, copy, modify, and
          distribute that content in accordance with the applicable license
          terms. For clarity, the intellectual property restrictions in the
          &ldquo;Intellectual property rights&rdquo; section of the Stellar ToS
          do not limit rights expressly granted to you by an applicable
          open-source license for the underlying Skill content.
        </p>

        <h2>3. No Warranty; Use at Your Own Risk</h2>
        <p>
          ALL SKILLS AND OTHER CONTENT ON THIS SITE ARE PROVIDED &ldquo;AS
          IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; WITHOUT ANY WARRANTY OF ANY
          KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY, INCLUDING WARRANTIES OF
          ACCURACY, COMPLETENESS, MERCHANTABILITY, FITNESS FOR A PARTICULAR
          PURPOSE, OR NON-INFRINGEMENT.
        </p>
        <p>
          Skill content may be incomplete, outdated, or incorrect. You are
          solely responsible for evaluating, testing, and independently
          verifying any content obtained from this Site before relying on it,
          including any code derived from or informed by Skill content. SDF is
          not responsible for any harm, loss, or damage resulting from your
          reliance on content provided through this Site.
        </p>

        <h2>4. AI-Generated Output</h2>
        <p>
          Skills are designed to be consumed by AI coding assistants. Any code
          or other output produced by an AI assistant after loading Skill
          content is AI-generated output, not SDF output. You are solely
          responsible for reviewing, testing, and securing any such output
          before use or deployment. The AI Tools provisions of the Stellar ToS
          apply to your use of AI-generated output informed by Skill content.
        </p>

        <h2>5. Third-Party Ecosystem Content</h2>
        <p>
          The Site may link to skill files maintained by third-party projects in
          the Stellar ecosystem. SDF does not host, control, or endorse
          third-party content. Third-party skill files are subject to their own
          licenses and terms. SDF makes no representation or warranty regarding
          the accuracy, completeness, security, or legality of any third-party
          content. Your use of third-party content is at your own risk.
        </p>

        <h2>6. Analytics; Privacy</h2>
        <p>
          We collect limited server-side analytics data when you or an AI agent
          fetches content from this Site, including the skill requested, user
          agent, referrer, and timestamp. This data is processed in accordance
          with the{" "}
          <a
            href="https://stellar.org/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Stellar.org Privacy Policy
          </a>
          . We do not use cookies or client-side tracking on this Site.
        </p>

        <h2>7. Changes; Contact</h2>
        <p>
          We may modify these Terms or the Site at any time without prior
          notice. Your continued use of the Site after any modification
          constitutes acceptance of the revised Terms.
        </p>
        <p>
          Questions about these Terms may be directed to{" "}
          <a href="mailto:legal@stellar.org">legal@stellar.org</a>.
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
