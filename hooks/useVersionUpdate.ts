"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { readStorage, writeStorage, removeStorage } from "@/lib/utils";

interface VersionInfo {
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

// Dismissing is per-version: the banner reappears once a newer release ships
const DISMISSED_VERSION_KEY = "dismissed-update-version";

async function fetchVersionInfo(): Promise<VersionInfo> {
  // Server has 15-minute cache, no need for cache-busting
  const response = await fetch("/api/version");
  if (!response.ok) {
    throw new Error(`Failed to fetch version info: ${response.status} ${response.statusText}`);
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    throw new Error(`Invalid content type for version info: ${contentType}`);
  }

  return response.json();
}

export function useVersionUpdateCheck() {
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(() =>
    readStorage(DISMISSED_VERSION_KEY)
  );

  // useQuery dedupes identical queryKey fetches/timers across every mounted
  // consumer (app-header, auth-header, info-dialog, admin page), instead of
  // each one running its own independent fetch + setInterval.
  const { data: versionInfo, isLoading: loading, refetch } = useQuery({
    queryKey: queryKeys.version,
    queryFn: fetchVersionInfo,
    // Check for updates every 15 minutes (aligned with server cache)
    refetchInterval: 15 * 60 * 1000,
  });

  const dismissUpdate = useCallback(() => {
    if (!versionInfo?.latestVersion) return;
    writeStorage(DISMISSED_VERSION_KEY, versionInfo.latestVersion);
    setDismissedVersion(versionInfo.latestVersion);
  }, [versionInfo]);

  const resetDismissal = useCallback(() => {
    removeStorage(DISMISSED_VERSION_KEY);
    setDismissedVersion(null);
  }, []);

  // Raw hasUpdate flag stays on versionInfo (e.g. for the admin dashboard,
  // which should keep showing it regardless of a personal dismiss); showUpdate
  // is what the header banner should actually render.
  const hasUpdate = !!versionInfo?.hasUpdate && !versionInfo.isDev;
  const isDismissed = hasUpdate && versionInfo?.latestVersion === dismissedVersion;
  const showUpdate = hasUpdate && !isDismissed;

  return {
    versionInfo: versionInfo ?? null,
    loading,
    refetch,
    showUpdate,
    isDismissed,
    dismissUpdate,
    resetDismissal,
  };
}
