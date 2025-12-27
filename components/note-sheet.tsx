"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ColorPicker } from "@/components/ui/color-picker";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { CalendarNote } from "@/lib/db/schema";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { PRESET_COLORS } from "@/lib/constants";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface NoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    note: string,
    type: "note" | "event",
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
  const dateLocale = getDateLocale(locale);
  const permission = useCalendarPermission(calendarId);
  const [noteText, setNoteText] = useState("");
  const [type, setType] = useState<"note" | "event">("note");
  const [color, setColor] = useState<string>("#3b82f6");
  const [recurringPattern, setRecurringPattern] = useState<string>("none");
  const [recurringInterval, setRecurringInterval] = useState<number>(1);
  const [recurringUnit, setRecurringUnit] = useState<string>("months");
  const [isSaving, setIsSaving] = useState(false);

  // Determine if sheet should be in read-only mode
  const isReadOnly = readOnly || !permission.canEdit;
  const initialStateRef = useRef<{
    text: string;
    type: "note" | "event";
    color: string;
    recurringPattern: string;
    recurringInterval: number;
    recurringUnit: string;
  }>({
    text: "",
    type: "note",
    color: "#3b82f6",
    recurringPattern: "none",
    recurringInterval: 1,
    recurringUnit: "months",
  });

  // Reset state when dialog opens/closes or note changes
  useEffect(() => {
    if (open) {
      const initialText = note?.note || "";
      const initialType = (note?.type as "note" | "event") || "note";
      const initialColor = note?.color || "#3b82f6";

      // Set recurring pattern from note
      const initialPattern = note?.recurringPattern || "none";
      const initialInterval = note?.recurringInterval || 1;

      // Extract unit from pattern: "custom-weeks" or "custom-months"
      let displayPattern = initialPattern;
      let initialUnit = "months";

      if (initialPattern?.startsWith("custom-")) {
        displayPattern = "custom";
        initialUnit = initialPattern.split("-")[1] || "months";
      }

      setNoteText(initialText);
      setType(initialType);
      setColor(initialColor);
      setRecurringPattern(displayPattern);
      setRecurringInterval(initialInterval);
      setRecurringUnit(initialUnit);

      if (note) {
        initialStateRef.current = {
          text: initialText,
          type: initialType,
          color: initialColor,
          recurringPattern: displayPattern,
          recurringInterval: initialInterval,
          recurringUnit: initialUnit,
        };
      }
    } else {
      // Reset to defaults when closing
      setType("note");
      setColor("#3b82f6");
      setRecurringPattern("none");
      setRecurringInterval(1);
      setRecurringUnit("months");
      initialStateRef.current = {
        text: "",
        type: "note",
        color: "#3b82f6",
        recurringPattern: "none",
        recurringInterval: 1,
        recurringUnit: "months",
      };
    }
  }, [open, note]);

  const hasChanges = () => {
    if (note) {
      // Edit mode: check if anything changed from initial
      return (
        noteText !== initialStateRef.current.text ||
        type !== initialStateRef.current.type ||
        color !== initialStateRef.current.color ||
        recurringPattern !== initialStateRef.current.recurringPattern ||
        recurringInterval !== initialStateRef.current.recurringInterval ||
        recurringUnit !== initialStateRef.current.recurringUnit
      );
    } else {
      // Create mode: check if any text was entered
      return noteText.trim() !== "";
    }
  };

  const handleSave = async () => {
    if (!noteText.trim() || isSaving) return;

    setIsSaving(true);
    try {
      // Build pattern with unit: "custom-weeks" or "custom-months"
      const finalPattern =
        recurringPattern === "custom"
          ? `custom-${recurringUnit}`
          : recurringPattern;

      onSubmit(
        noteText,
        type,
        type === "event" ? color : undefined,
        type === "event" ? finalPattern : undefined,
        type === "event" && recurringPattern === "custom"
          ? recurringInterval
          : undefined
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
    ? format(selectedDate, "PPP", { locale: dateLocale })
    : "";

  const customFooter = note ? (
    // Edit mode: Delete button on left, Cancel/Save on right
    <div className="flex gap-2.5 w-full">
      {onDelete && !isReadOnly && (
        <Button
          type="button"
          variant="destructive"
          onClick={handleDelete}
          disabled={isSaving}
          className="h-11 shadow-lg shadow-destructive/25"
        >
          {t("common.delete")}
        </Button>
      )}
      <div className="flex-1" />
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSaving}
        className="h-11 border-border/50 hover:bg-muted/50"
      >
        {t("common.cancel")}
      </Button>
      {!isReadOnly && (
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !noteText.trim() || !hasChanges()}
          className="h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
        >
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </div>
  ) : (
    // Create mode: Full-width buttons
    <div className="flex gap-2.5 w-full">
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
        disabled={isSaving}
        className="flex-1 h-11 border-border/50 hover:bg-muted/50"
      >
        {t("common.cancel")}
      </Button>
      {!isReadOnly && (
        <Button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !noteText.trim()}
          className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
        >
          {isSaving ? t("common.saving") : t("common.save")}
        </Button>
      )}
    </div>
  );

  const getSheetTitle = () => {
    const itemType =
      type === "event" ? t("note.typeEvent") : t("note.typeNote");
    if (note) {
      return t("note.edit", { item: itemType });
    }
    return t("note.create", { item: itemType });
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={getSheetTitle()}
      description={formattedDate}
      footer={customFooter}
      hasUnsavedChanges={hasChanges()}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Read-Only Banner */}
        {isReadOnly && <ReadOnlyBanner message={t("guest.cannotEdit")} />}

        {/* Recurring Event Warning */}
        {note &&
          type === "event" &&
          note.recurringPattern &&
          note.recurringPattern !== "none" && (
            <Alert className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                {t("note.recurringEditWarning")}
              </AlertDescription>
            </Alert>
          )}

        {/* Type Selection */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">{t("note.type")}</Label>
          <RadioGroup
            value={type}
            onValueChange={(value) => setType(value as "note" | "event")}
            className="flex gap-4"
            disabled={isReadOnly}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="note"
                id="type-note"
                disabled={isReadOnly}
              />
              <Label htmlFor="type-note" className="cursor-pointer font-normal">
                {t("note.typeNote")}
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="event"
                id="type-event"
                disabled={isReadOnly}
              />
              <Label
                htmlFor="type-event"
                className="cursor-pointer font-normal"
              >
                {t("note.typeEvent")}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Event Options */}
        {type === "event" && (
          <div className="space-y-4 pl-6 border-l-2 border-border/50">
            {/* Color Selection */}
            <ColorPicker
              color={color}
              onChange={setColor}
              label={t("note.eventColor")}
              presetColors={PRESET_COLORS}
              disabled={isReadOnly}
            />

            {/* Recurring Pattern */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                {t("note.recurring")}
              </Label>
              <Select
                value={recurringPattern}
                onValueChange={setRecurringPattern}
                disabled={isReadOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    {t("note.recurringNone")}
                  </SelectItem>
                  <SelectItem value="custom">
                    {t("note.recurringCustom")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Interval */}
            {recurringPattern === "custom" && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {t("note.customInterval")}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {t("note.every")}
                  </span>
                  <Input
                    type="number"
                    min={1}
                    max={52}
                    value={recurringInterval}
                    onChange={(e) =>
                      setRecurringInterval(parseInt(e.target.value) || 1)
                    }
                    className="w-20"
                    disabled={isReadOnly}
                  />
                  <Select
                    value={recurringUnit}
                    onValueChange={setRecurringUnit}
                    disabled={isReadOnly}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weeks">{t("note.weeks")}</SelectItem>
                      <SelectItem value="months">{t("note.months")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Note Text */}
        <div className="space-y-3">
          <Label htmlFor="note-text" className="text-sm font-medium">
            {type === "event" ? t("note.eventTitle") : t("note.note")}
          </Label>
          <Textarea
            id="note-text"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={
              type === "event"
                ? t("note.eventPlaceholder")
                : t("note.placeholder")
            }
            className="min-h-[200px] resize-none focus-visible:ring-primary/30 border-border/50"
            disabled={isReadOnly}
          />
        </div>
      </div>
    </BaseSheet>
  );
}
