import { useState, useEffect } from "react";
import { ShiftPreset } from "@/lib/db/schema";

export function usePresets(calendarId: string | undefined) {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPresets = async () => {
    if (!calendarId) {
      setPresets([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`/api/presets?calendarId=${calendarId}`);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch presets: ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error("Failed to fetch presets:", error);
      setPresets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (calendarId) {
      fetchPresets();
    } else {
      setPresets([]);
      setLoading(false);
    }
  }, [calendarId]);

  return {
    presets,
    loading,
    refetchPresets: fetchPresets,
  };
}
