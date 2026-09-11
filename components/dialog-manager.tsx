import { CalendarSheet } from "@/components/calendar-sheet";
import { ShiftSheet, ShiftFormData } from "@/components/shift-sheet";
import { SettingsDialog, SettingsSection } from "@/components/settings-dialog";
import { SyncNotificationDialog } from "@/components/sync-notification-dialog";
import { ShiftsOverviewDialog } from "@/components/shifts-overview-dialog";
import { ViewSettingsSheet, ViewSettingsState } from "@/components/view-settings-sheet";
import { NoteSheet } from "@/components/note-sheet";
import { NotesListDialog } from "@/components/notes-list-dialog";
import { PresetManageSheet } from "@/components/preset-manage-sheet";
import { MonthShiftsDialog, MonthStatsDialog } from "@/components/month-dialogs";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ShiftPreset } from "@/lib/db/schema";

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
  editingShift?: ShiftWithCalendar;

  // Unified settings (calendar sections incl. the calendar's own view)
  showSettingsDialog: boolean;
  onSettingsDialogChange: (open: boolean) => void;
  settingsSection?: SettingsSection;
  onDeleteCalendar: () => void;
  onSyncComplete: () => void;
  viewSettings: ViewSettingsState;

  // Personal view ("Meine Ansicht") from the user menu, header and compare mode
  showViewSettingsDialog: boolean;
  onViewSettingsDialogChange: (open: boolean) => void;

  // Sync Notification Dialog
  showSyncNotificationDialog: boolean;
  onSyncNotificationDialogChange: (open: boolean) => void;

  // Shifts Overview Dialog
  showDayShiftsDialog: boolean;
  onDayShiftsDialogChange: (open: boolean) => void;
  selectedDayDate: Date | null;
  selectedDayShifts: ShiftWithCalendar[];
  onDeleteShiftFromDayDialog?: (id: string) => void;
  onEditShiftFromDayDialog?: (shift: ShiftWithCalendar) => void;
  /** Calendar the note dialogs act on when it differs from the selected one (compare mode) */
  noteCalendarId?: string;

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

  // Month summary dialogs opened from the day inspector
  currentDate: Date;
  shifts: ShiftWithCalendar[];
  canEditShifts: boolean;
  showMonthStatsDialog: boolean;
  onMonthStatsDialogChange: (open: boolean) => void;
  showMonthShiftsDialog: boolean;
  onMonthShiftsDialogChange: (open: boolean) => void;
  onDeleteShift: (shift: ShiftWithCalendar) => void;

  // Preset management opened from the stamp dock
  presets: ShiftPreset[];
  showPresetManageDialog: boolean;
  onPresetManageDialogChange: (open: boolean) => void;
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
        shift={props.editingShift}
        onPresetsChange={props.onPresetsChange}
        calendarId={props.selectedCalendar || undefined}
      />

      <SettingsDialog
        key={`${props.selectedCalendar}-${props.settingsSection ?? ""}`}
        open={props.showSettingsDialog}
        onOpenChange={props.onSettingsDialogChange}
        calendarId={props.selectedCalendar}
        initialSection={props.settingsSection}
        viewSettings={props.viewSettings}
        onDeleteCalendar={props.onDeleteCalendar}
        onSyncComplete={props.onSyncComplete}
      />

      <ViewSettingsSheet
        open={props.showViewSettingsDialog}
        onOpenChange={props.onViewSettingsDialogChange}
        settings={props.viewSettings}
        calendarId={props.selectedCalendar}
      />

      {props.selectedCalendar && (
        <SyncNotificationDialog
          open={props.showSyncNotificationDialog}
          onOpenChange={props.onSyncNotificationDialogChange}
          calendarId={props.selectedCalendar}
        />
      )}

      <ShiftsOverviewDialog
        open={props.showDayShiftsDialog}
        onOpenChange={props.onDayShiftsDialogChange}
        date={props.selectedDayDate}
        shifts={props.selectedDayShifts}
        onDeleteShift={props.onDeleteShiftFromDayDialog}
        onEditShift={props.onEditShiftFromDayDialog}
        canEdit={props.canEditShifts}
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
          calendarId={props.noteCalendarId ?? (props.selectedCalendar || undefined)}
        />
      )}
      <MonthStatsDialog
        open={props.showMonthStatsDialog}
        onOpenChange={props.onMonthStatsDialogChange}
        currentDate={props.currentDate}
        calendarId={props.selectedCalendar || undefined}
      />
      <MonthShiftsDialog
        open={props.showMonthShiftsDialog}
        onOpenChange={props.onMonthShiftsDialogChange}
        currentDate={props.currentDate}
        shifts={props.shifts}
        canEdit={props.canEditShifts}
        onEditShift={(shift) => props.onEditShiftFromDayDialog?.(shift)}
        onDeleteShift={props.onDeleteShift}
      />
      {props.selectedCalendar && (
        <PresetManageSheet
          open={props.showPresetManageDialog}
          onOpenChange={props.onPresetManageDialogChange}
          calendarId={props.selectedCalendar}
          presets={props.presets}
          onPresetsChange={props.onPresetsChange}
        />
      )}
      <NoteSheet
        open={props.showNoteDialog}
        onOpenChange={props.onNoteDialogChange}
        onSubmit={props.onNoteSubmit}
        onDelete={props.onNoteDelete}
        selectedDate={props.selectedNoteDate}
        note={props.selectedNote}
        calendarId={props.noteCalendarId ?? (props.selectedCalendar || undefined)}
      />
    </>
  );
}
