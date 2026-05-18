import type { MetadataRoute } from "next";

// Required by `output: 'export'` — declares the route as static so Next
// inlines the result into out/robots.txt at build time.
export const dynamic = "force-static";

const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";
const IS_PREVIEW = process.env.IS_PREVIEW === "true";

const join = (path: string) =>
  `${SITE_ORIGIN.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export default function robots(): MetadataRoute.Robots {
  // Preview deployments share a single robots.txt with production at the
  // gh-pages root. The host-level allow rule is correct for prod; preview
  // pages additionally carry meta-robots `noindex,nofollow` (see
  // layout.tsx) which is the actual deterrent crawlers honor for
  // subpath URLs like /pr/<N>/.
  if (IS_PREVIEW) {
    return {
      rules: { userAgent: "*", disallow: "/" },
    };
  }

  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: join("/sitemap.xml"),
  };
}
