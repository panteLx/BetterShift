"use client";

import { CalendarNote } from "@/lib/db/schema";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Pencil, Trash2, Plus, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReadOnlyBanner } from "@/components/read-only-banner";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

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
  const dateLocale = getDateLocale(locale);
  const permission = useCalendarPermission(calendarId);

  // Determine if dialog should be in read-only mode
  const isReadOnly = readOnly || !permission.canEdit;

  const formattedDate = format(date, "EEEE, dd. MMMM yyyy", {
    locale: dateLocale,
  });

  const events = notes.filter((n) => n.type === "event");
  const regularNotes = notes.filter((n) => n.type !== "event");

  const getRecurringLabel = (note: CalendarNote) => {
    if (!note.recurringPattern || note.recurringPattern === "none") {
      return null;
    }

    if (note.recurringPattern === "custom-weeks") {
      return t("note.recurringEveryWeeks", {
        count: note.recurringInterval || 1,
      });
    }

    if (note.recurringPattern === "custom-months") {
      return t("note.recurringEveryMonths", {
        count: note.recurringInterval || 1,
      });
    }

    return null;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("note.typeNote")} & {t("note.typeEvent")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {formattedDate}
          </DialogDescription>
        </DialogHeader>

        {/* Read-Only Banner */}
        {isReadOnly && (
          <div className="px-6 pt-6">
            <ReadOnlyBanner message={t("guest.cannotEdit")} />
          </div>
        )}

        <div className="space-y-6 overflow-y-auto flex-1 p-6">
          {/* Events Section */}
          {events.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("note.typeEvent")} ({events.length})
              </h3>
              <div className="space-y-2">
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
                    style={{
                      borderLeftColor: event.color || "#3b82f6",
                      borderLeftWidth: 4,
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-1 h-4 rounded-full"
                            style={{
                              backgroundColor: event.color || "#3b82f6",
                            }}
                          />
                          <h4 className="font-semibold text-base truncate">
                            {event.note}
                          </h4>
                          {getRecurringLabel(event) && (
                            <Badge
                              variant="secondary"
                              className="text-xs shrink-0"
                            >
                              {getRecurringLabel(event)}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-1.5 shrink-0 ml-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditNote(event)}
                            className="h-8 w-8 hover:bg-background/50"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteNote(event.id)}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {regularNotes.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("note.typeNote")} ({regularNotes.length})
              </h3>
              <div className="space-y-2">
                {regularNotes.map((note) => (
                  <div
                    key={note.id}
                    className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground whitespace-pre-wrap break-words">
                          {note.note}
                        </p>
                      </div>
                      {!isReadOnly && (
                        <div className="flex gap-1.5 shrink-0 ml-auto">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onEditNote(note)}
                            className="h-8 w-8"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => onDeleteNote(note.id)}
                            className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty State */}
          {notes.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{t("note.noEntries")}</p>
            </div>
          )}
        </div>

        {/* Footer with Add Button */}
        <div className="flex justify-between items-center gap-3 p-6 pt-4 border-t border-border/50 bg-gradient-to-r from-muted/20 via-muted/10 to-transparent">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-border/50"
          >
            {t("common.cancel")}
          </Button>
          {!isReadOnly && (
            <Button
              onClick={() => {
                onOpenChange(false);
                onAddNew();
              }}
              className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t("common.add")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
