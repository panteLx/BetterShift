import { CalendarDialog } from "@/components/calendar-dialog";
import { ShiftDialog, ShiftFormData } from "@/components/shift-dialog";
import { PasswordDialog } from "@/components/password-dialog";
import { CalendarSettingsDialog } from "@/components/calendar-settings-dialog";
import { ExternalSyncManageDialog } from "@/components/external-sync-manage-dialog";
import { SyncNotificationDialog } from "@/components/sync-notification-dialog";
import { DayShiftsDialog } from "@/components/day-shifts-dialog";
import { SyncedShiftsDialog } from "@/components/synced-shifts-dialog";
import { ViewSettingsDialog } from "@/components/view-settings-dialog";
import { NoteDialog } from "@/components/note-dialog";
import { CalendarWithCount, ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";

interface DialogManagerProps {
  // Calendar Dialog
  showCalendarDialog: boolean;
  onCalendarDialogChange: (open: boolean) => void;
  onCreateCalendar: (
    name: string,
    color: string,
    password?: string
  ) => Promise<void>;

  // Shift Dialog
  showShiftDialog: boolean;
  onShiftDialogChange: (open: boolean) => void;
  onShiftSubmit: (data: ShiftFormData) => void;
  selectedDate?: Date;
  selectedCalendar: string | null;
  onPresetsChange: () => void;

  // Password Dialog
  showPasswordDialog: boolean;
  onPasswordDialogChange: (open: boolean) => void;
  calendars: CalendarWithCount[];
  onPasswordSuccess: (password: string) => void;

  // Calendar Settings Dialog
  showCalendarSettingsDialog: boolean;
  onCalendarSettingsDialogChange: (open: boolean) => void;
  onCalendarSettingsSuccess: () => void;
  onDeleteCalendar: (password?: string) => void;

  // External Sync Dialog
  showExternalSyncDialog: boolean;
  onExternalSyncDialogChange: (open: boolean) => void;
  syncErrorRefreshTrigger: number;
  onSyncComplete: () => void;

  // Sync Notification Dialog
  showSyncNotificationDialog: boolean;
  onSyncNotificationDialogChange: (open: boolean) => void;
  onErrorsMarkedRead: () => void;
  onSyncLogUpdate: () => void;

  // Day Shifts Dialog
  showDayShiftsDialog: boolean;
  onDayShiftsDialogChange: (open: boolean) => void;
  selectedDayDate: Date | null;
  selectedDayShifts: ShiftWithCalendar[];
  locale: string;
  onDeleteShiftFromDayDialog: (id: string) => void;

  // Synced Shifts Dialog
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
  };

  // Note Dialog
  showNoteDialog: boolean;
  onNoteDialogChange: (open: boolean) => void;
  selectedNote: CalendarNote | undefined;
  selectedNoteDate?: Date;
  onNoteSubmit: (text: string) => void;
  onNoteDelete?: () => void;
}

export function DialogManager(props: DialogManagerProps) {
  return (
    <>
      <CalendarDialog
        open={props.showCalendarDialog}
        onOpenChange={props.onCalendarDialogChange}
        onSubmit={props.onCreateCalendar}
      />

      <ShiftDialog
        open={props.showShiftDialog}
        onOpenChange={props.onShiftDialogChange}
        onSubmit={props.onShiftSubmit}
        selectedDate={props.selectedDate}
        onPresetsChange={props.onPresetsChange}
        calendarId={props.selectedCalendar || undefined}
      />

      {props.selectedCalendar && (
        <>
          <PasswordDialog
            open={props.showPasswordDialog}
            onOpenChange={props.onPasswordDialogChange}
            calendarId={props.selectedCalendar}
            calendarName={
              props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.name || ""
            }
            onSuccess={props.onPasswordSuccess}
          />

          <CalendarSettingsDialog
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
            hasPassword={
              !!props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.passwordHash
            }
            isLocked={
              props.calendars.find((c) => c.id === props.selectedCalendar)
                ?.isLocked || false
            }
            onSuccess={props.onCalendarSettingsSuccess}
            onDelete={props.onDeleteCalendar}
          />

          <ExternalSyncManageDialog
            open={props.showExternalSyncDialog}
            onOpenChange={props.onExternalSyncDialogChange}
            calendarId={props.selectedCalendar}
            syncErrorRefreshTrigger={props.syncErrorRefreshTrigger}
            onSyncComplete={props.onSyncComplete}
          />

          <SyncNotificationDialog
            open={props.showSyncNotificationDialog}
            onOpenChange={props.onSyncNotificationDialogChange}
            calendarId={props.selectedCalendar}
            onErrorsMarkedRead={props.onErrorsMarkedRead}
            onSyncLogUpdate={props.onSyncLogUpdate}
            syncLogRefreshTrigger={props.syncErrorRefreshTrigger}
          />
        </>
      )}

      <DayShiftsDialog
        open={props.showDayShiftsDialog}
        onOpenChange={props.onDayShiftsDialogChange}
        date={props.selectedDayDate}
        shifts={props.selectedDayShifts}
        locale={props.locale}
        onDeleteShift={props.onDeleteShiftFromDayDialog}
      />

      <SyncedShiftsDialog
        open={props.showSyncedShiftsDialog}
        onOpenChange={props.onSyncedShiftsDialogChange}
        date={props.selectedDayDate}
        shifts={props.selectedSyncedShifts}
      />

      <ViewSettingsDialog
        open={props.showViewSettingsDialog}
        onOpenChange={props.onViewSettingsDialogChange}
        shiftsPerDay={props.viewSettings.shiftsPerDay}
        externalShiftsPerDay={props.viewSettings.externalShiftsPerDay}
        showShiftNotes={props.viewSettings.showShiftNotes}
        showFullTitles={props.viewSettings.showFullTitles}
        shiftSortType={props.viewSettings.shiftSortType}
        shiftSortOrder={props.viewSettings.shiftSortOrder}
        combinedSortMode={props.viewSettings.combinedSortMode}
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
      />

      <NoteDialog
        open={props.showNoteDialog}
        onOpenChange={props.onNoteDialogChange}
        onSubmit={props.onNoteSubmit}
        onDelete={props.onNoteDelete}
        selectedDate={props.selectedNoteDate}
        note={props.selectedNote}
      />
    </>
  );
}
