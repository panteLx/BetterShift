"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getDateLocale } from "@/lib/locales";
import { motion, AnimatePresence } from "motion/react";
import { ShiftWithCalendar } from "@/lib/types";
import {
  ShiftPreset,
  CalendarNote,
  ExternalSync,
  Shift,
} from "@/lib/db/schema";
import { useCalendars } from "@/hooks/useCalendars";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { useNotes } from "@/hooks/useNotes";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useShiftActions } from "@/hooks/useShiftActions";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useDialogStates } from "@/hooks/useDialogStates";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { useAuth } from "@/hooks/useAuth";
import { EmptyCalendarState } from "@/components/empty-calendar-state";
import { GuestEmptyState } from "@/components/guest-empty-state";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { CalendarContent } from "@/components/calendar-content";
import { CalendarCompareSheet } from "@/components/calendar-compare-sheet";
import { CalendarCompareView } from "@/components/calendar-compare-view";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { DialogManager } from "@/components/dialog-manager";
import { getCalendarDays } from "@/lib/calendar-utils";
import { formatDateToLocal } from "@/lib/date-utils";
import { findNotesForDate } from "@/lib/event-utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const t = useTranslations();

  // Auth hook
  const { isGuest } = useAuth();

  // Data hooks
  const {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    hasLoadedOnce,
    createCalendar: createCalendarHook,
    deleteCalendar: deleteCalendarHook,
    refetchCalendars,
  } = useCalendars(searchParams.get("id"));

  const {
    shifts,
    setShifts,
    loading: shiftsLoading,
    hasLoadedOnce: shiftsLoadedOnce,
    createShift: createShiftHook,
    updateShift: updateShiftHook,
    deleteShift: deleteShiftHook,
    refetchShifts,
  } = useShifts(selectedCalendar);

  const {
    presets,
    loading: presetsLoading,
    hasLoadedOnce: presetsLoadedOnce,
    refetchPresets,
  } = usePresets(selectedCalendar);

  // Local state
  const [selectedPresetId, setSelectedPresetId] = useState<
    string | undefined
  >();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [compareNoteCalendarId, setCompareNoteCalendarId] = useState<
    string | undefined
  >();

  // Compare mode state (needs to be before useNotes hook)
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [showCompareSelector, setShowCompareSelector] = useState(false);
  const [selectedCompareIds, setSelectedCompareIds] = useState<string[]>([]);
  const [compareDataLoading, setCompareDataLoading] = useState(false);

  const {
    notes,
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
    refetchNotes,
  } = useNotes(isCompareMode ? compareNoteCalendarId : selectedCalendar);
  const {
    externalSyncs,
    hasSyncErrors,
    syncLogRefreshTrigger,
    setSyncLogRefreshTrigger,
    fetchExternalSyncs,
    fetchSyncErrorStatus,
  } = useExternalSync(selectedCalendar || null);

  // View settings
  const viewSettings = useViewSettings();

  // Dialog states
  const dialogStates = useDialogStates();

  // Note actions
  const noteActions = useNoteActions({
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
  });

  // Wrapper for note submit that reloads compare data
  const handleNoteSubmit = async (
    noteText: string,
    type: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => {
    await noteActions.handleNoteSubmit(
      noteText,
      type,
      color,
      recurringPattern,
      recurringInterval
    );

    // Reload notes for the specific calendar in compare mode
    if (isCompareMode && compareNoteCalendarId) {
      try {
        const notesRes = await fetch(
          `/api/notes?calendarId=${compareNoteCalendarId}`
        );
        const notesData = notesRes.ok ? await notesRes.json() : [];
        setCompareCalendarData((prev) => {
          const updated = new Map(prev);
          const data = updated.get(compareNoteCalendarId);
          if (data) {
            updated.set(compareNoteCalendarId, { ...data, notes: notesData });
          }
          return updated;
        });
      } catch (error) {
        console.error("Failed to reload notes:", error);
      }
    }
  };

  // Wrapper for note delete that reloads compare data
  const handleNoteDelete = async () => {
    await noteActions.handleNoteDelete();

    // Reload notes for the specific calendar in compare mode
    if (isCompareMode && compareNoteCalendarId) {
      try {
        const notesRes = await fetch(
          `/api/notes?calendarId=${compareNoteCalendarId}`
        );
        const notesData = notesRes.ok ? await notesRes.json() : [];
        setCompareCalendarData((prev) => {
          const updated = new Map(prev);
          const data = updated.get(compareNoteCalendarId);
          if (data) {
            updated.set(compareNoteCalendarId, { ...data, notes: notesData });
          }
          return updated;
        });
      } catch (error) {
        console.error("Failed to reload notes:", error);
      }
    }
  };

  // Notes list dialog handlers
  const handleEditNoteFromList = (note: CalendarNote) => {
    dialogStates.setShowNotesListDialog(false);
    noteActions.openNoteDialog(
      dialogStates.selectedDayDate || new Date(),
      note
    );
  };

  const handleDeleteNoteFromList = async (noteId: string) => {
    const success = await deleteNoteHook(noteId);

    if (success) {
      // Update the notes list in the dialog
      const updatedNotes = dialogStates.selectedDayNotes.filter(
        (n) => n.id !== noteId
      );
      dialogStates.setSelectedDayNotes(updatedNotes);

      // If no notes left, close the dialog
      if (updatedNotes.length === 0) {
        dialogStates.setShowNotesListDialog(false);
      }

      // Reload compare mode data if needed
      if (isCompareMode && compareNoteCalendarId) {
        try {
          const notesRes = await fetch(
            `/api/notes?calendarId=${compareNoteCalendarId}`
          );
          const notesData = notesRes.ok ? await notesRes.json() : [];
          setCompareCalendarData((prev) => {
            const updated = new Map(prev);
            const data = updated.get(compareNoteCalendarId);
            if (data) {
              updated.set(compareNoteCalendarId, { ...data, notes: notesData });
            }
            return updated;
          });
        } catch (error) {
          console.error("Failed to reload notes:", error);
        }
      }
    }
  };

  const handleAddNewNoteFromList = () => {
    const date = dialogStates.selectedDayDate || new Date();
    noteActions.openNoteDialog(date, undefined);
  };

  // External sync management
  const [compareCalendarData, setCompareCalendarData] = useState<
    Map<
      string,
      {
        shifts: ShiftWithCalendar[];
        notes: CalendarNote[];
        externalSyncs: ExternalSync[];
        presets: ShiftPreset[];
        togglingDates: Set<string>;
      }
    >
  >(new Map());

  // Version info
  const versionInfo = useVersionInfo();

  // Shift actions
  const shiftActions = useShiftActions({
    shifts,
    setShifts,
    presets,
    createShift: createShiftHook,
    updateShift: updateShiftHook,
    deleteShift: deleteShiftHook,
    onStatsRefresh: () => setStatsRefreshTrigger((prev) => prev + 1),
  });

  // SSE Connection
  useSSEConnection({
    calendarId: selectedCalendar,
    onShiftUpdate: refetchShifts,
    onPresetUpdate: refetchPresets,
    onNoteUpdate: refetchNotes,
    onCalendarUpdate: refetchCalendars,
    onStatsRefresh: () => setStatsRefreshTrigger((prev) => prev + 1),
    onSyncLogUpdate: () => {
      fetchSyncErrorStatus();
      setSyncLogRefreshTrigger((prev) => prev + 1);
    },
    isConnected,
    setIsConnected,
  });

  // Load data for compare mode
  useEffect(() => {
    if (!isCompareMode || selectedCompareIds.length === 0) return;

    const loadCompareData = async () => {
      setCompareDataLoading(true);
      const dataMap = new Map();

      // Load all calendars in parallel
      await Promise.all(
        selectedCompareIds.map(async (calendarId) => {
          try {
            // Fetch all data for this calendar in parallel
            const [shiftsRes, notesRes, syncsRes, presetsRes] =
              await Promise.all([
                fetch(`/api/shifts?calendarId=${calendarId}`),
                fetch(`/api/notes?calendarId=${calendarId}`),
                fetch(`/api/external-syncs?calendarId=${calendarId}`),
                fetch(`/api/presets?calendarId=${calendarId}`),
              ]);

            const [shiftsData, notesData, syncsData, presetsData] =
              await Promise.all([
                shiftsRes.ok ? shiftsRes.json() : [],
                notesRes.ok ? notesRes.json() : [],
                syncsRes.ok ? syncsRes.json() : [],
                presetsRes.ok ? presetsRes.json() : [],
              ]);

            dataMap.set(calendarId, {
              shifts: shiftsData,
              notes: notesData,
              externalSyncs: syncsData,
              presets: presetsData,
              togglingDates: new Set<string>(),
            });
          } catch (error) {
            console.error(
              `Error loading data for calendar ${calendarId}:`,
              error
            );
            dataMap.set(calendarId, {
              shifts: [],
              notes: [],
              externalSyncs: [],
              presets: [],
              togglingDates: new Set<string>(),
            });
          }
        })
      );

      setCompareCalendarData(dataMap);
      setCompareDataLoading(false);
    };

    loadCompareData();
  }, [isCompareMode, selectedCompareIds]);

  // Load compare mode from URL on initial load
  useEffect(() => {
    const compareParam = searchParams.get("compare");
    if (compareParam && !isCompareMode) {
      const calendarIds = compareParam.split(",").filter((id) => id.trim());
      if (calendarIds.length >= 2 && calendarIds.length <= 3) {
        // Verify that all calendars exist
        const validIds = calendarIds.filter((id) =>
          calendars.some((cal) => cal.id === id)
        );
        if (validIds.length >= 2) {
          setSelectedCompareIds(validIds);
          setIsCompareMode(true);
        }
      }
    } else if (!compareParam && isCompareMode) {
      // If compare param is removed from URL, exit compare mode
      setIsCompareMode(false);
      setSelectedCompareIds([]);
      setCompareCalendarData(new Map());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, calendars]);

  // Update URL when calendar or compare mode changes
  useEffect(() => {
    if (isCompareMode && selectedCompareIds.length >= 2) {
      // In compare mode
      router.replace(`/?compare=${selectedCompareIds.join(",")}`, {
        scroll: false,
      });
    } else if (selectedCalendar && !isCompareMode) {
      // Normal mode with selected calendar
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, isCompareMode, selectedCompareIds, router]);

  // Calendar operations
  const handleDeleteCalendar = async () => {
    if (!selectedCalendar) return;
    const success = await deleteCalendarHook(selectedCalendar);
    if (success) {
      dialogStates.setShowCalendarSettingsDialog(false);
    }
  };

  // External sync operations
  const handleSyncNotifications = () => {
    dialogStates.setShowSyncNotificationDialog(true);
  };

  const handleSyncComplete = () => {
    refetchShifts();
    refetchCalendars();
    setStatsRefreshTrigger((prev) => prev + 1);
    fetchExternalSyncs();
    fetchSyncErrorStatus();
  };

  // Manual shift creation
  const handleManualShiftCreation = () => {
    setSelectedDate(new Date());
    dialogStates.setShowShiftDialog(true);
  };

  // Day interaction handlers
  const handleDayClick = (date: Date) => {
    shiftActions.handleAddShift(date, selectedPresetId);
  };

  const handleDayRightClick = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleNoteIconClick = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleLongPressDay = (date: Date) => {
    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleShowAllShifts = (date: Date, dayShifts: ShiftWithCalendar[]) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedDayShifts(dayShifts);
    dialogStates.setShowDayShiftsDialog(true);
  };

  const handleShowSyncedShifts = (
    date: Date,
    syncedShifts: ShiftWithCalendar[]
  ) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedSyncedShifts(syncedShifts);
    dialogStates.setShowSyncedShiftsDialog(true);
  };

  const handleDeleteShiftFromDayDialog = async (shiftId: string) => {
    dialogStates.setShowDayShiftsDialog(false);
    await shiftActions.handleDeleteShift(shiftId);
    refetchShifts();
  };

  // Compare mode handlers
  const handleCompareClick = () => {
    setShowCompareSelector(true);
  };

  const handleToggleCompareCalendar = (calendarId: string) => {
    setSelectedCompareIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleStartCompare = () => {
    setShowCompareSelector(false);
    setIsCompareMode(true);
  };

  const handleExitCompare = () => {
    setIsCompareMode(false);
    setSelectedCompareIds([]);
    setCompareCalendarData(new Map());
    // Immediately update URL to prevent re-loading from URL parameter
    if (selectedCalendar) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    } else {
      router.replace(`/`, { scroll: false });
    }
  };

  // Compare mode interaction handlers
  const handleCompareDayClick = async (calendarId: string, date: Date) => {
    if (!selectedPresetId) {
      // No preset selected, just show existing shifts if any
      const calendarData = compareCalendarData.get(calendarId);
      if (!calendarData) return;

      const dayShifts = calendarData.shifts.filter(
        (shift) => shift.date && isSameDay(new Date(shift.date), date)
      );

      if (dayShifts.length > 0) {
        dialogStates.setSelectedDayDate(date);
        dialogStates.setSelectedDayShifts(dayShifts);
        dialogStates.setShowDayShiftsDialog(true);
      }
      return;
    }

    // Preset selected, add or remove shift
    const calendarData = compareCalendarData.get(calendarId);
    if (!calendarData) return;

    const preset = calendarData.presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    const targetDate = new Date(date);
    const dateKey = formatDateToLocal(targetDate);

    // Check if already toggling
    if (calendarData.togglingDates.has(dateKey)) return;

    // Mark as toggling
    const newTogglingDates = new Set(calendarData.togglingDates);
    newTogglingDates.add(dateKey);
    setCompareCalendarData((prev) => {
      const updated = new Map(prev);
      const data = updated.get(calendarId);
      if (data) {
        updated.set(calendarId, { ...data, togglingDates: newTogglingDates });
      }
      return updated;
    });

    try {
      // Check if shift already exists
      const existingShift = calendarData.shifts.find(
        (shift) =>
          shift.date &&
          isSameDay(new Date(shift.date), targetDate) &&
          shift.title === preset.title &&
          shift.startTime === preset.startTime &&
          shift.endTime === preset.endTime
      );

      if (existingShift) {
        // Delete existing shift
        const response = await fetch(`/api/shifts/${existingShift.id}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (!response.ok) {
          toast.error(t("common.deleteError", { item: t("shift.shift_one") }));
        } else {
          toast.success(t("common.deleted", { item: t("shift.shift_one") }));
          // Reload shifts for this calendar
          const shiftsRes = await fetch(`/api/shifts?calendarId=${calendarId}`);
          const shiftsData = shiftsRes.ok ? await shiftsRes.json() : [];
          setCompareCalendarData((prev) => {
            const updated = new Map(prev);
            const data = updated.get(calendarId);
            if (data) {
              updated.set(calendarId, { ...data, shifts: shiftsData });
            }
            return updated;
          });
          setStatsRefreshTrigger((prev) => prev + 1);
        }
      } else {
        // Create new shift
        const shiftData = {
          calendarId,
          date: dateKey,
          startTime: preset.startTime,
          endTime: preset.endTime,
          title: preset.title,
          color: preset.color,
          notes: preset.notes || "",
          presetId: preset.id,
          isAllDay: preset.isAllDay || false,
        };

        const response = await fetch("/api/shifts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(shiftData),
        });

        if (!response.ok) {
          toast.error(t("common.createError", { item: t("shift.shift_one") }));
        } else {
          toast.success(t("common.created", { item: t("shift.shift_one") }));
          // Reload shifts for this calendar
          const shiftsRes = await fetch(`/api/shifts?calendarId=${calendarId}`);
          const shiftsData = shiftsRes.ok ? await shiftsRes.json() : [];
          setCompareCalendarData((prev) => {
            const updated = new Map(prev);
            const data = updated.get(calendarId);
            if (data) {
              updated.set(calendarId, { ...data, shifts: shiftsData });
            }
            return updated;
          });
          setStatsRefreshTrigger((prev) => prev + 1);
        }
      }
    } catch (error) {
      console.error("Failed to toggle shift:", error);
      toast.error(t("common.error"));
    } finally {
      // Remove toggling state
      setCompareCalendarData((prev) => {
        const updated = new Map(prev);
        const data = updated.get(calendarId);
        if (data) {
          const newTogglingDates = new Set(data.togglingDates);
          newTogglingDates.delete(dateKey);
          updated.set(calendarId, { ...data, togglingDates: newTogglingDates });
        }
        return updated;
      });
    }
  };

  const handleCompareDayRightClick = (
    calendarId: string,
    e: React.MouseEvent,
    date: Date
  ) => {
    e.preventDefault();
    const calendarData = compareCalendarData.get(calendarId);
    if (!calendarData) return;

    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(calendarData.notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      setCompareNoteCalendarId(calendarId);
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      setCompareNoteCalendarId(calendarId);
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleCompareNoteIconClick = (
    calendarId: string,
    e: React.MouseEvent,
    date: Date
  ) => {
    e.stopPropagation();
    const calendarData = compareCalendarData.get(calendarId);
    if (!calendarData) return;

    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(calendarData.notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      setCompareNoteCalendarId(calendarId);
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      setCompareNoteCalendarId(calendarId);
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleCompareLongPress = (calendarId: string, date: Date) => {
    const calendarData = compareCalendarData.get(calendarId);
    if (!calendarData) return;

    // Get all notes/events for this date (including recurring)
    const allDayNotes = findNotesForDate(calendarData.notes, date);

    // Always show list dialog when notes exist (to allow adding more)
    if (allDayNotes.length >= 1) {
      setCompareNoteCalendarId(calendarId);
      dialogStates.setSelectedDayDate(date);
      dialogStates.setSelectedDayNotes(allDayNotes);
      dialogStates.setShowNotesListDialog(true);
    } else {
      // No notes - show note edit dialog to create new
      setCompareNoteCalendarId(calendarId);
      noteActions.openNoteDialog(date, undefined);
    }
  };

  const handleCompareShowAllShifts = (
    calendarId: string,
    date: Date,
    dayShifts: ShiftWithCalendar[]
  ) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedDayShifts(dayShifts);
    dialogStates.setShowDayShiftsDialog(true);
  };

  const handleCompareShowSyncedShifts = (
    calendarId: string,
    date: Date,
    syncedShifts: ShiftWithCalendar[]
  ) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedSyncedShifts(syncedShifts);
    dialogStates.setShowSyncedShiftsDialog(true);
  };

  // Show fullscreen loader only on first load (prevents spinner on navigation)
  // Only show if at least one data source hasn't loaded yet
  if (
    (!hasLoadedOnce && loading) ||
    (!shiftsLoadedOnce && shiftsLoading) ||
    (!presetsLoadedOnce && presetsLoading)
  ) {
    return <FullscreenLoader message={t("common.loading")} />;
  }

  // Calendar grid calculations
  const calendarDays = getCalendarDays(currentDate);

  // If in compare mode, render compare view
  if (isCompareMode) {
    // Show loader while loading compare data
    if (compareDataLoading) {
      return <FullscreenLoader message={t("common.loading")} />;
    }

    return (
      <>
        <CalendarCompareView
          calendars={calendars}
          selectedIds={selectedCompareIds}
          allCalendars={calendars}
          calendarDays={calendarDays}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          shiftsMap={
            new Map(
              Array.from(compareCalendarData.entries()).map(([id, data]) => [
                id,
                data.shifts,
              ])
            )
          }
          notesMap={
            new Map(
              Array.from(compareCalendarData.entries()).map(([id, data]) => [
                id,
                data.notes,
              ])
            )
          }
          externalSyncsMap={
            new Map(
              Array.from(compareCalendarData.entries()).map(([id, data]) => [
                id,
                data.externalSyncs,
              ])
            )
          }
          presetsMap={
            new Map(
              Array.from(compareCalendarData.entries()).map(([id, data]) => [
                id,
                data.presets || [],
              ])
            )
          }
          selectedPresetId={selectedPresetId}
          onSelectPreset={setSelectedPresetId}
          togglingDatesMap={
            new Map(
              Array.from(compareCalendarData.entries()).map(([id, data]) => [
                id,
                data.togglingDates,
              ])
            )
          }
          maxShiftsToShow={
            viewSettings.shiftsPerDay === null
              ? undefined
              : viewSettings.shiftsPerDay
          }
          maxExternalShiftsToShow={
            viewSettings.externalShiftsPerDay === null
              ? undefined
              : viewSettings.externalShiftsPerDay
          }
          showShiftNotes={viewSettings.showShiftNotes}
          showFullTitles={viewSettings.showFullTitles}
          shiftSortType={viewSettings.shiftSortType}
          shiftSortOrder={viewSettings.shiftSortOrder}
          combinedSortMode={viewSettings.combinedSortMode}
          highlightedWeekdays={viewSettings.highlightedWeekdays}
          highlightColor={viewSettings.highlightColor}
          statsRefreshTrigger={statsRefreshTrigger}
          locale={dateLocale}
          onDayClick={handleCompareDayClick}
          onDayRightClick={handleCompareDayRightClick}
          onNoteIconClick={handleCompareNoteIconClick}
          onLongPress={handleCompareLongPress}
          onShowAllShifts={handleCompareShowAllShifts}
          onShowSyncedShifts={handleCompareShowSyncedShifts}
          onViewSettingsClick={() =>
            dialogStates.setShowViewSettingsDialog(true)
          }
          onExit={handleExitCompare}
          hidePresetHeader={viewSettings.hidePresetHeader}
          onHidePresetHeaderChange={viewSettings.handleHidePresetHeaderChange}
          onPresetsChange={async (calendarId: string) => {
            // Reload presets and shifts for specific calendar
            try {
              const [presetsRes, shiftsRes] = await Promise.all([
                fetch(`/api/presets?calendarId=${calendarId}`),
                fetch(`/api/shifts?calendarId=${calendarId}`),
              ]);

              const [presetsData, shiftsData] = await Promise.all([
                presetsRes.ok ? presetsRes.json() : [],
                shiftsRes.ok ? shiftsRes.json() : [],
              ]);

              setCompareCalendarData((prev) => {
                const updated = new Map(prev);
                const data = updated.get(calendarId);
                if (data) {
                  updated.set(calendarId, {
                    ...data,
                    presets: presetsData,
                    shifts: shiftsData,
                  });
                }
                return updated;
              });
              setStatsRefreshTrigger((prev) => prev + 1);
            } catch (error) {
              console.error(
                `Error reloading presets for calendar ${calendarId}:`,
                error
              );
            }
          }}
          onShiftsChange={() => {
            // Reload shifts for all calendars
            const loadShifts = async () => {
              // Build updates for each calendar in parallel
              const updates = new Map<string, Shift[]>();
              await Promise.all(
                selectedCompareIds.map(async (calendarId) => {
                  try {
                    const shiftsRes = await fetch(
                      `/api/shifts?calendarId=${calendarId}`
                    );
                    const shiftsData = shiftsRes.ok
                      ? await shiftsRes.json()
                      : [];
                    updates.set(calendarId, shiftsData);
                  } catch (error) {
                    console.error(
                      `Error loading shifts for calendar ${calendarId}:`,
                      error
                    );
                  }
                })
              );
              // Apply updates using functional state updater
              setCompareCalendarData((prev) => {
                const dataMap = new Map(prev);
                for (const [calendarId, shiftsData] of updates.entries()) {
                  const currentData = dataMap.get(calendarId);
                  if (currentData) {
                    dataMap.set(calendarId, {
                      ...currentData,
                      shifts: shiftsData,
                    });
                  }
                }
                return dataMap;
              });
            };
            loadShifts();
          }}
          onStatsRefresh={() => setStatsRefreshTrigger((prev) => prev + 1)}
        />

        {/* Dialogs still work in compare mode */}
        <DialogManager
          showCalendarDialog={dialogStates.showCalendarDialog}
          onCalendarDialogChange={dialogStates.setShowCalendarDialog}
          onCreateCalendar={createCalendarHook}
          showShiftDialog={dialogStates.showShiftDialog}
          onShiftDialogChange={dialogStates.setShowShiftDialog}
          onShiftSubmit={shiftActions.handleShiftSubmit}
          selectedDate={selectedDate}
          selectedCalendar={selectedCalendar || null}
          onPresetsChange={refetchPresets}
          calendars={calendars}
          showCalendarSettingsDialog={dialogStates.showCalendarSettingsDialog}
          onCalendarSettingsDialogChange={
            dialogStates.setShowCalendarSettingsDialog
          }
          onCalendarSettingsSuccess={refetchCalendars}
          onDeleteCalendar={handleDeleteCalendar}
          onExternalSyncFromSettings={() =>
            dialogStates.setShowExternalSyncDialog(true)
          }
          showExternalSyncDialog={dialogStates.showExternalSyncDialog}
          onExternalSyncDialogChange={dialogStates.setShowExternalSyncDialog}
          syncErrorRefreshTrigger={syncLogRefreshTrigger}
          onSyncComplete={handleSyncComplete}
          showSyncNotificationDialog={dialogStates.showSyncNotificationDialog}
          onSyncNotificationDialogChange={
            dialogStates.setShowSyncNotificationDialog
          }
          onErrorsMarkedRead={fetchSyncErrorStatus}
          onSyncLogUpdate={() => setSyncLogRefreshTrigger((prev) => prev + 1)}
          showDayShiftsDialog={dialogStates.showDayShiftsDialog}
          onDayShiftsDialogChange={dialogStates.setShowDayShiftsDialog}
          selectedDayDate={dialogStates.selectedDayDate}
          selectedDayShifts={dialogStates.selectedDayShifts}
          locale={locale}
          onDeleteShiftFromDayDialog={handleDeleteShiftFromDayDialog}
          showSyncedShiftsDialog={dialogStates.showSyncedShiftsDialog}
          onSyncedShiftsDialogChange={dialogStates.setShowSyncedShiftsDialog}
          selectedSyncedShifts={dialogStates.selectedSyncedShifts}
          showViewSettingsDialog={dialogStates.showViewSettingsDialog}
          onViewSettingsDialogChange={dialogStates.setShowViewSettingsDialog}
          viewSettings={viewSettings}
          onViewSettingsChange={{
            handleShiftsPerDayChange: viewSettings.handleShiftsPerDayChange,
            handleExternalShiftsPerDayChange:
              viewSettings.handleExternalShiftsPerDayChange,
            handleShowShiftNotesChange: viewSettings.handleShowShiftNotesChange,
            handleShowFullTitlesChange: viewSettings.handleShowFullTitlesChange,
            handleShiftSortTypeChange: viewSettings.handleShiftSortTypeChange,
            handleShiftSortOrderChange: viewSettings.handleShiftSortOrderChange,
            handleCombinedSortModeChange:
              viewSettings.handleCombinedSortModeChange,
            handleHighlightWeekendsChange:
              viewSettings.handleHighlightWeekendsChange,
            handleHighlightedWeekdaysChange:
              viewSettings.handleHighlightedWeekdaysChange,
            handleHighlightColorChange: viewSettings.handleHighlightColorChange,
          }}
          showNoteDialog={noteActions.showNoteDialog}
          onNoteDialogChange={noteActions.handleNoteDialogChange}
          selectedNote={noteActions.selectedNote}
          selectedNoteDate={noteActions.selectedDate}
          onNoteSubmit={handleNoteSubmit}
          onNoteDelete={noteActions.selectedNote ? handleNoteDelete : undefined}
          showNotesListDialog={dialogStates.showNotesListDialog}
          onNotesListDialogChange={dialogStates.setShowNotesListDialog}
          selectedDayNotes={dialogStates.selectedDayNotes}
          onEditNoteFromList={handleEditNoteFromList}
          onDeleteNoteFromList={handleDeleteNoteFromList}
          onAddNewNote={handleAddNewNoteFromList}
        />

        <AppFooter versionInfo={versionInfo} />
      </>
    );
  }

  // Empty state
  if (calendars.length === 0) {
    // If user is guest, show guest empty state (no create calendar option)
    if (isGuest) {
      return <GuestEmptyState />;
    }

    // Otherwise, show normal empty state with create calendar option
    return (
      <>
        <EmptyCalendarState
          onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
          showUserMenu={true}
        />
        <DialogManager
          showCalendarDialog={dialogStates.showCalendarDialog}
          onCalendarDialogChange={dialogStates.setShowCalendarDialog}
          onCreateCalendar={createCalendarHook}
          showShiftDialog={dialogStates.showShiftDialog}
          onShiftDialogChange={dialogStates.setShowShiftDialog}
          onShiftSubmit={shiftActions.handleShiftSubmit}
          selectedDate={selectedDate}
          selectedCalendar={selectedCalendar || null}
          onPresetsChange={refetchPresets}
          calendars={calendars}
          showCalendarSettingsDialog={dialogStates.showCalendarSettingsDialog}
          onCalendarSettingsDialogChange={
            dialogStates.setShowCalendarSettingsDialog
          }
          onCalendarSettingsSuccess={refetchCalendars}
          onDeleteCalendar={handleDeleteCalendar}
          onExternalSyncFromSettings={() =>
            dialogStates.setShowExternalSyncDialog(true)
          }
          showExternalSyncDialog={dialogStates.showExternalSyncDialog}
          onExternalSyncDialogChange={dialogStates.setShowExternalSyncDialog}
          syncErrorRefreshTrigger={syncLogRefreshTrigger}
          onSyncComplete={handleSyncComplete}
          showSyncNotificationDialog={dialogStates.showSyncNotificationDialog}
          onSyncNotificationDialogChange={
            dialogStates.setShowSyncNotificationDialog
          }
          onErrorsMarkedRead={fetchSyncErrorStatus}
          onSyncLogUpdate={() => setSyncLogRefreshTrigger((prev) => prev + 1)}
          showDayShiftsDialog={dialogStates.showDayShiftsDialog}
          onDayShiftsDialogChange={dialogStates.setShowDayShiftsDialog}
          selectedDayDate={dialogStates.selectedDayDate}
          selectedDayShifts={dialogStates.selectedDayShifts}
          locale={locale}
          onDeleteShiftFromDayDialog={handleDeleteShiftFromDayDialog}
          showSyncedShiftsDialog={dialogStates.showSyncedShiftsDialog}
          onSyncedShiftsDialogChange={dialogStates.setShowSyncedShiftsDialog}
          selectedSyncedShifts={dialogStates.selectedSyncedShifts}
          showViewSettingsDialog={dialogStates.showViewSettingsDialog}
          onViewSettingsDialogChange={dialogStates.setShowViewSettingsDialog}
          viewSettings={viewSettings}
          onViewSettingsChange={{
            handleShiftsPerDayChange: viewSettings.handleShiftsPerDayChange,
            handleExternalShiftsPerDayChange:
              viewSettings.handleExternalShiftsPerDayChange,
            handleShowShiftNotesChange: viewSettings.handleShowShiftNotesChange,
            handleShowFullTitlesChange: viewSettings.handleShowFullTitlesChange,
            handleShiftSortTypeChange: viewSettings.handleShiftSortTypeChange,
            handleShiftSortOrderChange: viewSettings.handleShiftSortOrderChange,
            handleCombinedSortModeChange:
              viewSettings.handleCombinedSortModeChange,
            handleHighlightWeekendsChange:
              viewSettings.handleHighlightWeekendsChange,
            handleHighlightedWeekdaysChange:
              viewSettings.handleHighlightedWeekdaysChange,
            handleHighlightColorChange: viewSettings.handleHighlightColorChange,
          }}
          showNoteDialog={noteActions.showNoteDialog}
          onNoteDialogChange={noteActions.handleNoteDialogChange}
          selectedNote={noteActions.selectedNote}
          selectedNoteDate={noteActions.selectedDate}
          onNoteSubmit={handleNoteSubmit}
          onNoteDelete={noteActions.selectedNote ? handleNoteDelete : undefined}
          showNotesListDialog={dialogStates.showNotesListDialog}
          onNotesListDialogChange={dialogStates.setShowNotesListDialog}
          selectedDayNotes={dialogStates.selectedDayNotes}
          onEditNoteFromList={handleEditNoteFromList}
          onDeleteNoteFromList={handleDeleteNoteFromList}
          onAddNewNote={handleAddNewNoteFromList}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Compare Selector Overlay */}
      <AnimatePresence>
        {showCompareSelector && (
          <CalendarCompareSheet
            calendars={calendars}
            selectedIds={selectedCompareIds}
            onToggleCalendar={handleToggleCompareCalendar}
            onStartCompare={handleStartCompare}
            onCancel={() => {
              setShowCompareSelector(false);
              setSelectedCompareIds([]);
            }}
          />
        )}
      </AnimatePresence>

      <AppHeader
        calendars={calendars}
        selectedCalendar={selectedCalendar}
        presets={presets}
        selectedPresetId={selectedPresetId}
        isConnected={isConnected}
        showMobileCalendarDialog={dialogStates.showMobileCalendarDialog}
        hasSyncErrors={hasSyncErrors}
        onSelectCalendar={setSelectedCalendar}
        onSelectPreset={setSelectedPresetId}
        onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
        onSettings={() => dialogStates.setShowCalendarSettingsDialog(true)}
        onSyncNotifications={handleSyncNotifications}
        onCompare={handleCompareClick}
        onPresetsChange={refetchPresets}
        onShiftsChange={refetchShifts}
        onStatsRefresh={() => setStatsRefreshTrigger((prev) => prev + 1)}
        onManualShiftCreation={handleManualShiftCreation}
        onMobileCalendarDialogChange={dialogStates.setShowMobileCalendarDialog}
        onViewSettingsClick={() => dialogStates.setShowViewSettingsDialog(true)}
        presetsLoading={presetsLoading}
        hidePresetHeader={viewSettings.hidePresetHeader}
        onHidePresetHeaderChange={viewSettings.handleHidePresetHeaderChange}
      />

      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
        <CalendarContent
          calendarDays={calendarDays}
          currentDate={currentDate}
          onDateChange={setCurrentDate}
          shifts={shifts}
          notes={notes}
          selectedPresetId={selectedPresetId}
          togglingDates={shiftActions.togglingDates}
          externalSyncs={externalSyncs}
          maxShiftsToShow={
            viewSettings.shiftsPerDay === null
              ? undefined
              : viewSettings.shiftsPerDay
          }
          maxExternalShiftsToShow={
            viewSettings.externalShiftsPerDay === null
              ? undefined
              : viewSettings.externalShiftsPerDay
          }
          showShiftNotes={viewSettings.showShiftNotes}
          showFullTitles={viewSettings.showFullTitles}
          shiftSortType={viewSettings.shiftSortType}
          shiftSortOrder={viewSettings.shiftSortOrder}
          combinedSortMode={viewSettings.combinedSortMode}
          highlightedWeekdays={viewSettings.highlightedWeekdays}
          highlightColor={viewSettings.highlightColor}
          selectedCalendar={selectedCalendar || null}
          statsRefreshTrigger={statsRefreshTrigger}
          locale={dateLocale}
          onDayClick={handleDayClick}
          onDayRightClick={handleDayRightClick}
          onNoteIconClick={handleNoteIconClick}
          onLongPress={handleLongPressDay}
          onShowAllShifts={handleShowAllShifts}
          onShowSyncedShifts={handleShowSyncedShifts}
          onDeleteShift={shiftActions.handleDeleteShift}
        />
      </div>

      {/* Floating Action Button */}
      {selectedCalendar && (
        <motion.div
          className="hidden sm:block fixed bottom-6 right-6 z-50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          <Button
            size="lg"
            className="h-16 w-16 rounded-full shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all"
            onClick={handleManualShiftCreation}
          >
            <Plus className="h-7 w-7" />
          </Button>
        </motion.div>
      )}

      {/* Dialogs */}
      <DialogManager
        showCalendarDialog={dialogStates.showCalendarDialog}
        onCalendarDialogChange={dialogStates.setShowCalendarDialog}
        onCreateCalendar={createCalendarHook}
        showShiftDialog={dialogStates.showShiftDialog}
        onShiftDialogChange={dialogStates.setShowShiftDialog}
        onShiftSubmit={shiftActions.handleShiftSubmit}
        selectedDate={selectedDate}
        selectedCalendar={selectedCalendar || null}
        onPresetsChange={refetchPresets}
        calendars={calendars}
        showCalendarSettingsDialog={dialogStates.showCalendarSettingsDialog}
        onCalendarSettingsDialogChange={
          dialogStates.setShowCalendarSettingsDialog
        }
        onCalendarSettingsSuccess={refetchCalendars}
        onDeleteCalendar={handleDeleteCalendar}
        onExternalSyncFromSettings={() =>
          dialogStates.setShowExternalSyncDialog(true)
        }
        showExternalSyncDialog={dialogStates.showExternalSyncDialog}
        onExternalSyncDialogChange={dialogStates.setShowExternalSyncDialog}
        syncErrorRefreshTrigger={syncLogRefreshTrigger}
        onSyncComplete={handleSyncComplete}
        showSyncNotificationDialog={dialogStates.showSyncNotificationDialog}
        onSyncNotificationDialogChange={
          dialogStates.setShowSyncNotificationDialog
        }
        onErrorsMarkedRead={fetchSyncErrorStatus}
        onSyncLogUpdate={() => setSyncLogRefreshTrigger((prev) => prev + 1)}
        showDayShiftsDialog={dialogStates.showDayShiftsDialog}
        onDayShiftsDialogChange={dialogStates.setShowDayShiftsDialog}
        selectedDayDate={dialogStates.selectedDayDate}
        selectedDayShifts={dialogStates.selectedDayShifts}
        locale={locale}
        onDeleteShiftFromDayDialog={handleDeleteShiftFromDayDialog}
        showSyncedShiftsDialog={dialogStates.showSyncedShiftsDialog}
        onSyncedShiftsDialogChange={dialogStates.setShowSyncedShiftsDialog}
        selectedSyncedShifts={dialogStates.selectedSyncedShifts}
        showViewSettingsDialog={dialogStates.showViewSettingsDialog}
        onViewSettingsDialogChange={dialogStates.setShowViewSettingsDialog}
        viewSettings={viewSettings}
        onViewSettingsChange={{
          handleShiftsPerDayChange: viewSettings.handleShiftsPerDayChange,
          handleExternalShiftsPerDayChange:
            viewSettings.handleExternalShiftsPerDayChange,
          handleShowShiftNotesChange: viewSettings.handleShowShiftNotesChange,
          handleShowFullTitlesChange: viewSettings.handleShowFullTitlesChange,
          handleShiftSortTypeChange: viewSettings.handleShiftSortTypeChange,
          handleShiftSortOrderChange: viewSettings.handleShiftSortOrderChange,
          handleCombinedSortModeChange:
            viewSettings.handleCombinedSortModeChange,
          handleHighlightWeekendsChange:
            viewSettings.handleHighlightWeekendsChange,
          handleHighlightedWeekdaysChange:
            viewSettings.handleHighlightedWeekdaysChange,
          handleHighlightColorChange: viewSettings.handleHighlightColorChange,
        }}
        showNoteDialog={noteActions.showNoteDialog}
        onNoteDialogChange={noteActions.handleNoteDialogChange}
        selectedNote={noteActions.selectedNote}
        selectedNoteDate={noteActions.selectedDate}
        onNoteSubmit={handleNoteSubmit}
        onNoteDelete={noteActions.selectedNote ? handleNoteDelete : undefined}
        showNotesListDialog={dialogStates.showNotesListDialog}
        onNotesListDialogChange={dialogStates.setShowNotesListDialog}
        selectedDayNotes={dialogStates.selectedDayNotes}
        onEditNoteFromList={handleEditNoteFromList}
        onDeleteNoteFromList={handleDeleteNoteFromList}
        onAddNewNote={handleAddNewNoteFromList}
      />

      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
