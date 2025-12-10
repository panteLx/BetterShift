import { useState, useEffect, useCallback } from "react";
import { ShiftPreset } from "@/lib/db/schema";
import { getCachedPassword } from "@/lib/password-cache";

export function usePresets(calendarId: string | undefined) {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(
    async (silent = false) => {
      if (!calendarId) {
        setPresets([]);
        setLoading(false);
        return;
      }

      if (!silent) {
        setLoading(true);
      }
      try {
        const password = getCachedPassword(calendarId);
        const params = new URLSearchParams({ calendarId });
        if (password) {
          params.append("password", password);
        }

        const response = await fetch(`/api/presets?${params}`);
        if (!response.ok) {
          // Calendar is locked and no valid password - return empty array
          setPresets([]);
          setLoading(false);
          return;
        }
        const data = await response.json();
        setPresets(data);
      } catch (error) {
        console.error("Failed to fetch presets:", error);
        setPresets([]);
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [calendarId]
  );

  useEffect(() => {
    if (calendarId) {
      fetchPresets();
    } else {
      setPresets([]);
      setLoading(false);
    }
  }, [calendarId, fetchPresets]);

  return {
    presets,
    loading,
    refetchPresets: fetchPresets,
  };
}
