"use client";

import { useMemo, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { formatLongDate } from "@/lib/date-utils";
import { Info, Trash2, TriangleAlert } from "lucide-react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ChoiceChips, ColorSwatches, Field, InfoNote } from "@/components/form-kit";
import { SegmentedControl } from "@/components/segmented-control";
import { StatusBanner } from "@/components/status-banner";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { CalendarNote } from "@/lib/db/schema";
import { DEFAULT_COLOR } from "@/lib/constants";
import { cn } from "@/lib/utils";

type NoteType = "note" | "event";
/** UI view of the stored patterns; "years" is stored as custom-months × 12. */
type Repeat = "none" | "weeks" | "months" | "years";

interface NoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    note: string,
    type: NoteType,
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => void;
  onDelete?: () => void;
  selectedDate?: Date;
  note?: CalendarNote;
  calendarId?: string;
  readOnly?: boolean;
}

interface NoteFormState {
  text: string;
  type: NoteType;
  color: string;
  repeat: Repeat;
  interval: number;
}

const EMPTY_STATE: NoteFormState = {
  text: "",
  type: "note",
  color: DEFAULT_COLOR,
  repeat: "none",
  interval: 1,
};

export function parseRecurrence(
  pattern: string | null | undefined,
  interval: number | null | undefined
): { repeat: Repeat; interval: number } {
  const count = interval && interval > 0 ? interval : 1;
  if (pattern === "custom-weeks") return { repeat: "weeks", interval: count };
  if (pattern === "custom-months") {
    return count % 12 === 0
      ? { repeat: "years", interval: count / 12 }
      : { repeat: "months", interval: count };
  }
  return { repeat: "none", interval: 1 };
}

function stateFromNote(note: CalendarNote): NoteFormState {
  return {
    text: note.note || "",
    type: (note.type as NoteType) || "note",
    color: note.color || DEFAULT_COLOR,
    ...parseRecurrence(note.recurringPattern, note.recurringInterval),
  };
}

