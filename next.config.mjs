/** @type {import('next').NextConfig} */
const distDir = process.env.NEXT_DIST_DIR || ".next";

const nextConfig = {
  output: "standalone",
  distDir,
  experimental: {
    serverComponentsExternalPackages: ["@openai/agents", "@openai/agents-core", "@openai/agents-openai", "sharp"],
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
