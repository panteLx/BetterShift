import { useState, useCallback } from "react";
import { CalendarNote } from "@/lib/db/schema";

interface UseNoteActionsProps {
  createNote: (
    text: string,
    date: Date,
    onPasswordRequired: () => void,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => Promise<boolean>;
  updateNote: (
    id: string,
    text: string,
    onPasswordRequired: () => void,
    type?: "note" | "event",
    color?: string,
    recurringPattern?: string,
    recurringInterval?: number
  ) => Promise<boolean>;
  deleteNote: (id: string, onPasswordRequired: () => void) => Promise<boolean>;
  onPasswordRequired: (action: () => Promise<void>) => void;
}

export function useNoteActions({
  createNote,
  updateNote,
  deleteNote,
  onPasswordRequired,
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
      const handlePasswordRequired = () => {
        onPasswordRequired(async () => {
          if (selectedNote) {
            await updateNote(
              selectedNote.id,
              noteText,
              handlePasswordRequired,
              type,
              color,
              recurringPattern,
              recurringInterval
            );
          } else if (selectedDate) {
            await createNote(
              noteText,
              selectedDate,
              handlePasswordRequired,
              type,
              color,
              recurringPattern,
              recurringInterval
            );
          }
        });
      };

      if (selectedNote) {
        await updateNote(
          selectedNote.id,
          noteText,
          handlePasswordRequired,
          type,
          color,
          recurringPattern,
          recurringInterval
        );
      } else if (selectedDate) {
        await createNote(
          noteText,
          selectedDate,
          handlePasswordRequired,
          type,
          color,
          recurringPattern,
          recurringInterval
        );
      }
    },
    [selectedNote, selectedDate, createNote, updateNote, onPasswordRequired]
  );

  const handleNoteDelete = useCallback(async () => {
    if (!selectedNote) return;

    const handlePasswordRequired = () => {
      onPasswordRequired(async () => {
        if (selectedNote) {
          const success = await deleteNote(
            selectedNote.id,
            handlePasswordRequired
          );
          if (success) {
            setShowNoteDialog(false);
            setSelectedNote(undefined);
          }
        }
      });
    };

    const success = await deleteNote(selectedNote.id, handlePasswordRequired);
    if (success) {
      setShowNoteDialog(false);
    }
  }, [selectedNote, deleteNote, onPasswordRequired]);

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
