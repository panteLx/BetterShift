import { useState, useEffect } from "react";

interface VersionInfo {
  version: string;
  githubUrl: string;
  commitHash?: string;
}

export function useVersionInfo() {
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const response = await fetch("/api/version");

        if (!response.ok) {
          let errorBody = "";
          try {
            const errorData = await response.json();
            errorBody = JSON.stringify(errorData);
          } catch {
            errorBody = await response.text();
          }
          throw new Error(
            `Fetch /api/version failed: ${response.status} ${response.statusText} - ${errorBody}`
          );
        }

        const data = await response.json();
        setVersionInfo({
          version: data.version,
          githubUrl: data.githubUrl,
          commitHash: data.commitHash,
        });
      } catch (error) {
        console.error("Failed to fetch version:", error);
      }
    };

    fetchVersion();
  }, []);

  return versionInfo;
}
