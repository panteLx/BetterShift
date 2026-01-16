import { CalendarSheet } from "@/components/calendar-sheet";
import { ShiftSheet, ShiftFormData } from "@/components/shift-sheet";
import { CalendarSettingsSheet } from "@/components/calendar-settings-sheet";
import { ExternalSyncManageSheet } from "@/components/external-sync-manage-sheet";
import { SyncNotificationDialog } from "@/components/sync-notification-dialog";
import { ShiftsOverviewDialog } from "@/components/shifts-overview-dialog";
import { ViewSettingsSheet } from "@/components/view-settings-sheet";
import { NoteSheet } from "@/components/note-sheet";
import { NotesListDialog } from "@/components/notes-list-dialog";
import { CalendarWithCount, ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";

interface DialogManagerProps {
  // Calendar Dialog
  showCalendarDialog: boolean;
  onCalendarDialogChange: (open: boolean) => void;
  onCreateCalendar: (name: string, color: string) => Promise<void>;

  // Shift Dialog
  showShiftDialog: boolean;
  onShiftDialogChange: (open: boolean) => void;
  onShiftSubmit: (data: ShiftFormData) => void;
  selectedDate?: Date;
  selectedCalendar: string | null;
  onPresetsChange?: () => void;
  calendars: CalendarWithCount[];

  // Calendar Settings Dialog
  showCalendarSettingsDialog: boolean;
  onCalendarSettingsDialogChange: (open: boolean) => void;
  onCalendarSettingsSuccess: () => void;
  onDeleteCalendar: () => void;
  onExternalSyncFromSettings?: () => void;

  // External Sync Sheet
  showExternalSyncDialog: boolean;
  onExternalSyncDialogChange: (open: boolean) => void;
  onSyncComplete: () => void;

  // Sync Notification Dialog
  showSyncNotificationDialog: boolean;
  onSyncNotificationDialogChange: (open: boolean) => void;

  // Shifts Overview Dialog (for day shifts and synced shifts)
  showDayShiftsDialog: boolean;
  onDayShiftsDialogChange: (open: boolean) => void;
  selectedDayDate: Date | null;
  selectedDayShifts: ShiftWithCalendar[];
  locale: string;
  onDeleteShiftFromDayDialog: (id: string) => void;

  // Synced Shifts Overview
  showSyncedShiftsDialog: boolean;
  onSyncedShiftsDialogChange: (open: boolean) => void;
  selectedSyncedShifts: ShiftWithCalendar[];

  // View Settings Dialog
  showViewSettingsDialog: boolean;
  onViewSettingsDialogChange: (open: boolean) => void;
  viewSettings: {
    shiftsPerDay: number | null;
    externalShiftsPerDay: number | null;
    showShiftNotes: boolean;
    showFullTitles: boolean;
    shiftSortType: "startTime" | "createdAt" | "title";
    shiftSortOrder: "asc" | "desc";
    combinedSortMode: boolean;
    highlightWeekends: boolean;
    highlightedWeekdays: number[];
    highlightColor: string;
  };
  onViewSettingsChange: {
    handleShiftsPerDayChange: (count: number | null) => void;
    handleExternalShiftsPerDayChange: (count: number | null) => void;
    handleShowShiftNotesChange: (show: boolean) => void;
    handleShowFullTitlesChange: (show: boolean) => void;
    handleShiftSortTypeChange: (
      type: "startTime" | "createdAt" | "title"
    ) => void;
    handleShiftSortOrderChange: (order: "asc" | "desc") => void;
    handleCombinedSortModeChange: (combined: boolean) => void;
    handleHighlightWeekendsChange: (highlight: boolean) => void;
    handleHighlightedWeekdaysChange: (days: number[]) => void;
    handleHighlightColorChange: (color: string) => void;
  };

  // Note Dialog
  showNoteDialog: boolean;
  onNoteDialogChange: (open: boolean) => void;
  selectedNote: CalendarNote | undefined;
  selectedNoteDate?: Date;
  onNoteSubmit: (
    note: string,
    type: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => void;
  onNoteDelete?: () => void;

  // Notes List Dialog
  showNotesListDialog: boolean;
  onNotesListDialogChange: (open: boolean) => void;
  selectedDayNotes: CalendarNote[];
  onEditNoteFromList: (note: CalendarNote) => void;
  onDeleteNoteFromList: (noteId: string) => void;
  onAddNewNote: () => void;
}

export function DialogManager(props: DialogManagerProps) {
  return (
    <>
      <CalendarSheet
        open={props.showCalendarDialog}
        onOpenChange={props.onCalendarDialogChange}
        onSubmit={props.onCreateCalendar}
      />

      <ShiftSheet
        open={props.showShiftDialog}
        onOpenChange={props.onShiftDialogChange}
        onSubmit={props.onShiftSubmit}
        selectedDate={props.selectedDate}
        onPresetsChange={props.onPresetsChange}
        calendarId={props.selectedCalendar || undefined}
      />

      {props.selectedCalendar && (
        <>
          <CalendarSettingsSheet
            key={`settings-${props.selectedCalendar}-${props.showCalendarSettingsDialog}`}
            open={props.showCalendarSettingsDialog}
            onOpenChange={props.onCalendarSettingsDialogChange}
            calendarId={props.selectedCalendar}
            calendarName={
              props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.name || ""
            }
            calendarColor={
              props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.color || "#3b82f6"
            }
            calendarGuestPermission={
              props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.guestPermission || "none"
            }
            onSuccess={props.onCalendarSettingsSuccess}
            onDelete={props.onDeleteCalendar}
            onExternalSync={props.onExternalSyncFromSettings}
            availableCalendars={props.calendars}
          />

          <ExternalSyncManageSheet
            open={props.showExternalSyncDialog}
            onOpenChange={props.onExternalSyncDialogChange}
            calendarId={props.selectedCalendar}
            onSyncComplete={props.onSyncComplete}
          />

          <SyncNotificationDialog
            open={props.showSyncNotificationDialog}
            onOpenChange={props.onSyncNotificationDialogChange}
            calendarId={props.selectedCalendar}
          />
        </>
      )}

      <ShiftsOverviewDialog
        open={props.showDayShiftsDialog}
        onOpenChange={props.onDayShiftsDialogChange}
        date={props.selectedDayDate}
        shifts={props.selectedDayShifts}
        onDeleteShift={props.onDeleteShiftFromDayDialog}
      />

      <ShiftsOverviewDialog
        open={props.showSyncedShiftsDialog}
        onOpenChange={props.onSyncedShiftsDialogChange}
        date={props.selectedDayDate}
        shifts={props.selectedSyncedShifts}
      />

      <ViewSettingsSheet
        open={props.showViewSettingsDialog}
        onOpenChange={props.onViewSettingsDialogChange}
        shiftsPerDay={props.viewSettings.shiftsPerDay}
        externalShiftsPerDay={props.viewSettings.externalShiftsPerDay}
        showShiftNotes={props.viewSettings.showShiftNotes}
        showFullTitles={props.viewSettings.showFullTitles}
        shiftSortType={props.viewSettings.shiftSortType}
        shiftSortOrder={props.viewSettings.shiftSortOrder}
        combinedSortMode={props.viewSettings.combinedSortMode}
        highlightWeekends={props.viewSettings.highlightWeekends}
        highlightedWeekdays={props.viewSettings.highlightedWeekdays}
        highlightColor={props.viewSettings.highlightColor}
        onShiftsPerDayChange={
          props.onViewSettingsChange.handleShiftsPerDayChange
        }
        onExternalShiftsPerDayChange={
          props.onViewSettingsChange.handleExternalShiftsPerDayChange
        }
        onShowShiftNotesChange={
          props.onViewSettingsChange.handleShowShiftNotesChange
        }
        onShowFullTitlesChange={
          props.onViewSettingsChange.handleShowFullTitlesChange
        }
        onShiftSortTypeChange={
          props.onViewSettingsChange.handleShiftSortTypeChange
        }
        onShiftSortOrderChange={
          props.onViewSettingsChange.handleShiftSortOrderChange
        }
        onCombinedSortModeChange={
          props.onViewSettingsChange.handleCombinedSortModeChange
        }
        onHighlightWeekendsChange={
          props.onViewSettingsChange.handleHighlightWeekendsChange
        }
        onHighlightedWeekdaysChange={
          props.onViewSettingsChange.handleHighlightedWeekdaysChange
        }
        onHighlightColorChange={
          props.onViewSettingsChange.handleHighlightColorChange
        }
      />

      {props.selectedDayDate && (
        <NotesListDialog
          open={props.showNotesListDialog}
          onOpenChange={props.onNotesListDialogChange}
          date={props.selectedDayDate}
          notes={props.selectedDayNotes}
          onEditNote={props.onEditNoteFromList}
          onDeleteNote={props.onDeleteNoteFromList}
          onAddNew={props.onAddNewNote}
          calendarId={props.selectedCalendar || undefined}
        />
      )}
      <NoteSheet
        open={props.showNoteDialog}
        onOpenChange={props.onNoteDialogChange}
        onSubmit={props.onNoteSubmit}
        onDelete={props.onNoteDelete}
        selectedDate={props.selectedNoteDate}
        note={props.selectedNote}
        calendarId={props.selectedCalendar || undefined}
      />
    </>
  );
}
