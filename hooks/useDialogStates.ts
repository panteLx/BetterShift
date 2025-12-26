import { useState } from "react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";

export function useDialogStates() {
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showCalendarSettingsDialog, setShowCalendarSettingsDialog] =
    useState(false);
  const [showMobileCalendarDialog, setShowMobileCalendarDialog] =
    useState(false);
  const [showExternalSyncDialog, setShowExternalSyncDialog] = useState(false);
  const [showSyncNotificationDialog, setShowSyncNotificationDialog] =
    useState(false);
  const [showDayShiftsDialog, setShowDayShiftsDialog] = useState(false);
  const [showSyncedShiftsDialog, setShowSyncedShiftsDialog] = useState(false);
  const [showViewSettingsDialog, setShowViewSettingsDialog] = useState(false);
  const [showNotesListDialog, setShowNotesListDialog] = useState(false);

  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState<
    ShiftWithCalendar[]
  >([]);
  const [selectedSyncedShifts, setSelectedSyncedShifts] = useState<
    ShiftWithCalendar[]
  >([]);
  const [selectedDayNotes, setSelectedDayNotes] = useState<CalendarNote[]>([]);

  return {
    showCalendarDialog,
    setShowCalendarDialog,
    showShiftDialog,
    setShowShiftDialog,
    showCalendarSettingsDialog,
    setShowCalendarSettingsDialog,
    showMobileCalendarDialog,
    setShowMobileCalendarDialog,
    showExternalSyncDialog,
    setShowExternalSyncDialog,
    showSyncNotificationDialog,
    setShowSyncNotificationDialog,
    showDayShiftsDialog,
    setShowDayShiftsDialog,
    showSyncedShiftsDialog,
    setShowSyncedShiftsDialog,
    showViewSettingsDialog,
    setShowViewSettingsDialog,
    showNotesListDialog,
    setShowNotesListDialog,
    selectedDayDate,
    setSelectedDayDate,
    selectedDayShifts,
    setSelectedDayShifts,
    selectedSyncedShifts,
    setSelectedSyncedShifts,
    selectedDayNotes,
    setSelectedDayNotes,
  };
}
