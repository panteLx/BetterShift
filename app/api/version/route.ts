import { NextResponse } from "next/server";

// Cache version info for 1 hour
let cachedVersion: {
  version: string;
  branch: string;
  commitHash: string;
  buildDate: string;
  timestamp: number;
} | null = null;

const CACHE_SECONDS = parseInt(
  process.env.VERSION_CACHE_DURATION || "3600",
  10
); // Default: 1 hour in seconds
const CACHE_DURATION = CACHE_SECONDS * 1000; // Convert to milliseconds for in-memory TTL
const GITHUB_API_REVALIDATE = parseInt(
  process.env.GITHUB_API_REVALIDATE || "3600",
  10
); // Default: 1 hour in seconds

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "panteLx";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "BetterShift";
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || "main";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

async function fetchGitHubVersion() {
  try {
    // Get latest commit from configured branch
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/commits/${GITHUB_BRANCH}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          ...(GITHUB_TOKEN && { Authorization: `Bearer ${GITHUB_TOKEN}` }),
        },
        next: { revalidate: GITHUB_API_REVALIDATE },
      }
    );

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`);
    }

    const data = await response.json();
    const commitHash = data.sha.substring(0, 7);
    const branch = GITHUB_BRANCH;

    return {
      version: `${branch}-${commitHash}`,
      branch,
      commitHash,
      buildDate: data.commit.committer.date,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to fetch GitHub version:", error);
    return null;
  }
}

export async function GET() {
  // Check if we have a valid cached version
  if (cachedVersion && Date.now() - cachedVersion.timestamp < CACHE_DURATION) {
    return NextResponse.json(
      {
        version: cachedVersion.version,
        branch: cachedVersion.branch,
        commitHash: cachedVersion.commitHash,
        buildDate: cachedVersion.buildDate,
      },
      {
        headers: {
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      }
    );
  }

  // Fetch new version from GitHub
  const versionInfo = await fetchGitHubVersion();

  if (versionInfo) {
    cachedVersion = versionInfo;
    return NextResponse.json(
      {
        version: versionInfo.version,
        branch: versionInfo.branch,
        commitHash: versionInfo.commitHash,
        buildDate: versionInfo.buildDate,
      },
      {
        headers: {
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
        },
      }
    );
  }

  // Fallback to dev-local if GitHub API fails
  return NextResponse.json(
    {
      version: "dev-local",
      branch: "unknown",
      commitHash: "unknown",
      buildDate: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60", // Shorter cache on error
      },
    }
  );
}
