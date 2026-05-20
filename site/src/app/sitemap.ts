import type { MetadataRoute } from "next";

import { SKILL_CARD_SOURCES } from "@/data/skills";

// Required by `output: 'export'` — declares the route as static so Next
// inlines the result into out/sitemap.xml at build time.
export const dynamic = "force-static";

const SITE_ORIGIN = process.env.SITE_ORIGIN || "http://localhost:3000";
const IS_PREVIEW = process.env.IS_PREVIEW === "true";

// Production SITE_ORIGIN is a bare apex origin (skills.stellar.org).
// Joining with a leading slash gives the right absolute URL; we still
// strip/normalize separators so a fork override with a trailing slash
// or subpath doesn't produce double slashes.
const join = (path: string) =>
  `${SITE_ORIGIN.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

export default function sitemap(): MetadataRoute.Sitemap {
  // PR previews live at pr/<N>/ on gh-pages. Crawlers won't see a sitemap
  // at that subpath anyway, but emit an empty sitemap so a build leak
  // can't accidentally advertise preview URLs.
  if (IS_PREVIEW) return [];

  const now = new Date();
  return [
    {
      url: join("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...SKILL_CARD_SOURCES.map((s) => ({
      url: join(`/${s.source}`),
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
