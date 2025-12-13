import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Cache Strategy: 15 minutes unified across all version/release endpoints
 * - Server-side cache (cachedVersion): 15 minutes
 * - HTTP Cache-Control: 15 minutes
 * - GitHub API revalidation: 15 minutes
 * - Client polling interval: 15 minutes
 */

// Cache version info
let cachedVersion: {
  version: string;
  commitHash: string;
  timestamp: number;
} | null = null;

// Cache latest release info
let cachedLatestRelease: {
  version: string;
  url: string;
} | null = null;
let cachedLatestReleaseExpiresAt = 0;

let cachedDockerVersion: string | null = null;
let cachedPackageVersion = "";

// Unified cache duration: 15 minutes
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const CACHE_SECONDS = 15 * 60; // 15 minutes

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "panteLx";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "BetterShift";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
    console.log("No .version file found, not running in Docker");
  }

  cachedDockerVersion = null;
  return null;
}

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

async function fetchCommitHash(): Promise<string> {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
        },
        next: { revalidate: CACHE_SECONDS },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    return data.sha.substring(0, 7);
  } catch (error) {
    console.error("Failed to fetch commit hash:", error);
    return "unknown";
  }
}

function buildGitHubUrl(version: string, commitHash: string): string {
  const baseUrl = `https://github.com/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;

  // Check if version matches semver pattern (e.g., 1.1.1 or v1.1.1)
  const semverPattern = /^v?\d+\.\d+\.\d+$/;
  if (semverPattern.test(version)) {
    const tag = version.startsWith("v") ? version : `v${version}`;
    return `${baseUrl}/releases/tag/${tag}`;
  }

  // Otherwise link to commit
  if (commitHash && commitHash !== "unknown") {
    return `${baseUrl}/commit/${commitHash}`;
  }

  return baseUrl;
}

async function getLatestRelease(): Promise<{
  version: string;
  url: string;
} | null> {
  // Return cached release if still valid
  if (cachedLatestRelease && Date.now() < cachedLatestReleaseExpiresAt) {
    return cachedLatestRelease;
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases/latest`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
        },
        next: { revalidate: CACHE_SECONDS },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const release = {
      version: data.tag_name.replace(/^v/, ""), // Remove 'v' prefix
      url: data.html_url,
    };

    // Cache the fetched release
    cachedLatestRelease = release;
    cachedLatestReleaseExpiresAt = Date.now() + CACHE_DURATION;

    return release;
  } catch (error) {
    console.error("Failed to fetch latest release:", error);
    return null;
  }
}

function compareVersions(current: string, latest: string): boolean {
  // Returns true if latest is newer than current
  const parseCurrent = current.split(".").map(Number);
  const parseLatest = latest.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = parseCurrent[i] || 0;
    const lat = parseLatest[i] || 0;

    if (lat > curr) return true;
    if (lat < curr) return false;
  }

  return false;
}

function isDevVersion(version: string): boolean {
  // Check if version contains 'dev' or if it's a Docker :dev tag
  return version.includes("dev") || version === "dev";
}

export async function GET() {
  // Check cache
  if (cachedVersion && Date.now() - cachedVersion.timestamp < CACHE_DURATION) {
    const githubUrl = buildGitHubUrl(
      cachedVersion.version,
      cachedVersion.commitHash
    );

    // Get latest release for update check (only if not dev version)
    const isDev = isDevVersion(cachedVersion.version);
    const latestRelease = !isDev ? await getLatestRelease() : null;
    const hasUpdate =
      latestRelease &&
      !isDev &&
      compareVersions(cachedVersion.version, latestRelease.version);

    return NextResponse.json(
      {
        version: cachedVersion.version,
        commitHash: cachedVersion.commitHash,
        githubUrl,
        isDev,
        ...(latestRelease && {
          latestVersion: latestRelease.version,
          latestUrl: latestRelease.url,
          hasUpdate,
        }),
      },
      {
        headers: {
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      }
    );
  }

  // Try to get version from Docker build arg first
  const dockerVersion = getDockerVersion();
  const version = dockerVersion || getPackageVersion();
  const commitHash = await fetchCommitHash();

  cachedVersion = {
    version,
    commitHash,
    timestamp: Date.now(),
  };

  const githubUrl = buildGitHubUrl(version, commitHash);

  // Get latest release for update check (only if not dev version)
  const isDev = isDevVersion(version);
  const latestRelease = !isDev ? await getLatestRelease() : null;
  const hasUpdate =
    latestRelease && !isDev && compareVersions(version, latestRelease.version);

  return NextResponse.json(
    {
      version,
      commitHash,
      githubUrl,
      isDev,
      ...(latestRelease && {
        latestVersion: latestRelease.version,
        latestUrl: latestRelease.url,
        hasUpdate,
      }),
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      },
    }
  );
}
