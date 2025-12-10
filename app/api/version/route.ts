import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

// Cache version info
let cachedVersion: {
  version: string;
  commitHash: string;
  timestamp: number;
} | null = null;

let cachedDockerVersion: string | null = null;
let cachedPackageVersion = "";

const CACHE_DURATION = 3600 * 1000; // 1 hour
const CACHE_SECONDS = 3600;

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
      cachedDockerVersion = readFileSync(versionFilePath, "utf-8").trim();
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

export async function GET() {
  // Check cache
  if (cachedVersion && Date.now() - cachedVersion.timestamp < CACHE_DURATION) {
    const githubUrl = buildGitHubUrl(
      cachedVersion.version,
      cachedVersion.commitHash
    );
    return NextResponse.json(
      {
        version: cachedVersion.version,
        commitHash: cachedVersion.commitHash,
        githubUrl,
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

  return NextResponse.json(
    {
      version,
      commitHash,
      githubUrl,
    },
    {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      },
    }
  );
}
