import { useState, useEffect } from "react";
import { ShiftPreset } from "@/lib/db/schema";

export function usePresets(calendarId: string | undefined) {
  const [presets, setPresets] = useState<ShiftPreset[]>([]);

  const fetchPresets = async () => {
    if (!calendarId) return;

    try {
      const response = await fetch(`/api/presets?calendarId=${calendarId}`);
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error("Failed to fetch presets:", error);
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
