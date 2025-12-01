import { useState, useEffect } from "react";
import { CalendarNote } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function useNotes(calendarId: string | undefined) {
  const t = useTranslations();
  const [notes, setNotes] = useState<CalendarNote[]>([]);

  const fetchNotes = async () => {
    if (!calendarId) return;

    try {
      const response = await fetch(`/api/notes?calendarId=${calendarId}`);
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  };

  const createNote = async (noteText: string, date: Date) => {
    if (!calendarId) return;

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: calendarId,
          date: formatDateToLocal(date),
          note: noteText,
        }),
      });
      const newNote = await response.json();
      setNotes([...notes, newNote]);
      toast.success(t("note.created"));
    } catch (error) {
      console.error("Failed to create note:", error);
      toast.error(t("note.createError"));
    }
  };

  const updateNote = async (noteId: string, noteText: string) => {
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText }),
      });
      const updatedNote = await response.json();
      setNotes(notes.map((n) => (n.id === noteId ? updatedNote : n)));
      toast.success(t("note.updated"));
    } catch (error) {
      console.error("Failed to update note:", error);
      toast.error(t("note.updateError"));
    }
  };

  const deleteNote = async (noteId: string) => {
    try {
      await fetch(`/api/notes/${noteId}`, { method: "DELETE" });
      setNotes(notes.filter((n) => n.id !== noteId));
      toast.success(t("note.deleted"));
    } catch (error) {
      console.error("Failed to delete note:", error);
      toast.error(t("note.deleteError"));
    }
  };

  useEffect(() => {
    if (calendarId) {
      fetchNotes();
    } else {
      setNotes([]);
    }
  }, [calendarId]);

  return {
    notes,
    createNote,
    updateNote,
    deleteNote,
    refetchNotes: fetchNotes,
  };
}
