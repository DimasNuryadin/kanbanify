/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  agentRules: false,
  turbopack: {
    resolveAlias: {
      "@kinetix/contracts": "./src/lib/contracts.ts",
    },
  },
};

export default nextConfig;
