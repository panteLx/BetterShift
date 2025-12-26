import { useState, useCallback } from "react";
import { CalendarNote } from "@/lib/db/schema";

interface UseNoteActionsProps {
  createNote: (
    text: string,
    date: Date,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => Promise<boolean>;
  updateNote: (
    id: string,
    text: string,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => Promise<boolean>;
  deleteNote: (id: string) => Promise<boolean>;
}

export function useNoteActions({
  createNote,
  updateNote,
  deleteNote,
}: UseNoteActionsProps) {
  const [selectedNote, setSelectedNote] = useState<CalendarNote | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  const handleNoteSubmit = useCallback(
    async (
      noteText: string,
      type?: "note" | "event",
      color?: string,
      recurringPattern?: string,
      recurringInterval?: number
    ) => {
      if (selectedNote) {
        await updateNote(
          selectedNote.id,
          noteText,
          type,
          color,
          recurringPattern,
          recurringInterval
        );
      } else if (selectedDate) {
        await createNote(
          noteText,
          selectedDate,
          type,
          color,
          recurringPattern,
          recurringInterval
        );
      }
    },
    [selectedNote, selectedDate, createNote, updateNote]
  );

  const handleNoteDelete = useCallback(async () => {
    if (!selectedNote) return;

    const success = await deleteNote(selectedNote.id);
    if (success) {
      setShowNoteDialog(false);
    }
  }, [selectedNote, deleteNote]);

  const openNoteDialog = useCallback((date: Date, note?: CalendarNote) => {
    setSelectedDate(date);
    setSelectedNote(note);
    setShowNoteDialog(true);
  }, []);

  const handleNoteDialogChange = useCallback((open: boolean) => {
    setShowNoteDialog(open);
    if (!open) {
      setSelectedNote(undefined);
      setSelectedDate(undefined);
    }
  }, []);

  return {
    selectedNote,
    selectedDate,
    showNoteDialog,
    handleNoteSubmit,
    handleNoteDelete,
    openNoteDialog,
    handleNoteDialogChange,
  };
}
