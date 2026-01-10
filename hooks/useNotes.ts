import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { CalendarNote } from "@/lib/db/schema";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";

// Helper to convert API response timestamps to Date objects
export function normalizeNote(note: Record<string, unknown>): CalendarNote {
  const dateValue = note.date as string | number | Date;
  const parsedDate =
    typeof dateValue === "string" && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)
      ? parseLocalDate(dateValue)
      : new Date(dateValue);

  return {
    ...(note as Omit<CalendarNote, "date" | "createdAt" | "updatedAt">),
    date: parsedDate,
    createdAt: new Date(note.createdAt as string | number | Date),
    updatedAt: new Date(note.updatedAt as string | number | Date),
  };
}

export function useNotes(calendarId: string | undefined) {
  const t = useTranslations();
  const [notes, setNotes] = useState<CalendarNote[]>([]);

  const fetchNotes = useCallback(async () => {
    if (!calendarId) return;

    try {
      const params = new URLSearchParams({ calendarId });

      const response = await fetch(`/api/notes?${params}`);
      if (!response.ok) {
        // Only clear notes for unauthorized responses (locked calendar)
        if (response.status === 401 || response.status === 403) {
          setNotes([]);
        } else {
          // For other errors (server errors, etc.), log but don't clear existing notes
          console.error(
            `Failed to fetch notes: ${response.status} ${response.statusText}`
          );
        }
        return;
      }
      const data = await response.json();
      setNotes(data.map(normalizeNote));
    } catch (error) {
      // Network errors or other exceptions - don't clear existing notes
      console.error("Failed to fetch notes:", error);
    }
  }, [calendarId]);

  const createNote = async (
    noteText: string,
    date: Date,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => {
    if (!calendarId) return false;

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: calendarId,
          date: formatDateToLocal(date),
          note: noteText,
          type: type,
          color: color,
          recurringPattern: recurringPattern,
          recurringInterval: recurringInterval,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to create note: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.createError", { item: t("note.note") }));
        return false;
      }

      const newNote = await response.json();
      setNotes((prev) => [...prev, newNote]);
      const itemType = type === "event" ? t("note.typeEvent") : t("note.note");
      toast.success(t("common.created", { item: itemType }));
      return true;
    } catch (error) {
      console.error("Failed to create note:", error);
      const itemType = type === "event" ? t("note.typeEvent") : t("note.note");
      toast.error(t("common.createError", { item: itemType }));
      return false;
    }
  };

  const updateNote = async (
    noteId: string,
    noteText: string,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: noteText,
          type: type,
          color: color,
          recurringPattern: recurringPattern,
          recurringInterval: recurringInterval,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to update note: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.updateError", { item: t("note.note") }));
        return false;
      }

      const updatedNote = await response.json();
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updatedNote : n)));
      const itemType = type === "event" ? t("note.typeEvent") : t("note.note");
      toast.success(t("common.updated", { item: itemType }));
      return true;
    } catch (error) {
      console.error("Failed to update note:", error);
      const itemType = type === "event" ? t("note.typeEvent") : t("note.note");
      toast.error(t("common.updateError", { item: itemType }));
      return false;
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          `Failed to delete note: ${response.status} ${response.statusText}`,
          errorText
        );
        toast.error(t("common.deleteError", { item: t("note.note") }));
        return false;
      }

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      toast.success(t("common.deleted", { item: t("note.note") }));
      return true;
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error(t("common.deleteError", { item: t("note.note") }));
      return false;
    }
  };

  // Fetch notes when calendar changes

  useEffect(() => {
    if (!calendarId) {
      // Data fetching on mount/calendar change is a valid effect use case
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotes([]);
      return;
    }
    fetchNotes();
  }, [calendarId, fetchNotes]);

  return {
    notes,
    createNote,
    updateNote,
    deleteNote,
    refetchNotes: fetchNotes,
  };
}
