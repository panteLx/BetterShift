import { useState, useEffect } from "react";

interface VersionInfo {
  version: string;
  commitHash: string;
  githubUrl: string;
  isDev: boolean;
  latestVersion?: string;
  latestUrl?: string;
  hasUpdate?: boolean;
}

export function useVersionUpdateCheck() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVersionInfo();

    // Check for updates every 15 minutes (aligned with server cache)
    const interval = setInterval(() => {
      fetchVersionInfo();
    }, 15 * 60 * 1000); // 15 minutes

    return () => clearInterval(interval);
  }, []);

  const fetchVersionInfo = async () => {
    try {
      // Server has 15-minute cache, no need for cache-busting
      const response = await fetch("/api/version");
      if (!response.ok) {
        console.error(
          "Failed to fetch version info:",
          response.status,
          response.statusText
        );
        return;
      }

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Invalid content type for version info:", contentType);
        return;
      }

      const data = await response.json();
      setVersionInfo(data);
    } catch (error) {
      console.error("Failed to fetch version info:", error);
    } finally {
      setLoading(false);
    }
  };

  return { versionInfo, loading, refetch: fetchVersionInfo };
}
