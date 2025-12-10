"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarNote } from "@/lib/db/schema";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

interface NoteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (note: string) => void;
  onDelete?: () => void;
  selectedDate?: Date;
  note?: CalendarNote;
}

export function NoteDialog({
  open,
  onOpenChange,
  onSubmit,
  onDelete,
  selectedDate,
  note,
}: NoteDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const initialNoteRef = useRef<string>("");
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialMount = useRef(true);
  const prevNoteIdRef = useRef<string | undefined>(undefined);
  const isNewNote = !note;

  // State initialization - useEffect handles all updates
  const [noteText, setNoteText] = useState("");

  // Update noteText when note changes (only when note ID actually changes)
  useEffect(() => {
    if (open) {
      const currentNoteId = note?.id;
      // Only update if note ID changed to avoid cascading renders
      if (prevNoteIdRef.current !== currentNoteId) {
        const currentNote = note?.note || "";
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setNoteText(currentNote);
        initialNoteRef.current = currentNote;
        isInitialMount.current = true;
        prevNoteIdRef.current = currentNoteId;
      }
    }
  }, [open, note]);

  // Handle dialog close with immediate save if needed (only for existing notes)
  const handleDialogClose = (open: boolean) => {
    if (!open && !isNewNote && noteText !== initialNoteRef.current) {
      // Cancel pending timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      // Save immediately
      if (noteText.trim()) {
        onSubmit(noteText);
      }
    }
    onOpenChange(open);
  };

  // Auto-save with debouncing (only for existing notes)
  useEffect(() => {
    if (!open || isNewNote) return;

    // Skip initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Only save if text has changed from initial value
    if (noteText !== initialNoteRef.current) {
      saveTimeoutRef.current = setTimeout(() => {
        if (noteText.trim()) {
          onSubmit(noteText);
          initialNoteRef.current = noteText;
        }
      }, 1000); // 1 second debounce
    }

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [noteText, open, onSubmit, isNewNote]);

  const handleDelete = () => {
    if (onDelete) {
      onDelete();
      onOpenChange(false);
    }
  };

  const handleAdd = () => {
    if (noteText.trim()) {
      onSubmit(noteText);
      onOpenChange(false);
    }
  };

  const formattedDate = selectedDate
    ? format(selectedDate, "PPP", { locale: dateLocale })
    : "";

  return (
    <Dialog open={open} onOpenChange={handleDialogClose}>
      <DialogContent
        key={note?.id || "new-note"}
        className="sm:max-w-[480px] p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl"
      >
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
              <StickyNote className="h-5 w-5 text-white" />
            </div>
            {note ? t("note.edit") : t("note.create")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground flex items-center gap-2 pl-11">
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {formattedDate}
            </div>
          </DialogDescription>
        </DialogHeader>
        <div className="p-6 space-y-5">
          <div className="space-y-2.5">
            <Label
              htmlFor="note"
              className="text-sm font-medium flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("note.note")}
            </Label>
            <Textarea
              id="note"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder={t("note.notePlaceholder")}
              className="min-h-[120px] border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-primary/5 backdrop-blur-sm resize-none"
            />
          </div>
          <div className="flex justify-between items-center pt-2">
            <div>
              {note && onDelete && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  className="h-11 shadow-lg hover:shadow-xl transition-all"
                >
                  {t("common.delete")}
                </Button>
              )}
            </div>
            <div className="flex gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="h-11 border-border/50 hover:bg-muted/50"
              >
                {t("common.close")}
              </Button>
              {isNewNote && (
                <Button
                  type="button"
                  onClick={handleAdd}
                  disabled={!noteText.trim()}
                  className="h-11 shadow-lg hover:shadow-xl transition-all"
                >
                  {t("common.add")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
