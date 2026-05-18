import type { Metadata, Viewport } from "next";
import { GoogleTagManager } from "@next/third-parties/google";

import "@stellar/design-system/build/styles.min.css";
import "@/styles/globals.scss";

const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";
const IS_PREVIEW = process.env.IS_PREVIEW === "true";

const GA_TRACKING_ENABLED =
  process.env.NEXT_PUBLIC_DISABLE_GOOGLE_ANALYTICS !== "true" &&
  process.env.NODE_ENV === "production" &&
  !IS_PREVIEW;

// SITE_ORIGIN can carry a project-Pages path prefix (e.g.
// `https://owner.github.io/repo`). For metadataBase we need a pure
// origin; the canonical path picks up whatever prefix was in SITE_ORIGIN
// (with a trailing slash so URL resolution stays deterministic).
const siteOriginUrl = new URL(SITE_ORIGIN);
const canonicalPath = siteOriginUrl.pathname.endsWith("/")
  ? siteOriginUrl.pathname
  : `${siteOriginUrl.pathname}/`;

const TITLE = "Stellar Skills";
const DESCRIPTION =
  "Agent-readable documentation for building on the Stellar network.";

export const metadata: Metadata = {
  metadataBase: new URL(siteOriginUrl.origin),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: TITLE,
  alternates: {
    canonical: canonicalPath,
  },
  // PR previews are deployed to pr/<N>/ on gh-pages. The host-level
  // robots.txt covers the root only, so meta-robots is the actual lever
  // that keeps preview URLs out of search indexes.
  robots: IS_PREVIEW
    ? { index: false, follow: false, googleBot: { index: false, follow: false } }
    : { index: true, follow: true },
  openGraph: {
    type: "website",
    siteName: TITLE,
    title: TITLE,
    description: DESCRIPTION,
    url: canonicalPath,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="sds-theme-light" data-sds-theme="sds-theme-light">
        <div id="root">{children}</div>
        {GA_TRACKING_ENABLED && <GoogleTagManager gtmId="GTM-KCNDDL3" />}
      </body>
    </html>
  );
}
