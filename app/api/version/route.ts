import { NextResponse } from "next/server";
import { getBuildInfo, buildGitHubUrl } from "@/lib/version";

/**
 * Cache Strategy: 15 minutes unified across all version/release endpoints
 * - Server-side cache (cachedVersionInfo): 15 minutes
 * - HTTP Cache-Control: 15 minutes
 * - GitHub API revalidation: 15 minutes
 * - Client polling interval: 15 minutes
 */

interface VersionResponse {
  version: string;
  commitHash: string;
  buildDate: string;
  githubUrl: string;
  isDev: boolean;
  latestVersion?: string;
  latestUrl?: string;
  hasUpdate?: boolean;
}

// Cache version info with timestamp
let cachedVersionInfo: {
  data: VersionResponse;
  timestamp: number;
} | null = null;

// Cache latest release info
let cachedLatestRelease: {
  version: string;
  url: string;
} | null = null;
let cachedLatestReleaseExpiresAt = 0;

// Unified cache duration: 15 minutes
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes
const CACHE_SECONDS = 15 * 60; // 15 minutes

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "panteLx";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "BetterShift";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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
  // Remove 'v' prefix if present
  const cleanCurrent = current.replace(/^v/, "");
  const cleanLatest = latest.replace(/^v/, "");

  const parseCurrent = cleanCurrent.split(".").map(Number);
  const parseLatest = cleanLatest.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const curr = parseCurrent[i] || 0;
    const lat = parseLatest[i] || 0;

    if (lat > curr) return true;
    if (lat < curr) return false;
  }

  return false;
}

function isDevVersion(version: string): boolean {
  // Check if version is 'dev' or contains 'dev'
  return version === "dev" || version.includes("dev");
}

export async function GET() {
  // Check cache
  if (
    cachedVersionInfo &&
    Date.now() - cachedVersionInfo.timestamp < CACHE_DURATION
  ) {
    return NextResponse.json(cachedVersionInfo.data, {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      },
    });
  }

  // Get build info from .build-info.json (created at build time)
  const buildInfo = await getBuildInfo();

  // Build GitHub URL based on version and commit
  const githubUrl = buildGitHubUrl(buildInfo.version, buildInfo.commitSha);

  // Determine if this is a dev version
  const isDev = isDevVersion(buildInfo.version);

  // Get latest release for update check (only if not dev version)
  const latestRelease = !isDev ? await getLatestRelease() : null;
  const hasUpdate =
    latestRelease && !isDev
      ? compareVersions(buildInfo.version, latestRelease.version)
      : undefined;

  const response: VersionResponse = {
    version: buildInfo.version,
    commitHash: buildInfo.commitSha.substring(0, 7), // Short commit hash
    buildDate: buildInfo.buildDate,
    githubUrl,
    isDev,
    ...(latestRelease && {
      latestVersion: latestRelease.version,
      latestUrl: latestRelease.url,
      hasUpdate,
    }),
  };

  // Cache the response
  cachedVersionInfo = {
    data: response,
    timestamp: Date.now(),
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
    },
  });
}
