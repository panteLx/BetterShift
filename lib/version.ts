import { readFile, access } from "fs/promises";
import { join } from "path";

let cachedVersion: string | null = null;
let versionLoadPromise: Promise<string> | null = null;

/**
 * Get version from Docker .version file
 */
async function getDockerVersion(): Promise<string | null> {
  try {
    const versionFilePath = join(process.cwd(), ".version");

    // Check if file exists
    await access(versionFilePath);

    // Read and parse version
    const content = await readFile(versionFilePath, "utf-8");
    // Remove 'v' prefix for consistent version comparison
    return content.trim().replace(/^v/, "");
  } catch {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Get version from package.json
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
 * Load version from filesystem
 * Tries Docker .version file first, then package.json
 */
async function loadVersion(): Promise<string> {
  const dockerVersion = await getDockerVersion();
  if (dockerVersion) {
    return dockerVersion;
  }
  return getPackageVersion();
}

/**
 * Initialize version cache during server startup
 * This should be called from instrumentation.ts register() hook
 */
export async function initializeVersion(): Promise<void> {
  if (cachedVersion === null && versionLoadPromise === null) {
    versionLoadPromise = loadVersion();
    cachedVersion = await versionLoadPromise;
    versionLoadPromise = null;
  }
}

/**
 * Get current application version (async)
 * Returns cached version if available, otherwise loads it
 */
export async function getCurrentVersion(): Promise<string> {
  if (cachedVersion !== null) {
    return cachedVersion;
  }

  // If another call is already loading the version, wait for it
  if (versionLoadPromise !== null) {
    return versionLoadPromise;
  }

  // Load version and cache it
  versionLoadPromise = loadVersion();
  cachedVersion = await versionLoadPromise;
  versionLoadPromise = null;

  return cachedVersion;
}

/**
 * Get current application version (sync - for backwards compatibility)
 * Returns cached version if available, otherwise returns "loading..."
 * @deprecated Use getCurrentVersion() async function instead
 */
export function getCurrentVersionSync(): string {
  return cachedVersion || "loading...";
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
export async function getVersionInfo(): Promise<{
  version: string;
  githubUrl: string;
}> {
  const version = await getCurrentVersion();
  const githubUrl = buildGitHubUrl(version);

  return {
    version,
    githubUrl,
  };
}
