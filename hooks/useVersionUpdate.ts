import { useState, useEffect, useCallback } from "react";

interface VersionInfo {
  version: string;
  commitHash: string;
  buildDate: string;
  githubUrl: string;
  isDev: boolean;
  latestVersion?: string;
  latestUrl?: string;
  hasUpdate?: boolean;
}

/**
 * Fetches and validates the version info payload, without touching any
 * component state. Shared by the initial mount check and the manual
 * refetch/interval path below.
 */
async function getVersionInfo(): Promise<VersionInfo | undefined> {
  // Server has 15-minute cache, no need for cache-busting
  const response = await fetch("/api/version");
  if (!response.ok) {
    console.error(
      "Failed to fetch version info:",
      response.status,
      response.statusText
    );
    return undefined;
  }

  const contentType = response.headers.get("content-type");
  if (!contentType || !contentType.includes("application/json")) {
    console.error("Invalid content type for version info:", contentType);
    return undefined;
  }

  return response.json();
}

export function useVersionUpdateCheck() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVersionInfo = useCallback(async () => {
    try {
      const data = await getVersionInfo();
      if (data) {
        setVersionInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch version info:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Inlined (rather than calling `fetchVersionInfo`) so the initial
    // check owns its own guard against a stale response resolving after
    // this effect has already been cleaned up.
    (async () => {
      try {
        const data = await getVersionInfo();
        if (cancelled) return;
        if (data) {
          setVersionInfo(data);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to fetch version info:", error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    // Check for updates every 15 minutes (aligned with server cache)
    const interval = setInterval(() => {
      fetchVersionInfo();
    }, 15 * 60 * 1000); // 15 minutes

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [fetchVersionInfo]);

  return { versionInfo, loading, refetch: fetchVersionInfo };
}
