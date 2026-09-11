"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatLongDate } from "@/lib/date-utils";
import { CalendarClock, Keyboard, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { CalendarNote } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { PanelDialog } from "@/components/panel-dialog";
import { InfoNote, ListRow, Pill, RowIconButton } from "@/components/form-kit";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { parseRecurrence } from "@/components/note-sheet";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { shiftVars } from "@/lib/shift-display";

interface NotesListDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date;
  notes: CalendarNote[];
  onEditNote: (note: CalendarNote) => void;
  onDeleteNote: (noteId: string) => void;
  onAddNew: () => void;
  calendarId?: string;
  readOnly?: boolean;
}

// Plain notes carry no color of their own
const NOTE_COLOR = "#d97706";

function NoteRow({
  note,
  editable,
  onEdit,
  onDelete,
}: {
  note: CalendarNote;
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations();
  const isEvent = note.type === "event";
  const Icon = isEvent ? CalendarClock : StickyNote;
  const [title, ...rest] = note.note.trim().split("\n");
  const subtitle = rest.join(" ").trim();
  const color = shiftVars(isEvent ? note.color : NOTE_COLOR);

  const { repeat, interval } = parseRecurrence(note.recurringPattern, note.recurringInterval);
  const recurrence = !isEvent
    ? null
    : repeat === "weeks"
      ? t("noteSheet.recurrenceWeeks", { count: interval })
      : repeat === "months"
        ? t("noteSheet.recurrenceMonths", { count: interval })
        : repeat === "years"
          ? t("noteSheet.recurrenceYears", { count: interval })
          : null;

  const pills = (
    <>
      {recurrence && <Pill className="text-[11px]">{recurrence}</Pill>}
      <span
        className="shift-chip whitespace-nowrap rounded-full px-[7px] py-0.5 text-[11px] font-semibold"
        style={color}
      >
        {isEvent ? t("noteSheet.typeEvent") : t("noteSheet.typeNote")}
      </span>
    </>
  );

  return (
    <ListRow className="gap-[11px] px-3 py-[11px]">
      <span className="shift-rail h-[30px] w-[3px] shrink-0 rounded-full" style={color} />
      <Icon className="shift-text size-4 shrink-0" style={color} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold text-fg-strong">{title}</div>
        {subtitle && (
          <div className="mt-0.5 truncate text-[12px] text-fg-tertiary">{subtitle}</div>
        )}
        {/* Narrow rows move the pills under the text so the title keeps its room */}
        <div className="mt-1.5 flex flex-wrap gap-1.5 sm:hidden">{pills}</div>
      </div>
      <div className="hidden shrink-0 items-center gap-1.5 sm:flex">{pills}</div>
      {editable && (
        <div className="-mr-1.5 flex shrink-0 items-center">
          <RowIconButton icon={Pencil} label={t("noteSheet.editTitle")} onClick={onEdit} />
          <RowIconButton icon={Trash2} label={t("common.delete")} onClick={onDelete} tone="danger" />
        </div>
      )}
    </ListRow>
  );
}

export function NotesListDialog({
  open,
  onOpenChange,
  date,
  notes,
  onEditNote,
  onDeleteNote,
  onAddNew,
  calendarId,
  readOnly = false,
}: NotesListDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const permission = useCalendarPermission(calendarId);
  const isReadOnly = readOnly || !permission.canEdit;

  const formattedDate = formatLongDate(date, locale, { year: true });

  // Events first, then plain notes
  const entries = [
    ...notes.filter((n) => n.type === "event"),
    ...notes.filter((n) => n.type !== "event"),
  ];

  const handleAdd = () => {
    onOpenChange(false);
    onAddNew();
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("noteSheet.listTitle")}
      description={`${formattedDate} · ${t("noteSheet.entryCount", { count: notes.length })}`}
      width="md"
      bodyClassName="flex flex-col gap-[9px] py-4"
      footer={
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(false)}
          className="h-10 flex-1 font-semibold"
        >
          {t("common.close")}
        </Button>
      }
    >
      {isReadOnly && <ReadOnlyBanner message={t("guest.cannotEdit")} />}

      {entries.length === 0 && (
        <p className="py-6 text-center text-[13px] text-fg-tertiary">{t("note.noEntries")}</p>
      )}

      {entries.map((note) => (
        <NoteRow
          key={note.id}
          note={note}
          editable={!isReadOnly}
          onEdit={() => onEditNote(note)}
          onDelete={() => onDeleteNote(note.id)}
        />
      ))}

      {!isReadOnly && (
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-control p-[11px] text-[13.5px] font-medium text-fg-secondary transition-colors hover:bg-surface-panel"
        >
          <Plus className="size-4" />
          {entries.length > 0 ? t("noteSheet.addAnother") : t("noteSheet.createAction")}
        </button>
      )}

      <InfoNote icon={Keyboard} className="mt-2">
        {t("noteSheet.shortcutHint")}
      </InfoNote>
    </PanelDialog>
  );
}
