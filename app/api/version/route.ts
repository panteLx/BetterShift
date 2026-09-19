import { NextRequest, NextResponse } from "next/server";
import { getBuildInfo, buildGitHubUrl } from "@/lib/version";
import { getAdminUser } from "@/lib/auth/admin-helpers";
import { isAdmin } from "@/lib/auth/admin";
import { getSystemSettings } from "@/lib/system-settings";
import { TELEMETRY_SCHEMA_VERSION } from "@/lib/telemetry/schema";
import { isTelemetryForcedByEnv } from "@/lib/telemetry/config";

/**
 * Cache Strategy: 15 minutes for the GitHub release lookup.
 * - GitHub API revalidation: 15 minutes (cachedLatestRelease below)
 * - Client polling interval: 15 minutes
 *
 * The response as a whole is NOT cached server-wide any more: whether
 * latestVersion/hasUpdate are included depends on the requester's role
 * (see updateBannerVisibility), so a shared cache would leak one user's
 * view to another. Cache-Control is "private" for the same reason.
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
  /** Admins only: the consent dialog must be shown. */
  telemetryPrompt?: boolean;
}

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

/** Whether the given requester's role is included in the configured banner audience. */
function isVisibleToRequester(
  requesterIsAdmin: boolean,
  visibility: "all" | "admins"
): boolean {
  if (visibility === "all") return true;

  // "admins": only requesters with an admin/superadmin role qualify
  return requesterIsAdmin;
}

export async function GET(request: NextRequest) {
  const [buildInfo, settings] = await Promise.all([
    getBuildInfo(), // from .build-info.json (created at build time)
    getSystemSettings(),
  ]);

  // Once an instance has answered for the current schema no prompt is possible,
  // so the session lookup is skipped unless a role-specific answer needs it.
  const telemetryPromptPossible =
    !isTelemetryForcedByEnv() &&
    (settings.telemetryEnabled === null ||
      (settings.telemetryEnabled === true &&
        (settings.telemetryConsentedSchema ?? 0) < TELEMETRY_SCHEMA_VERSION));
  const needsRequesterRole =
    settings.updateBannerVisibility === "admins" || telemetryPromptPossible;
  // Resolved once and reused below, so the admin lookup only runs once per request.
  const requesterIsAdmin = needsRequesterRole
    ? isAdmin(await getAdminUser(request.headers))
    : false;

  // Build GitHub URL based on version and commit
  const githubUrl = buildGitHubUrl(buildInfo.version, buildInfo.commitSha);

  // Determine if this is a dev version
  const isDev = isDevVersion(buildInfo.version);

  // Get latest release for update check (only if enabled and not a dev version)
  const latestRelease =
    settings.updateCheckEnabled && !isDev ? await getLatestRelease() : null;
  const hasUpdate =
    latestRelease && !isDev
      ? compareVersions(buildInfo.version, latestRelease.version)
      : undefined;

  const showUpdateInfo =
    !!latestRelease &&
    isVisibleToRequester(requesterIsAdmin, settings.updateBannerVisibility);

  // Admin-only and never cached across roles: the response is already
  // Cache-Control: private for exactly this reason.
  const telemetryPrompt = telemetryPromptPossible && requesterIsAdmin;

  const response: VersionResponse = {
    version: buildInfo.version,
    commitHash:
      buildInfo.commitSha.length >= 7
        ? buildInfo.commitSha.substring(0, 7)
        : buildInfo.commitSha, // Return full string if shorter than 7 chars (e.g., "dev", "unknown")
    buildDate: buildInfo.buildDate,
    githubUrl,
    isDev,
    ...(showUpdateInfo &&
      latestRelease && {
        latestVersion: latestRelease.version,
        latestUrl: latestRelease.url,
        hasUpdate,
      }),
    telemetryPrompt,
  };

  return NextResponse.json(response, {
    headers: {
      // "private": the response varies by requester role, so shared/CDN caches must not reuse it.
      // While a prompt is pending, no-store: a cached response would let an admin's browser keep
      // re-showing the consent dialog after they already answered it, until the max-age expired.
      "Cache-Control": telemetryPrompt
        ? "private, no-store"
        : `private, max-age=${CACHE_SECONDS}`,
    },
  });
}
