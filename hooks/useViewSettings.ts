import { useState, useCallback } from "react";

export function useViewSettings() {
  const [shiftsPerDay, setShiftsPerDay] = useState<number | null>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shifts-per-day");
      if (stored === "null") return null;
      if (stored) {
        const parsed = parseInt(stored);
        return isNaN(parsed) ? 3 : parsed;
      }
    }
    return 3;
  });

  const [externalShiftsPerDay, setExternalShiftsPerDay] = useState<
    number | null
  >(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("external-shifts-per-day");
      if (stored === "null") return null;
      if (stored) {
        const parsed = parseInt(stored);
        return isNaN(parsed) ? 3 : parsed;
      }
    }
    return 3;
  });

  const [showShiftNotes, setShowShiftNotes] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("show-shift-notes");
      return stored === "true";
    }
    return false;
  });

  const [showFullTitles, setShowFullTitles] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("show-full-titles");
      return stored === "true";
    }
    return false;
  });

  const [shiftSortType, setShiftSortType] = useState<
    "startTime" | "createdAt" | "title"
  >(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shift-sort-type");
      if (
        stored === "startTime" ||
        stored === "createdAt" ||
        stored === "title"
      ) {
        return stored;
      }
    }
    return "createdAt";
  });

  const [shiftSortOrder, setShiftSortOrder] = useState<"asc" | "desc">(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("shift-sort-order");
      if (stored === "asc" || stored === "desc") {
        return stored;
      }
    }
    return "asc";
  });

  const [combinedSortMode, setCombinedSortMode] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("combined-sort-mode");
      return stored === "true";
    }
    return false;
  });

  const [hidePresetHeader, setHidePresetHeader] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("hide-preset-header");
      return stored === "true";
    }
    return false;
  });

  const handleShiftsPerDayChange = useCallback((count: number | null) => {
    setShiftsPerDay(count);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "shifts-per-day",
        count === null ? "null" : count.toString()
      );
    }
  }, []);

  const handleExternalShiftsPerDayChange = useCallback(
    (count: number | null) => {
      setExternalShiftsPerDay(count);
      if (typeof window !== "undefined") {
        localStorage.setItem(
          "external-shifts-per-day",
          count === null ? "null" : count.toString()
        );
      }
    },
    []
  );

  const handleShowShiftNotesChange = useCallback((show: boolean) => {
    setShowShiftNotes(show);
    if (typeof window !== "undefined") {
      localStorage.setItem("show-shift-notes", show.toString());
    }
  }, []);

  const handleShowFullTitlesChange = useCallback((show: boolean) => {
    setShowFullTitles(show);
    if (typeof window !== "undefined") {
      localStorage.setItem("show-full-titles", show.toString());
    }
  }, []);

  const handleShiftSortTypeChange = useCallback(
    (type: "startTime" | "createdAt" | "title") => {
      setShiftSortType(type);
      if (typeof window !== "undefined") {
        localStorage.setItem("shift-sort-type", type);
      }
    },
    []
  );

  const handleShiftSortOrderChange = useCallback((order: "asc" | "desc") => {
    setShiftSortOrder(order);
    if (typeof window !== "undefined") {
      localStorage.setItem("shift-sort-order", order);
    }
  }, []);

  const handleCombinedSortModeChange = useCallback((combined: boolean) => {
    setCombinedSortMode(combined);
    if (typeof window !== "undefined") {
      localStorage.setItem("combined-sort-mode", combined.toString());
    }
  }, []);

  const handleHidePresetHeaderChange = useCallback((hide: boolean) => {
    setHidePresetHeader(hide);
    if (typeof window !== "undefined") {
      localStorage.setItem("hide-preset-header", hide.toString());
    }
  }, []);

  return {
    shiftsPerDay,
    externalShiftsPerDay,
    showShiftNotes,
    showFullTitles,
    shiftSortType,
    shiftSortOrder,
    combinedSortMode,
    hidePresetHeader,
    handleShiftsPerDayChange,
    handleExternalShiftsPerDayChange,
    handleShowShiftNotesChange,
    handleShowFullTitlesChange,
    handleShiftSortTypeChange,
    handleShiftSortOrderChange,
    handleCombinedSortModeChange,
    handleHidePresetHeaderChange,
  };
}
