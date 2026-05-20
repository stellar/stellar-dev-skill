/** @type {import('next').NextConfig} */

// Production serves from skills.stellar.org at the apex, so main builds
// run with NEXT_BASE_PATH unset and no basePath is applied. PR previews
// live at skills.stellar.org/pr/<N>/, so preview-pr.yml sets
// NEXT_BASE_PATH=/pr/<N> to prefix every asset and route accordingly.
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
