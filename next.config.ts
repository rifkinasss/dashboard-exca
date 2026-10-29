import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Keep production builds from replacing a running development server cache.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: process.cwd(),
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  webpack(config) {
    // Apply the same Tailwind loader when validating with the Webpack fallback.
    config.module.rules.push({
      oneOf: [
        { test: /\.css$/, enforce: "pre", use: ["@tailwindcss/turbopack"] },
      ],
    });
    return config;
  },
};

export default nextConfig;