export function NoteSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  selectedDate,
  note,
  calendarId,
  readOnly = false,
}: NoteSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const permission = useCalendarPermission(calendarId);
  const initial = useMemo(
    () => (open && note ? stateFromNote(note) : EMPTY_STATE),
    [open, note]
  );
  const [form, setForm] = useState<NoteFormState>(initial);
  const [source, setSource] = useState({ open, note });
  const [isSaving, setIsSaving] = useState(false);

  // Reset whenever the sheet opens, closes or switches notes
  if (source.open !== open || source.note !== note) {
    setSource({ open, note });
    setForm(initial);
  }

  const isReadOnly = readOnly || !permission.canEdit;
  const isEvent = form.type === "event";
  const update = (patch: Partial<NoteFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const hasChanges = () => {
    if (note) {
      return (
        form.text !== initial.text ||
        form.type !== initial.type ||
        form.color !== initial.color ||
        form.repeat !== initial.repeat ||
        form.interval !== initial.interval
      );
    }
    return form.text.trim() !== "";
  };

  const handleSave = async () => {
    if (!form.text.trim() || isSaving) return;

    setIsSaving(true);
    try {
      const pattern =
        form.repeat === "weeks"
          ? "custom-weeks"
          : form.repeat === "none"
            ? "none"
            : "custom-months";
      const interval = form.repeat === "years" ? form.interval * 12 : form.interval;

      onSubmit(
        form.text,
        form.type,
        isEvent ? form.color : undefined,
        isEvent ? pattern : undefined,
        isEvent && form.repeat !== "none" ? interval : undefined
      );
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onOpenChange(false);
    }
  };

  const formattedDate = selectedDate
    ? formatLongDate(selectedDate, locale, { year: true })
    : "";

  const unitLabel = {
    none: t("noteSheet.intervalInactive"),
    weeks: t("noteSheet.unitWeeks", { count: form.interval }),
    months: t("noteSheet.unitMonths", { count: form.interval }),
    years: t("noteSheet.unitYears", { count: form.interval }),
  }[form.repeat];

  const footer = (
    <>
      {note && onDelete && !isReadOnly && (
        <Button
          type="button"
          variant="outline"
          onClick={handleDelete}
          disabled={isSaving}
          className="h-10 border-danger-line font-semibold text-danger hover:bg-danger-soft hover:text-danger"
        >
          <Trash2 className="size-4" />
          {t("common.delete")}
        </Button>
      )}
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSaving}
        className="h-10 flex-1 font-semibold"
      >
        {isReadOnly ? t("common.close") : t("common.cancel")}
      </Button>
      {!isReadOnly && (
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !form.text.trim() || (!!note && !hasChanges())}
          className="h-10 flex-1 font-semibold"
        >
          {isSaving
            ? t("common.saving")
            : note
              ? t("common.save")
              : t("noteSheet.createAction")}
        </Button>
      )}
    </>
  );

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={note ? t("noteSheet.editTitle") : t("noteSheet.createTitle")}
      description={formattedDate}
      footer={footer}
      hasUnsavedChanges={hasChanges()}
    >
      <div className="flex flex-col gap-4">
        {isReadOnly && <ReadOnlyBanner message={t("guest.cannotEdit")} />}

        {note && isEvent && note.recurringPattern && note.recurringPattern !== "none" && (
          <StatusBanner tone="warning" icon={TriangleAlert}>
            {t("note.recurringEditWarning")}
          </StatusBanner>
        )}

        <SegmentedControl<NoteType>
          label={t("note.type")}
          size="lg"
          value={form.type}
          onChange={(type) => !isReadOnly && update({ type })}
          options={[
            { value: "event", label: t("noteSheet.typeEvent") },
            { value: "note", label: t("noteSheet.typeNote") },
          ]}
        />

        <InfoNote icon={Info}>{t("noteSheet.typeHint")}</InfoNote>

        <Field label={t("noteSheet.text")} htmlFor="note-text">
          <Textarea
            id="note-text"
            value={form.text}
            onChange={(e) => update({ text: e.target.value })}
            placeholder={isEvent ? t("note.eventPlaceholder") : t("note.placeholder")}
            rows={3}
            className="min-h-[74px] resize-none rounded-[9px] px-3 py-2.5 text-[14px] md:text-[14px]"
            disabled={isReadOnly}
          />
        </Field>

        {isEvent && (
          <>
            <Field label={t("note.eventColor")}>
              <ColorSwatches
                value={form.color}
                onChange={(color) => update({ color })}
                allowCustom
                disabled={isReadOnly}
              />
            </Field>

            <Field label={t("noteSheet.repeat")}>
              <ChoiceChips<Repeat>
                label={t("noteSheet.repeat")}
                value={form.repeat}
                onChange={(repeat) => update({ repeat })}
                disabled={isReadOnly}
                options={[
                  { value: "none", label: t("noteSheet.repeatNone") },
                  { value: "weeks", label: t("noteSheet.repeatWeekly") },
                  { value: "months", label: t("noteSheet.repeatMonthly") },
                  { value: "years", label: t("noteSheet.repeatYearly") },
                ]}
              />
              <div
                className={cn(
                  "flex items-center gap-2.5 text-[13px] text-fg-body",
                  form.repeat === "none" && "opacity-45"
                )}
              >
                <span>{t("note.every")}</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={52}
                  aria-label={t("note.customInterval")}
                  value={form.interval}
                  onChange={(e) => update({ interval: Math.max(1, parseInt(e.target.value) || 1) })}
                  disabled={isReadOnly || form.repeat === "none"}
                  className="h-[34px] w-[58px] rounded-lg px-2 text-center font-mono text-[14px] md:text-[14px]"
                />
                <span>{unitLabel}</span>
              </div>
            </Field>
          </>
        )}
      </div>
    </BaseSheet>
  );
}
