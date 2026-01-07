import { readFile } from "fs/promises";
import { join } from "path";

export interface BuildInfo {
  version: string;
  buildDate: string;
  commitSha: string;
  commitRef: string;
}

let cachedBuildInfo: BuildInfo | null = null;
let buildInfoLoadPromise: Promise<BuildInfo> | null = null;

/**
 * Get build info from Docker .build-info.json file
 */
async function getDockerBuildInfo(): Promise<BuildInfo | null> {
  try {
    const buildInfoPath = join(process.cwd(), ".build-info.json");

    // Read and parse build info
    const content = await readFile(buildInfoPath, "utf-8");
    let info;
    try {
      info = JSON.parse(content);
    } catch (parseError) {
      console.error("Failed to parse .build-info.json:", parseError);
      return null;
    }

    return {
      version: info.version || "unknown",
      buildDate: info.buildDate || "unknown",
      commitSha: info.commitSha || "unknown",
      commitRef: info.commitRef || "unknown",
    };
  } catch {
    // File doesn't exist in dev mode - this is expected, silently return null
    return null;
  }
}

/**
 * Get version from package.json (fallback for dev mode)
 */
async function getPackageVersion(): Promise<string> {
  try {
    const packageJsonPath = join(process.cwd(), "package.json");
    const content = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    return packageJson.version || "unknown";
  } catch (error) {
    console.error("Failed to read package.json version:", error);
    return "unknown";
  }
}

/**
 * Load build info from filesystem
 * Tries Docker .build-info.json first, then falls back to package.json
 */
async function loadBuildInfo(): Promise<BuildInfo> {
  const dockerBuildInfo = await getDockerBuildInfo();
  if (dockerBuildInfo) {
    return dockerBuildInfo;
  }

  // Fallback for local development (not running in Docker)
  const packageVersion = await getPackageVersion();
  return {
    version: packageVersion,
    buildDate: "dev",
    commitSha: "dev",
    commitRef: "dev",
  };
}

/**
 * Initialize build info cache during server startup
 * This should be called from instrumentation.ts register() hook
 */
export async function initializeVersion(): Promise<void> {
  if (cachedBuildInfo === null && buildInfoLoadPromise === null) {
    buildInfoLoadPromise = loadBuildInfo();
    cachedBuildInfo = await buildInfoLoadPromise;
    buildInfoLoadPromise = null;
  }
}

/**
 * Get current application build info (async)
 * Returns cached build info if available, otherwise loads it
 */
export async function getBuildInfo(): Promise<BuildInfo> {
  if (cachedBuildInfo !== null) {
    return cachedBuildInfo;
  }

  // If another call is already loading the build info, wait for it
  if (buildInfoLoadPromise !== null) {
    return buildInfoLoadPromise;
  }

  // Load build info and cache it
  buildInfoLoadPromise = loadBuildInfo();
  cachedBuildInfo = await buildInfoLoadPromise;
  buildInfoLoadPromise = null;

  return cachedBuildInfo;
}

/**
 * Get current application version (async)
 * Returns cached version if available, otherwise loads it
 */
export async function getCurrentVersion(): Promise<string> {
  const buildInfo = await getBuildInfo();
  return buildInfo.version;
}

/**
 * Get current application version (sync - for backwards compatibility)
 * Returns cached version if available, otherwise returns "loading..."
 * @deprecated Use getCurrentVersion() async function instead
 */
export function getCurrentVersionSync(): string {
  return cachedBuildInfo?.version || "loading...";
}

/**
 * Build GitHub URL for a version
 */
export function buildGitHubUrl(version: string, commitSha?: string): string {
  const repoOwner = process.env.GITHUB_REPO_OWNER || "panteLx";
  const repoName = process.env.GITHUB_REPO_NAME || "BetterShift";
  const baseUrl = `https://github.com/${repoOwner}/${repoName}`;

  // Check if version matches semver pattern (e.g., 1.1.1 or v1.1.1)
  const semverPattern = /^v?\d+\.\d+\.\d+$/;
  if (semverPattern.test(version)) {
    const tag = version.startsWith("v") ? version : `v${version}`;
    return `${baseUrl}/releases/tag/${tag}`;
  }

  // For dev builds, link to commit if available
  if (commitSha && commitSha !== "unknown" && commitSha !== "dev") {
    return `${baseUrl}/commit/${commitSha}`;
  }

  // Otherwise link to main repo
  return baseUrl;
}

/**
 * Get version info for UI components (like AppFooter)
 */
export async function getVersionInfo(): Promise<{
  version: string;
  githubUrl: string;
}> {
  const buildInfo = await getBuildInfo();
  const githubUrl = buildGitHubUrl(buildInfo.version, buildInfo.commitSha);

  return {
    version: buildInfo.version,
    githubUrl,
  };
}
