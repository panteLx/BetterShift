import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CalendarNote } from "@/lib/db/schema";
import { formatDateToLocal, parseLocalDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";

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

// Form data interface
export interface NoteFormData {
  date: string;
  note: string;
  type?: "note" | "event";
  color?: string;
  recurringPattern?: string;
  recurringInterval?: number;
}

// API functions
async function fetchNotesApi(calendarId: string): Promise<CalendarNote[]> {
  const params = new URLSearchParams({ calendarId });
  const response = await fetch(`/api/notes?${params}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch notes: ${response.statusText}`);
  }

  const data = await response.json();
  return data.map(normalizeNote);
}

async function createNoteApi(
  calendarId: string,
  formData: NoteFormData
): Promise<CalendarNote> {
  const response = await fetch("/api/notes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...formData, calendarId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to create note: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  return normalizeNote(data);
}

async function updateNoteApi(
  id: string,
  formData: Omit<NoteFormData, "date">
): Promise<CalendarNote> {
  const response = await fetch(`/api/notes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formData),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to update note: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();
  return normalizeNote(data);
}

async function deleteNoteApi(id: string): Promise<void> {
  const response = await fetch(`/api/notes/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to delete note: ${response.status} ${response.statusText} - ${errorText}`
    );
  }
}

// Context types for optimistic updates
interface CreateNoteContext {
  previous: CalendarNote[] | undefined;
}

interface UpdateNoteContext {
  previous: CalendarNote[] | undefined;
}

interface DeleteNoteContext {
  previous: CalendarNote[] | undefined;
}

export function useNotes(calendarId: string | undefined) {
  const t = useTranslations();
  const queryClient = useQueryClient();

  // Data fetching with React Query
  const {
    data: notes = [],
    isLoading,
    isFetched,
  } = useQuery({
    queryKey: queryKeys.notes.byCalendar(calendarId!),
    queryFn: () => fetchNotesApi(calendarId!),
    enabled: !!calendarId,
  });

  // Create mutation with optimistic update
  const createMutation = useMutation<
    CalendarNote,
    Error,
    NoteFormData,
    CreateNoteContext
  >({
    mutationFn: (formData) => createNoteApi(calendarId!, formData),
    onMutate: async (formData) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });

      // Snapshot previous value
      const previous = queryClient.getQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!)
      );

      // Create optimistic note
      const optimisticNote: CalendarNote = {
        id: `temp-${Date.now()}`,
        date: parseLocalDate(formData.date),
        note: formData.note,
        type: formData.type || "note",
        color: formData.color ?? null,
        recurringPattern: formData.recurringPattern || "none",
        recurringInterval: formData.recurringInterval ?? null,
        calendarId: calendarId!,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Optimistically update cache
      queryClient.setQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!),
        (old = []) => [...old, optimisticNote]
      );

      return { previous };
    },
    onError: (err, formData, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.notes.byCalendar(calendarId!),
          context.previous
        );
      }
      console.error("Failed to create note:", err);
      const itemType =
        formData.type === "event" ? t("note.typeEvent") : t("note.note");
      toast.error(t("common.createError", { item: itemType }));
    },
    onSuccess: (data, formData) => {
      const itemType =
        formData.type === "event" ? t("note.typeEvent") : t("note.note");
      toast.success(t("common.created", { item: itemType }));
    },
    onSettled: () => {
      // Refetch to get real data from server
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });
    },
  });

  // Update mutation with optimistic update
  const updateMutation = useMutation<
    CalendarNote,
    Error,
    { id: string; formData: Omit<NoteFormData, "date"> },
    UpdateNoteContext
  >({
    mutationFn: ({ id, formData }) => updateNoteApi(id, formData),
    onMutate: async ({ id, formData }) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });

      const previous = queryClient.getQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!)
      );

      // Optimistically update
      queryClient.setQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!),
        (old = []) =>
          old.map((n) =>
            n.id === id
              ? {
                  ...n,
                  note: formData.note,
                  type: formData.type || n.type,
                  color: formData.color ?? n.color,
                  recurringPattern:
                    formData.recurringPattern ?? n.recurringPattern,
                  recurringInterval:
                    formData.recurringInterval ?? n.recurringInterval,
                  updatedAt: new Date(),
                }
              : n
          )
      );

      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.notes.byCalendar(calendarId!),
          context.previous
        );
      }
      console.error("Failed to update note:", err);
      const itemType =
        variables.formData.type === "event"
          ? t("note.typeEvent")
          : t("note.note");
      toast.error(t("common.updateError", { item: itemType }));
    },
    onSuccess: (data, variables) => {
      const itemType =
        variables.formData.type === "event"
          ? t("note.typeEvent")
          : t("note.note");
      toast.success(t("common.updated", { item: itemType }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });
    },
  });

  // Delete mutation with optimistic update
  const deleteMutation = useMutation<void, Error, string, DeleteNoteContext>({
    mutationFn: (id) => deleteNoteApi(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });

      const previous = queryClient.getQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!)
      );

      // Optimistically remove
      queryClient.setQueryData<CalendarNote[]>(
        queryKeys.notes.byCalendar(calendarId!),
        (old = []) => old.filter((n) => n.id !== id)
      );

      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(
          queryKeys.notes.byCalendar(calendarId!),
          context.previous
        );
      }
      console.error("Failed to delete note:", err);
      toast.error(t("common.deleteError", { item: t("note.note") }));
    },
    onSuccess: () => {
      toast.success(t("common.deleted", { item: t("note.note") }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      });
    },
  });

  // Return API-compatible interface with backward compatibility
  return {
    notes,
    loading: isLoading,
    hasLoadedOnce: isFetched,
    createNote: async (
      noteText: string,
      date: Date,
      type?: "note" | "event",
      color?: string,
      recurringPattern?: string,
      recurringInterval?: number
    ) => {
      try {
        await createMutation.mutateAsync({
          date: formatDateToLocal(date),
          note: noteText,
          type,
          color,
          recurringPattern,
          recurringInterval,
        });
        return true;
      } catch {
        return false;
      }
    },
    updateNote: async (
      noteId: string,
      noteText: string,
      type?: "note" | "event",
      color?: string,
      recurringPattern?: string,
      recurringInterval?: number
    ) => {
      try {
        await updateMutation.mutateAsync({
          id: noteId,
          formData: {
            note: noteText,
            type,
            color,
            recurringPattern,
            recurringInterval,
          },
        });
        return true;
      } catch {
        return false;
      }
    },
    deleteNote: async (noteId: string) => {
      try {
        await deleteMutation.mutateAsync(noteId);
        return true;
      } catch {
        return false;
      }
    },
    refetchNotes: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.byCalendar(calendarId!),
      }),
  };
}
