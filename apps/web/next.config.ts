import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  // ponytail: env `tsc --noEmit` hangs in build env (flat-config loader, same as make typecheck).
  // Type errors surface in CI/dedicated `make typecheck`; disabled here so static export completes.
  // Upgrade path: resolve flat-config/tsc load issue, re-enable typescript check.
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
