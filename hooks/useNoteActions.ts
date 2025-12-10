import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { CalendarNote } from "@/lib/db/schema";

interface UseNoteActionsProps {
  createNote: (
    text: string,
    date: Date,
    onPasswordRequired: () => void
  ) => Promise<boolean>;
  updateNote: (
    id: string,
    text: string,
    onPasswordRequired: () => void
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
  const t = useTranslations();
  const [selectedNote, setSelectedNote] = useState<CalendarNote | undefined>();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showNoteDialog, setShowNoteDialog] = useState(false);

  const handleNoteSubmit = useCallback(
    async (noteText: string) => {
      const handlePasswordRequired = () => {
        onPasswordRequired(async () => {
          if (selectedNote) {
            await updateNote(selectedNote.id, noteText, handlePasswordRequired);
          } else if (selectedDate) {
            await createNote(noteText, selectedDate, handlePasswordRequired);
          }
        });
      };

      if (selectedNote) {
        await updateNote(selectedNote.id, noteText, handlePasswordRequired);
      } else if (selectedDate) {
        await createNote(noteText, selectedDate, handlePasswordRequired);
      }
    },
    [selectedNote, selectedDate, createNote, updateNote, onPasswordRequired]
  );

  const handleNoteDelete = useCallback(async () => {
    if (!selectedNote) return;

    const handlePasswordRequired = () => {
      onPasswordRequired(async () => {
        if (selectedNote) {
          await deleteNote(selectedNote.id, handlePasswordRequired);
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
