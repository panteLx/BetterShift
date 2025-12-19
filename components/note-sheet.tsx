"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarNote } from "@/lib/db/schema";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";

interface NoteSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string) => void;
  onDelete?: () => void;
  selectedDate?: Date;
  note?: CalendarNote;
}

export function NoteSheet({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  selectedDate,
  note,
}: NoteSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [noteText, setNoteText] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const initialNoteTextRef = useRef<string>("");

  // Reset state when dialog opens/closes or note changes
  useEffect(() => {
    if (open) {
      const initialText = note?.note || "";
      setNoteText(initialText);
      if (note) {
        initialNoteTextRef.current = initialText;
      }
    } else {
      initialNoteTextRef.current = "";
    }
  }, [open, note]);

  const hasChanges = () => {
    if (note) {
      // Edit mode: check if text changed from initial
      return noteText !== initialNoteTextRef.current;
    } else {
      // Create mode: check if any text was entered
      return noteText.trim() !== "";
    }
  };

  const handleSave = async () => {
    if (!noteText.trim() || isSaving) return;

    setIsSaving(true);
    try {
      onSubmit(noteText);
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
      {onDelete && (
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
      <Button
        type="button"
        onClick={handleSave}
        disabled={isSaving || !noteText.trim() || !hasChanges()}
        className="h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
      >
        {isSaving ? t("common.saving") : t("common.save")}
      </Button>
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
      <Button
        type="button"
        onClick={handleSave}
        disabled={isSaving || !noteText.trim()}
        className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
      >
        {isSaving ? t("common.saving") : t("common.save")}
      </Button>
    </div>
  );

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={note ? t("note.edit") : t("note.create")}
      description={formattedDate}
      footer={customFooter}
      hasUnsavedChanges={hasChanges()}
      maxWidth="md"
    >
      <div className="space-y-3">
        <Label htmlFor="note-text" className="text-sm font-medium">
          {t("note.note")}
        </Label>
        <Textarea
          id="note-text"
          value={noteText}
          onChange={(e) => setNoteText(e.target.value)}
          placeholder={t("note.placeholder")}
          className="min-h-[300px] resize-none focus-visible:ring-primary/30 border-border/50"
        />
      </div>
    </BaseSheet>
  );
}
