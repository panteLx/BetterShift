import { useState, useEffect } from "react";
import { ShiftPreset } from "@/lib/db/schema";

export function usePresets(calendarId: string | undefined) {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);

  const fetchPresets = async () => {
    if (!calendarId) return;

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
    }
  };

  useEffect(() => {
    if (calendarId) {
      fetchPresets();
    } else {
      setPresets([]);
    }
  }, [calendarId]);

  return {
    presets,
    refetchPresets: fetchPresets,
  };
}
