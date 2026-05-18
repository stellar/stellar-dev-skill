/** @type {import('next').NextConfig} */

// When deploying to a project-level GitHub Pages URL
// (https://<org>.github.io/<repo>/), every asset and route has to be
// prefixed with `/<repo>`. The deploy workflow sets NEXT_BASE_PATH for
// that case. Once a custom domain is in place (CNAME serves the site
// at the apex), drop the env var and the basePath block goes with it.
const basePath = process.env.NEXT_BASE_PATH;

const nextConfig = {
  // Emit a static export to `out/` for GitHub Pages. The site has no API
  // routes, no middleware, no ISR, and no runtime image optimization, so
  // there's nothing the static export can't handle.
  output: "export",
  // Tree-shake `@stellar/design-system` — without this, the barrel ships
  // every component (Modal, Tooltip, the full icon set, etc.) even though
  // we only render Card, Badge, Logo, ThemeSwitch, and a few icons.
  experimental: {
    optimizePackageImports: ["@stellar/design-system"],
  },
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

module.exports = nextConfig;
