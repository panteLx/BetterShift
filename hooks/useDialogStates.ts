import { useState } from "react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";

export function useDialogStates() {
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showCalendarSettingsDialog, setShowCalendarSettingsDialog] =
    useState(false);
  const [showSyncNotificationDialog, setShowSyncNotificationDialog] =
    useState(false);
  const [showDayShiftsDialog, setShowDayShiftsDialog] = useState(false);
  const [showViewSettingsDialog, setShowViewSettingsDialog] = useState(false);
  const [showNotesListDialog, setShowNotesListDialog] = useState(false);
  const [showMonthStatsDialog, setShowMonthStatsDialog] = useState(false);
  const [showMonthShiftsDialog, setShowMonthShiftsDialog] = useState(false);
  const [showPresetManageDialog, setShowPresetManageDialog] = useState(false);

  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState<
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
    showSyncNotificationDialog,
    setShowSyncNotificationDialog,
    showDayShiftsDialog,
    setShowDayShiftsDialog,
    showViewSettingsDialog,
    setShowViewSettingsDialog,
    showNotesListDialog,
    setShowNotesListDialog,
    showMonthStatsDialog,
    setShowMonthStatsDialog,
    showMonthShiftsDialog,
    setShowMonthShiftsDialog,
    showPresetManageDialog,
    setShowPresetManageDialog,
    selectedDayDate,
    setSelectedDayDate,
    selectedDayShifts,
    setSelectedDayShifts,
    selectedDayNotes,
    setSelectedDayNotes,
  };
}
