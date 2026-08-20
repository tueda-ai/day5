import type { NextConfig } from "next";

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";
const [repositoryOwner = "", repositoryName = ""] =
  process.env.GITHUB_REPOSITORY?.split("/") ?? [];
const pagesUrl = isGitHubActions
  ? repositoryName.endsWith(".github.io")
    ? `https://${repositoryOwner}.github.io`
    : `https://${repositoryOwner}.github.io/${repositoryName}`
  : "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  assetPrefix: pagesUrl,
};

export default nextConfig;
