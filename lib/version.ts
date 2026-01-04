import { readFileSync, existsSync } from "fs";
import { join } from "path";

let cachedDockerVersion: string | null = null;
let cachedPackageVersion = "";

/**
 * Get version from Docker .version file
 */
function getDockerVersion(): string | null {
  if (cachedDockerVersion !== null) {
    return cachedDockerVersion;
  }

  try {
    const versionFilePath = join(process.cwd(), ".version");
    if (existsSync(versionFilePath)) {
      // Remove 'v' prefix for consistent version comparison
      cachedDockerVersion = readFileSync(versionFilePath, "utf-8")
        .trim()
        .replace(/^v/, "");
      return cachedDockerVersion;
    }
  } catch {
    // File doesn't exist or can't be read
  }

  cachedDockerVersion = null;
  return null;
}

/**
 * Get version from package.json
 */
function getPackageVersion(): string {
  if (cachedPackageVersion) {
    return cachedPackageVersion;
  }

  try {
    const packageJsonPath = join(process.cwd(), "package.json");
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
    cachedPackageVersion = packageJson.version || "unknown";
    return cachedPackageVersion;
  } catch (error) {
    console.error("Failed to read package.json version:", error);
    cachedPackageVersion = "unknown";
    return "unknown";
  }
}

/**
 * Get current application version
 * Tries Docker .version file first, then package.json
 */
export function getCurrentVersion(): string {
  const dockerVersion = getDockerVersion();
  return dockerVersion || getPackageVersion();
}

/**
 * Build GitHub URL for a version
 */
export function buildGitHubUrl(version: string): string {
  const repoOwner = process.env.GITHUB_REPO_OWNER || "panteLx";
  const repoName = process.env.GITHUB_REPO_NAME || "BetterShift";
  const baseUrl = `https://github.com/${repoOwner}/${repoName}`;

  // Check if version matches semver pattern (e.g., 1.1.1 or v1.1.1)
  const semverPattern = /^v?\d+\.\d+\.\d+$/;
  if (semverPattern.test(version)) {
    const tag = version.startsWith("v") ? version : `v${version}`;
    return `${baseUrl}/releases/tag/${tag}`;
  }

  // Otherwise link to main repo
  return baseUrl;
}

/**
 * Get version info for UI components (like AppFooter)
 */
export function getVersionInfo(): {
  version: string;
  githubUrl: string;
} {
  const version = getCurrentVersion();
  const githubUrl = buildGitHubUrl(version);

  return {
    version,
    githubUrl,
  };
}
