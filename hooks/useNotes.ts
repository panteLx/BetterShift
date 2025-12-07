import { useState, useEffect } from "react";
import { CalendarNote } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { getCachedPassword } from "@/lib/password-cache";

export function useNotes(calendarId: string | undefined) {
  const t = useTranslations();
  const [notes, setNotes] = useState<CalendarNote[]>([]);

  const fetchNotes = async () => {
    if (!calendarId) return;

    try {
      const password = getCachedPassword(calendarId);
      const params = new URLSearchParams({ calendarId });
      if (password) {
        params.append("password", password);
      }

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
      setNotes(data);
    } catch (error) {
      // Network errors or other exceptions - don't clear existing notes
      console.error("Failed to fetch notes:", error);
    }
  };

  const createNote = async (
    noteText: string,
    date: Date,
    onPasswordRequired?: () => void
  ) => {
    if (!calendarId) return false;

    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: calendarId,
          date: formatDateToLocal(date),
          note: noteText,
          password,
        }),
      });

      if (response.status === 401) {
        onPasswordRequired?.();
        return false;
      }

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
      toast.success(t("common.created", { item: t("note.note") }));
      return true;
    } catch (error) {
      console.error("Failed to create note:", error);
      toast.error(t("common.createError", { item: t("note.note") }));
      return false;
    }
  };

  const updateNote = async (
    noteId: string,
    noteText: string,
    onPasswordRequired?: () => void
  ) => {
    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: noteText, password }),
      });

      if (response.status === 401) {
        onPasswordRequired?.();
        return false;
      }

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
      toast.success(t("common.updated", { item: t("note.note") }));
      return true;
    } catch (error) {
      console.error("Failed to update note:", error);
      toast.error(t("common.updateError", { item: t("note.note") }));
      return false;
    }
  };

  const deleteNote = async (
    noteId: string,
    onPasswordRequired?: () => void
  ) => {
    try {
      const password = getCachedPassword(calendarId);

      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (response.status === 401) {
        onPasswordRequired?.();
        return false;
      }

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
