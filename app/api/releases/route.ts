import { NextResponse } from "next/server";

const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || "panteLx";
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || "BetterShift";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

// Unified cache duration: 15 minutes
const CACHE_SECONDS = 15 * 60; // 15 minutes

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  created_at: string;
  published_at: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
}

export async function GET() {
  try {
    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/releases`,
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

    const releases: GitHubRelease[] = await response.json();

    // Filter out drafts and prereleases
    const publicReleases = releases.filter(
      (release) => !release.draft && !release.prerelease
    );

    return NextResponse.json(publicReleases, {
      headers: {
        "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
      },
    });
  } catch (error) {
    console.error("Failed to fetch releases:", error);
    return NextResponse.json(
      { error: "Failed to fetch releases" },
      { status: 500 }
    );
  }
}
