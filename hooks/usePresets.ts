import { useState, useEffect, useCallback } from "react";
import { ShiftPreset } from "@/lib/db/schema";

export function usePresets(calendarId: string | undefined) {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

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
        const params = new URLSearchParams({ calendarId });

        const response = await fetch(`/api/presets?${params}`);
        if (!response.ok) {
          setPresets([]);
          setLoading(false);
          return;
        }
        const data = await response.json();
        setPresets(data);
        setHasLoadedOnce(true);
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
    hasLoadedOnce,
    refetchPresets: fetchPresets,
  };
}
