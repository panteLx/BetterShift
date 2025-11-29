"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { ShiftWithCalendar, CalendarWithCount } from "@/lib/types";
import { CalendarSelector } from "@/components/calendar-selector";
import { CalendarDialog } from "@/components/calendar-dialog";
import { ShiftDialog, ShiftFormData } from "@/components/shift-dialog";
import { ShiftCard } from "@/components/shift-card";
import { PresetSelector } from "@/components/preset-selector";
import { PasswordDialog } from "@/components/password-dialog";
import { ManagePasswordDialog } from "@/components/manage-password-dialog";
import { DeleteCalendarDialog } from "@/components/delete-calendar-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ShiftStats } from "@/components/shift-stats";
import { NoteDialog } from "@/components/note-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Calendar as CalendarIcon,
  StickyNote,
} from "lucide-react";
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { ShiftPreset, CalendarNote } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "de" ? de : enUS;
  const [calendars, setCalendars] = useState<CalendarWithCount[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<
    string | undefined
  >();
  const [shifts, setShifts] = useState<ShiftWithCalendar[]>([]);
  const [presets, setPresets] = useState<ShiftPreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<
    string | undefined
  >();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [showCalendarDialog, setShowCalendarDialog] = useState(false);
  const [showShiftDialog, setShowShiftDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showManagePasswordDialog, setShowManagePasswordDialog] =
    useState(false);
  const [showMobileCalendarDialog, setShowMobileCalendarDialog] =
    useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [showDeleteCalendarDialog, setShowDeleteCalendarDialog] =
    useState(false);
  const [calendarToDelete, setCalendarToDelete] = useState<
    string | undefined
  >();
  const [selectedNote, setSelectedNote] = useState<CalendarNote | undefined>();
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "edit";
    shiftId?: string;
    formData?: ShiftFormData;
    presetAction?: () => Promise<void>;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [isTogglingShift, setIsTogglingShift] = useState(false);
  const [showShiftsSection, setShowShiftsSection] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const lastSyncTimeRef = useRef<number>(Date.now());
  const disconnectTimeRef = useRef<number | null>(null);
  const [version, setVersion] = useState<string | null>(null);

  // Fetch version information
  const fetchVersion = async () => {
    try {
      const response = await fetch("/api/version");
      const data = await response.json();
      setVersion(data.version);
    } catch (error) {
      console.error("Failed to fetch version:", error);
    }
  };

  // Fetch calendars on mount and setup cleanup
  useEffect(() => {
    fetchCalendars();
    fetchVersion();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  // Handle page visibility changes (tab switching, app backgrounding)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && selectedCalendar) {
        const now = Date.now();
        const timeSinceLastSync = now - lastSyncTimeRef.current;

        // If more than 30 seconds passed or we were disconnected, resync
        if (timeSinceLastSync > 30000 || disconnectTimeRef.current) {
          console.log("Tab became visible, resyncing data...");
          toast.info(t("sync.refreshing"), { duration: Infinity });
          fetchShifts();
          fetchPresets();
          fetchNotes();
          setStatsRefreshTrigger((prev) => prev + 1);
          lastSyncTimeRef.current = now;
          disconnectTimeRef.current = null;
          // Dismiss the refreshing toast after data is loaded
          setTimeout(() => toast.dismiss(), 1000);
        }
      }
    };

    const handleOnline = () => {
      console.log("Network connection restored");
      toast.dismiss(); // Dismiss all persistent error toasts
      toast.success(t("sync.reconnected"));
      setIsConnected(true);
      if (selectedCalendar) {
        fetchShifts();
        fetchPresets();
        fetchNotes();
        setStatsRefreshTrigger((prev) => prev + 1);
        lastSyncTimeRef.current = Date.now();
        disconnectTimeRef.current = null;
      }
    };

    const handleOffline = () => {
      console.log("Network connection lost");
      toast.error(t("sync.offline"), { duration: Infinity });
      setIsConnected(false);
      disconnectTimeRef.current = Date.now();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [selectedCalendar, t]);

  // Update URL when selected calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, router]);

  // Fetch shifts and presets when calendar changes and setup SSE
  useEffect(() => {
    if (selectedCalendar) {
      fetchShifts();
      fetchPresets();
      fetchNotes();

      // Close existing SSE connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      // Setup Server-Sent Events for real-time updates
      const eventSource = new EventSource(
        `/api/events/stream?calendarId=${selectedCalendar}`
      );

      eventSource.onopen = () => {
        setIsConnected(true);
        toast.dismiss(); // Dismiss any persistent error/info toasts

        // If we were disconnected for more than 10 seconds, resync all data
        if (disconnectTimeRef.current) {
          const disconnectDuration = Date.now() - disconnectTimeRef.current;
          if (disconnectDuration > 10000) {
            console.log("Reconnected after long disconnect, resyncing...");
            toast.info(t("sync.resyncing"), { duration: Infinity });
            fetchShifts();
            fetchPresets();
            fetchNotes();
            setStatsRefreshTrigger((prev) => prev + 1);
          }
          disconnectTimeRef.current = null;
        }
        lastSyncTimeRef.current = Date.now();
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          // Handle connection message
          if (data.type === "connected") {
            console.log("SSE connected for calendar:", data.calendarId);
            return;
          }

          // Handle calendar change events
          if (data.type === "shift") {
            fetchShifts();
            setStatsRefreshTrigger((prev) => prev + 1);
          } else if (data.type === "preset") {
            fetchPresets();
          } else if (data.type === "note") {
            fetchNotes();
          }

          lastSyncTimeRef.current = Date.now();
        } catch (error) {
          console.error("Error parsing SSE message:", error);
        }
      };

      eventSource.onerror = (error) => {
        console.error("SSE connection error:", error);
        setIsConnected(false);
        disconnectTimeRef.current = Date.now();
        eventSource.close();

        // Show error message if offline for more than 5 seconds
        const errorTimeout = setTimeout(() => {
          if (!navigator.onLine) {
            toast.error(t("sync.disconnected"), { duration: Infinity });
          }
        }, 5000);

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
          clearTimeout(errorTimeout);
          if (selectedCalendar && navigator.onLine) {
            console.log("Attempting to reconnect and resync...");
            fetchShifts();
            fetchPresets();
            fetchNotes();
          }
        }, 3000);
      };

      eventSourceRef.current = eventSource;

      return () => {
        eventSource.close();
      };
    } else {
      setShifts([]);
      setPresets([]);
      setNotes([]);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    }
  }, [selectedCalendar]);

  const fetchCalendars = async () => {
    try {
      const response = await fetch("/api/calendars");
      const data = await response.json();
      setCalendars(data);

      // Check if there's a calendar ID in the URL
      const urlCalendarId = searchParams.get("id");

      if (
        urlCalendarId &&
        data.some((cal: CalendarWithCount) => cal.id === urlCalendarId)
      ) {
        // Use the calendar from URL if it exists
        setSelectedCalendar(urlCalendarId);
      } else if (data.length > 0 && !selectedCalendar) {
        // Otherwise, select the first calendar
        setSelectedCalendar(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch calendars:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPresets = async () => {
    if (!selectedCalendar) return;

    try {
      const response = await fetch(
        `/api/presets?calendarId=${selectedCalendar}`
      );
      const data = await response.json();
      setPresets(data);
    } catch (error) {
      console.error("Failed to fetch presets:", error);
    }
  };

  const fetchShifts = async () => {
    if (!selectedCalendar) return;

    try {
      const response = await fetch(
        `/api/shifts?calendarId=${selectedCalendar}`
      );
      const data = await response.json();
      setShifts(data);
    } catch (error) {
      console.error("Failed to fetch shifts:", error);
    }
  };

  const fetchNotes = async () => {
    if (!selectedCalendar) return;

    try {
      const response = await fetch(`/api/notes?calendarId=${selectedCalendar}`);
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes:", error);
    }
  };

  const createCalendar = async (
    name: string,
    color: string,
    password?: string
  ) => {
    try {
      const response = await fetch("/api/calendars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, color, password }),
      });
      const newCalendar = await response.json();
      setCalendars([...calendars, newCalendar]);
      setSelectedCalendar(newCalendar.id);
      toast.success(t("calendar.created"));
    } catch (error) {
      console.error("Failed to create calendar:", error);
      toast.error(t("calendar.createError"));
    }
  };

  const initiateDeleteCalendar = (id: string) => {
    setCalendarToDelete(id);
    setShowDeleteCalendarDialog(true);
  };

  const deleteCalendar = async (password?: string) => {
    if (!calendarToDelete) return;

    try {
      const url = password
        ? `/api/calendars/${calendarToDelete}?password=${encodeURIComponent(
            password
          )}`
        : `/api/calendars/${calendarToDelete}`;

      const response = await fetch(url, { method: "DELETE" });

      if (response.status === 401) {
        toast.error(t("password.errorIncorrect"));
        return;
      }

      if (response.ok) {
        const remainingCalendars = calendars.filter(
          (c) => c.id !== calendarToDelete
        );
        setCalendars(remainingCalendars);
        localStorage.removeItem(`calendar_password_${calendarToDelete}`);

        // If deleting the selected calendar, select the first remaining one or undefined
        if (selectedCalendar === calendarToDelete) {
          setSelectedCalendar(
            remainingCalendars.length > 0 ? remainingCalendars[0].id : undefined
          );
        }

        setShowDeleteCalendarDialog(false);
        setCalendarToDelete(undefined);
        toast.success(t("calendar.deleted"));
      }
    } catch (error) {
      console.error("Failed to delete calendar:", error);
      toast.error(t("calendar.deleteError"));
    }
  };

  const createShift = async (formData: ShiftFormData) => {
    if (!selectedCalendar) return;

    // Optimistic update: add shift immediately with temporary ID
    const tempId = `temp-${Date.now()}`;
    const optimisticShift: ShiftWithCalendar = {
      id: tempId,
      date: new Date(formData.date),
      startTime: formData.startTime,
      endTime: formData.endTime,
      title: formData.title,
      color: formData.color || "#000000",
      notes: formData.notes || null,
      isAllDay: formData.isAllDay || false,
      calendarId: selectedCalendar,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    setShifts([...shifts, optimisticShift]);
    setStatsRefreshTrigger((prev) => prev + 1);

    try {
      const response = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          calendarId: selectedCalendar,
        }),
      });
      const newShift = await response.json();
      // Replace optimistic shift with real one
      setShifts((shifts) =>
        shifts.map((s) => (s.id === tempId ? newShift : s))
      );
      toast.success(t("shift.created"));
    } catch (error) {
      console.error("Failed to create shift:", error);
      // Rollback optimistic update on error
      setShifts((shifts) => shifts.filter((s) => s.id !== tempId));
      setStatsRefreshTrigger((prev) => prev + 1);
      toast.error(t("shift.createError"));
    }
  };

  const updateShift = async (id: string, formData: ShiftFormData) => {
    try {
      // Get stored password from localStorage
      const password = selectedCalendar
        ? localStorage.getItem(`calendar_password_${selectedCalendar}`)
        : null;

      const response = await fetch(`/api/shifts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, password }),
      });

      if (response.status === 401) {
        // Password required or invalid
        setPendingAction({ type: "edit", shiftId: id, formData });
        setShowPasswordDialog(true);
        return;
      }

      const updatedShift = await response.json();
      setShifts(shifts.map((s) => (s.id === id ? updatedShift : s)));
      setStatsRefreshTrigger((prev) => prev + 1);
      toast.success(t("shift.updated"));
    } catch (error) {
      console.error("Failed to update shift:", error);
      toast.error(t("shift.updateError"));
    }
  };

  const deleteShift = async (id: string) => {
    try {
      // Get stored password from localStorage
      const password = selectedCalendar
        ? localStorage.getItem(`calendar_password_${selectedCalendar}`)
        : null;

      const url = password
        ? `/api/shifts/${id}?password=${encodeURIComponent(password)}`
        : `/api/shifts/${id}`;

      const response = await fetch(url, { method: "DELETE" });

      if (response.status === 401) {
        // Password required or invalid
        setPendingAction({ type: "delete", shiftId: id });
        setShowPasswordDialog(true);
        return;
      }

      setShifts(shifts.filter((s) => s.id !== id));
      setStatsRefreshTrigger((prev) => prev + 1);
      toast.success(t("shift.deleted"));
    } catch (error) {
      console.error("Failed to delete shift:", error);
      toast.error(t("shift.deleteError"));
    }
  };

  const handlePasswordSuccess = async (password: string) => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "delete" && pendingAction.shiftId) {
        const response = await fetch(
          `/api/shifts/${pendingAction.shiftId}?password=${encodeURIComponent(
            password
          )}`,
          { method: "DELETE" }
        );
        if (response.ok) {
          setShifts(shifts.filter((s) => s.id !== pendingAction.shiftId));
          setStatsRefreshTrigger((prev) => prev + 1); // Refresh stats
        }
      } else if (
        pendingAction.type === "edit" &&
        pendingAction.shiftId &&
        pendingAction.formData
      ) {
        const response = await fetch(`/api/shifts/${pendingAction.shiftId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...pendingAction.formData, password }),
        });
        if (response.ok) {
          const updatedShift = await response.json();
          setShifts(
            shifts.map((s) =>
              s.id === pendingAction.shiftId ? updatedShift : s
            )
          );
          setStatsRefreshTrigger((prev) => prev + 1);
        }
      } else if (pendingAction.presetAction) {
        // Execute the pending preset action
        await pendingAction.presetAction();
      }
    } catch (error) {
      console.error("Failed to execute pending action:", error);
    } finally {
      setPendingAction(null);
    }
  };

  const handlePresetPasswordRequired = async (action: () => Promise<void>) => {
    setPendingAction({ type: "edit", presetAction: action });
    setShowPasswordDialog(true);
  };

  const createNote = async (noteText: string, date: Date) => {
    if (!selectedCalendar) return;

    try {
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          calendarId: selectedCalendar,
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

  const handleNoteSubmit = (noteText: string) => {
    if (selectedNote) {
      updateNote(selectedNote.id, noteText);
    } else if (selectedDate) {
      createNote(noteText, selectedDate);
    }
  };

  const handleNoteDelete = () => {
    if (selectedNote) {
      deleteNote(selectedNote.id);
    }
  };

  const handleDayRightClick = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    setSelectedDate(date);
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    setSelectedNote(existingNote);
    setShowNoteDialog(true);
  };

  const handleNoteIconClick = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    setSelectedDate(date);
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    setSelectedNote(existingNote);
    setShowNoteDialog(true);
  };

  const handleLongPress = (date: Date) => {
    setSelectedDate(date);
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    setSelectedNote(existingNote);
    setShowNoteDialog(true);
  };

  const handleNoteDialogChange = (open: boolean) => {
    setShowNoteDialog(open);
    if (!open) {
      setSelectedNote(undefined);
    }
  };

  const handleShiftSubmit = (formData: ShiftFormData) => {
    createShift(formData);
  };

  const handleManualShiftCreation = async () => {
    if (!selectedCalendar) return;

    try {
      const password = localStorage.getItem(
        `calendar_password_${selectedCalendar}`
      );

      // Verify password if calendar is protected
      const response = await fetch(
        `/api/calendars/${selectedCalendar}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (data.protected && !data.valid) {
        // Password required or invalid
        localStorage.removeItem(`calendar_password_${selectedCalendar}`);
        setPendingAction({
          type: "edit",
          presetAction: handleManualShiftCreation,
        });
        setShowPasswordDialog(true);
        return;
      }

      // Password valid or not required, open shift dialog
      setSelectedDate(new Date());
      setShowShiftDialog(true);
    } catch (error) {
      console.error("Failed to verify password:", error);
      toast.error(t("password.errorVerification"));
    }
  };

  const handleAddShift = async (date: Date) => {
    // Prevent multiple simultaneous toggles (debouncing)
    if (isTogglingShift) return;

    // Only proceed if a preset is selected
    if (!selectedPresetId) return;

    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    // Check password before adding/deleting shift
    const checkAndToggle = async () => {
      setIsTogglingShift(true);

      try {
        const password = selectedCalendar
          ? localStorage.getItem(`calendar_password_${selectedCalendar}`)
          : null;

        // Verify password if calendar is protected
        if (selectedCalendar) {
          const response = await fetch(
            `/api/calendars/${selectedCalendar}/verify-password`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password }),
            }
          );

          const data = await response.json();

          if (data.protected && !data.valid) {
            // Password required or invalid
            localStorage.removeItem(`calendar_password_${selectedCalendar}`);
            setPendingAction({
              type: "edit",
              presetAction: () => handleAddShift(date),
            });
            setShowPasswordDialog(true);
            setIsTogglingShift(false);
            return;
          }
        }

        // Password valid or not required, proceed with toggle
        // Check if a shift with the same preset already exists on this date
        const existingShift = shifts.find(
          (shift) =>
            shift.date &&
            isSameDay(new Date(shift.date), date) &&
            shift.title === preset.title &&
            shift.startTime === preset.startTime &&
            shift.endTime === preset.endTime
        );

        if (existingShift) {
          // Toggle: remove the existing shift
          // Optimistic delete
          setShifts(shifts.filter((s) => s.id !== existingShift.id));
          setStatsRefreshTrigger((prev) => prev + 1);

          try {
            const password = selectedCalendar
              ? localStorage.getItem(`calendar_password_${selectedCalendar}`)
              : null;
            const url = password
              ? `/api/shifts/${existingShift.id}?password=${encodeURIComponent(
                  password
                )}`
              : `/api/shifts/${existingShift.id}`;
            const response = await fetch(url, { method: "DELETE" });

            if (!response.ok) {
              // Rollback on error
              setShifts(shifts);
              setStatsRefreshTrigger((prev) => prev + 1);
              toast.error(t("shift.deleteError"));
            } else {
              toast.success(t("shift.deleted"));
            }
          } catch (error) {
            console.error("Failed to delete shift:", error);
            // Rollback on error
            setShifts(shifts);
            setStatsRefreshTrigger((prev) => prev + 1);
            toast.error(t("shift.deleteError"));
          }
        } else {
          // Toggle: add the shift
          const shiftData: ShiftFormData = {
            date: formatDateToLocal(date),
            startTime: preset.startTime,
            endTime: preset.endTime,
            title: preset.title,
            color: preset.color,
            notes: preset.notes || "",
            presetId: preset.id,
            isAllDay: preset.isAllDay || false,
          };
          await createShift(shiftData);
        }
      } finally {
        setIsTogglingShift(false);
      }
    };

    await checkAndToggle();
  };

  // Calendar grid calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const getShiftsForDate = (date: Date) => {
    return shifts.filter(
      (shift) => shift.date && isSameDay(new Date(shift.date), date)
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-primary" />
          </motion.div>
          <p className="text-sm sm:text-base text-muted-foreground font-medium">
            {t("common.loading")}
          </p>
        </motion.div>
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <div className="flex-1 flex items-center justify-center p-4">
          <motion.div
            className="text-center space-y-6 max-w-md"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
            >
              <CalendarIcon className="h-10 w-10 text-primary" />
            </motion.div>
            <div className="space-y-3">
              <h1 className="text-2xl sm:text-3xl font-bold">
                {t("onboarding.welcome")}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
                {t("onboarding.description")}
              </p>
            </div>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={() => setShowCalendarDialog(true)}
                size="lg"
                className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20"
              >
                <Plus className="mr-2 h-5 w-5" />
                {t("onboarding.createCalendar")}
              </Button>
            </motion.div>
          </motion.div>
        </div>
        <div className="border-t bg-background">
          <div className="container max-w-4xl mx-auto p-3 sm:p-4 flex justify-center">
            <LanguageSwitcher />
          </div>
        </div>
        <CalendarDialog
          open={showCalendarDialog}
          onOpenChange={setShowCalendarDialog}
          onSubmit={createCalendar}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header - Desktop: Horizontal, Mobile: Compact with Dialog */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {/* Desktop: Logo + Calendar Selector in one line */}
            <div className="hidden sm:flex items-center justify-between gap-4">
              {/* Logo Section */}
              <motion.div
                className="flex items-center gap-3"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="relative shrink-0">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center shadow-xl shadow-primary/30 ring-2 ring-primary/20">
                    <CalendarIcon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  {/* Connection Status Indicator */}
                  <div
                    className={`absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-background transition-colors ${
                      isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"
                    }`}
                    title={
                      isConnected
                        ? t("sync.reconnected")
                        : t("sync.disconnected")
                    }
                  ></div>
                </div>
                <div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text">
                    {t("app.title")}
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium">
                    {t("app.subtitle", { default: "Organize your shifts" })}
                  </p>
                </div>
              </motion.div>

              {/* Calendar Selector - Desktop */}
              <motion.div
                className="flex items-center gap-3 min-w-0 flex-1 max-w-md bg-muted/30 rounded-xl p-2 border border-border/50"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
              >
                <div
                  className="w-1 h-8 bg-gradient-to-b rounded-full transition-colors duration-300"
                  style={{
                    backgroundImage: selectedCalendar
                      ? `linear-gradient(to bottom, ${
                          calendars.find((c) => c.id === selectedCalendar)
                            ?.color || "hsl(var(--primary))"
                        }, ${
                          calendars.find((c) => c.id === selectedCalendar)
                            ?.color || "hsl(var(--primary))"
                        }80)`
                      : "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.5))",
                  }}
                ></div>
                <div className="flex-1 min-w-0">
                  <CalendarSelector
                    calendars={calendars}
                    selectedId={selectedCalendar}
                    onSelect={setSelectedCalendar}
                    onCreateNew={() => setShowCalendarDialog(true)}
                    onManagePassword={() => setShowManagePasswordDialog(true)}
                    onDelete={initiateDeleteCalendar}
                  />
                </div>
              </motion.div>
            </div>

            {/* Mobile: Logo Icon + Calendar Card + Add Button */}
            <div className="sm:hidden flex items-center gap-2">
              {/* Logo Icon Only */}
              <div className="relative shrink-0">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary via-primary/90 to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30 ring-2 ring-primary/20">
                  <CalendarIcon className="h-5 w-5 text-primary-foreground" />
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background"></div>
              </div>

              {/* Calendar Selection Card */}
              <button
                onClick={() => setShowMobileCalendarDialog(true)}
                className="flex-1 bg-muted/30 backdrop-blur-sm border border-border/50 rounded-xl p-3 flex items-center justify-between gap-2 hover:bg-accent/50 transition-all active:scale-[0.98] shadow-sm"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    className="w-1 h-9 bg-gradient-to-b rounded-full transition-colors duration-300"
                    style={{
                      backgroundImage: selectedCalendar
                        ? `linear-gradient(to bottom, ${
                            calendars.find((c) => c.id === selectedCalendar)
                              ?.color || "hsl(var(--primary))"
                          }, ${
                            calendars.find((c) => c.id === selectedCalendar)
                              ?.color || "hsl(var(--primary))"
                          }80)`
                        : "linear-gradient(to bottom, hsl(var(--primary)), hsl(var(--primary) / 0.5))",
                    }}
                  ></div>
                  <div className="min-w-0 flex-1 text-left">
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {t("calendar.select", {
                        default: "Your BetterShift Calendar",
                      })}
                    </p>
                    <p className="text-sm font-semibold truncate">
                      {calendars.find((c) => c.id === selectedCalendar)?.name ||
                        t("calendar.title")}
                    </p>
                  </div>
                </div>
                <div className="shrink-0 w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
              </button>

              {/* Mobile Add Shift Button */}
              {selectedCalendar && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <Button
                    size="icon"
                    onClick={handleManualShiftCreation}
                    className="h-10 w-10 rounded-xl shadow-lg shadow-primary/30 shrink-0"
                  >
                    <Plus className="h-5 w-5" />
                  </Button>
                </motion.div>
              )}
            </div>

            {/* Preset Selector - Aligned properly */}
            <div className="px-0.5 sm:px-0">
              <PresetSelector
                presets={presets}
                selectedPresetId={selectedPresetId}
                onSelectPreset={setSelectedPresetId}
                onPresetsChange={fetchPresets}
                onShiftsChange={fetchShifts}
                calendarId={selectedCalendar || ""}
                onPasswordRequired={handlePresetPasswordRequired}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Calendar Dialog */}
      <Dialog
        open={showMobileCalendarDialog}
        onOpenChange={setShowMobileCalendarDialog}
      >
        <DialogContent className="sm:max-w-md p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
          <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
            <DialogTitle className="flex items-center gap-2.5 text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("calendar.select", { default: "Your BetterShift Calendar" })}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("calendar.selectDescription", {
                default: "Choose a calendar to manage your shifts",
              })}
            </DialogDescription>
          </DialogHeader>
          <div className="p-6">
            <CalendarSelector
              calendars={calendars}
              selectedId={selectedCalendar}
              onSelect={(id) => {
                setSelectedCalendar(id);
                setShowMobileCalendarDialog(false);
              }}
              onCreateNew={() => {
                setShowMobileCalendarDialog(false);
                setShowCalendarDialog(true);
              }}
              onManagePassword={() => {
                setShowMobileCalendarDialog(false);
                setShowManagePasswordDialog(true);
              }}
              onDelete={initiateDeleteCalendar}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Month Navigation */}
      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
        <motion.div
          className="flex items-center justify-between mb-4 sm:mb-5 px-2 sm:px-0"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-full active:scale-95 transition-transform"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <motion.h2
            className="text-lg sm:text-xl font-bold"
            key={format(currentDate, "MMMM yyyy")}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            {format(currentDate, "MMMM yyyy", { locale: dateLocale })}
          </motion.h2>
          <Button
            variant="outline"
            size="icon"
            className="h-10 w-10 sm:h-11 sm:w-11 rounded-full active:scale-95 transition-transform"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </motion.div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-0 sm:gap-1.5 mb-6">
          {[
            t("calendar_grid.monday"),
            t("calendar_grid.tuesday"),
            t("calendar_grid.wednesday"),
            t("calendar_grid.thursday"),
            t("calendar_grid.friday"),
            t("calendar_grid.saturday"),
            t("calendar_grid.sunday"),
          ].map((day) => (
            <div
              key={day}
              className="text-center text-[11px] sm:text-xs font-semibold text-muted-foreground p-1 sm:p-2"
            >
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const dayShifts = getShiftsForDate(day);
            const dayNote = notes.find(
              (note) => note.date && isSameDay(new Date(note.date), day)
            );
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isTodayDate = isToday(day);

            // Long press handling for mobile
            let pressTimer: NodeJS.Timeout | null = null;
            const handleTouchStart = (e: React.TouchEvent) => {
              pressTimer = setTimeout(() => handleLongPress(day), 500);
            };
            const handleTouchEnd = () => {
              if (pressTimer) clearTimeout(pressTimer);
            };

            return (
              <motion.button
                key={idx}
                onClick={() => handleAddShift(day)}
                onContextMenu={(e) => handleDayRightClick(e, day)}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
                disabled={false}
                whileTap={{ scale: 0.95 }}
                style={{
                  WebkitUserSelect: "none",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                }}
                className={`
                  min-h-25 sm:min-h-28 px-1 py-1.5 sm:p-2.5 rounded-md sm:rounded-lg text-sm transition-all relative flex flex-col border sm:border-2
                  ${
                    isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }
                  ${
                    isTodayDate
                      ? "border-primary shadow-lg shadow-primary/20 bg-primary/5 ring-2 ring-primary/20"
                      : "border-border/30 sm:border-border/50"
                  }
                  ${
                    isCurrentMonth
                      ? "hover:bg-accent cursor-pointer active:bg-accent/80 hover:border-border"
                      : selectedPresetId
                      ? "cursor-not-allowed"
                      : "cursor-pointer"
                  }
                  ${!isCurrentMonth ? "opacity-40" : ""}
                `}
              >
                <div
                  className={`text-sm sm:text-sm font-semibold mb-1 flex items-center justify-between ${
                    isTodayDate ? "text-primary" : ""
                  }`}
                >
                  <span>{day.getDate()}</span>
                  {dayNote && (
                    <motion.div
                      className="group/note relative"
                      onClick={(e) => handleNoteIconClick(e, day)}
                      title={dayNote.note}
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                    >
                      <StickyNote className="h-3.5 w-3.5 text-orange-500 cursor-pointer hover:text-orange-600 transition-colors" />
                      {/* Tooltip for desktop */}
                      <div className="hidden sm:block absolute z-50 bottom-full right-0 mb-1 invisible group-hover/note:visible opacity-0 group-hover/note:opacity-100 transition-opacity duration-200">
                        <div className="bg-popover text-popover-foreground text-xs rounded-md shadow-lg border p-2 max-w-[200px] whitespace-normal break-words">
                          {dayNote.note}
                          <div className="absolute top-full right-2 -mt-1 border-4 border-transparent border-t-popover"></div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 space-y-0.5 sm:space-y-1 overflow-hidden">
                  {dayShifts.slice(0, 2).map((shift) => (
                    <div
                      key={shift.id}
                      className="text-[10px] sm:text-xs px-0.5 py-0.5 sm:px-1.5 sm:py-1 rounded"
                      style={{
                        backgroundColor: shift.color
                          ? `${shift.color}20`
                          : "#3b82f620",
                        borderLeft: `2px solid ${shift.color || "#3b82f6"}`,
                      }}
                      title={`${shift.title} ${
                        shift.isAllDay
                          ? `(${t("shift.allDay")})`
                          : `(${shift.startTime} - ${shift.endTime})`
                      }`}
                    >
                      <div className="font-semibold line-clamp-2 leading-[1.1] sm:leading-tight">
                        {shift.title}
                      </div>
                      <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight">
                        {shift.isAllDay
                          ? t("shift.allDay")
                          : shift.startTime.substring(0, 5)}
                      </div>
                    </div>
                  ))}
                  {dayShifts.length > 2 && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground font-medium text-center pt-0.5">
                      +{dayShifts.length - 2}
                    </div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Note Hint */}
        <motion.div
          className="px-2 sm:px-0 mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-3 sm:p-3.5 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
                <StickyNote className="h-4 w-4 text-orange-500" />
              </div>
              <div className="flex-1">
                {/* Mobile hint */}
                <p className="text-xs sm:hidden text-foreground/80 leading-relaxed">
                  {t("note.hintMobile", {
                    default:
                      "Long press on a day to open notes. The note icon shows existing notes.",
                  })}
                </p>
                {/* Desktop hint */}
                <p className="hidden sm:block text-sm text-foreground/80 leading-relaxed">
                  {t("note.hintDesktop", {
                    default:
                      "Right-click on a day to open notes. The note icon shows existing notes.",
                  })}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Shifts List */}
        <div className="space-y-3 sm:space-y-4 px-2 sm:px-0">
          {/* Shift Statistics */}
          <ShiftStats
            calendarId={selectedCalendar}
            currentDate={currentDate}
            refreshTrigger={statsRefreshTrigger}
          />

          <div className="border border-border/50 rounded-xl bg-gradient-to-b from-card/80 via-card/60 to-card/40 backdrop-blur-sm overflow-hidden shadow-lg">
            <button
              onClick={() => setShowShiftsSection(!showShiftsSection)}
              className="w-full px-3 sm:px-4 py-3 sm:py-3.5 flex items-center justify-between hover:bg-primary/5 transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20">
                  <CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5 text-primary-foreground" />
                </div>
                <h3 className="text-sm sm:text-base font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                  {t("shift.title")}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                {!showShiftsSection &&
                  (() => {
                    const shiftsInMonth = shifts.filter((shift) => {
                      if (!shift.date) return false;
                      const shiftDate = new Date(shift.date);
                      return (
                        shiftDate.getMonth() === currentDate.getMonth() &&
                        shiftDate.getFullYear() === currentDate.getFullYear()
                      );
                    }).length;
                    return (
                      shiftsInMonth > 0 && (
                        <div className="px-3 py-1.5 bg-primary/10 rounded-full">
                          <span className="font-semibold text-primary text-xs sm:text-sm">
                            {shiftsInMonth}
                          </span>
                        </div>
                      )
                    );
                  })()}
                {showShiftsSection ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </button>

            {showShiftsSection && (
              <div className="border-t border-border/30 bg-muted/20 p-3 sm:p-4">
                {shifts.filter((shift) => {
                  if (!shift.date) return false;
                  const shiftDate = new Date(shift.date);
                  return (
                    shiftDate.getMonth() === currentDate.getMonth() &&
                    shiftDate.getFullYear() === currentDate.getFullYear()
                  );
                }).length === 0 ? (
                  <motion.div
                    className="border-2 border-dashed border-border/50 rounded-xl p-10 sm:p-14 text-center space-y-4 sm:space-y-5"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      className="flex justify-center"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{
                        delay: 0.1,
                        type: "spring",
                        stiffness: 200,
                      }}
                    >
                      <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-lg">
                        <CalendarIcon className="h-8 w-8 sm:h-10 sm:w-10 text-primary/70" />
                      </div>
                    </motion.div>
                    <div className="space-y-2 sm:space-y-2.5">
                      <h4 className="font-bold text-lg sm:text-xl text-foreground/90">
                        {t("shift.noShiftsInMonth", {
                          default: "No shifts this month",
                        })}
                      </h4>
                      <p className="text-sm sm:text-base text-muted-foreground max-w-md mx-auto leading-relaxed">
                        {t("shift.noShiftsInMonthDescription", {
                          default:
                            "Add shifts by clicking on days in the calendar above.",
                        })}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    <motion.div
                      className="space-y-3 sm:space-y-4"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ staggerChildren: 0.05 }}
                    >
                      {Object.entries(
                        shifts
                          .filter((shift) => {
                            if (!shift.date) return false;
                            const shiftDate = new Date(shift.date);
                            return (
                              shiftDate.getMonth() === currentDate.getMonth() &&
                              shiftDate.getFullYear() ===
                                currentDate.getFullYear()
                            );
                          })
                          .sort(
                            (a, b) =>
                              (a.date ? new Date(a.date).getTime() : 0) -
                              (b.date ? new Date(b.date).getTime() : 0)
                          )
                          .reduce((acc, shift) => {
                            const dateKey = shift.date
                              ? format(new Date(shift.date), "yyyy-MM-dd")
                              : "unknown";
                            if (!acc[dateKey]) acc[dateKey] = [];
                            acc[dateKey].push(shift);
                            return acc;
                          }, {} as Record<string, ShiftWithCalendar[]>)
                      ).map(([dateKey, dayShifts], index) => (
                        <motion.div
                          key={dateKey}
                          className="border border-border/50 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all bg-gradient-to-b from-card via-card to-muted/20"
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          layout
                        >
                          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 sm:px-5 py-2.5 sm:py-3 border-b border-border/30">
                            <div className="flex items-center justify-between">
                              <div className="font-bold text-sm sm:text-base flex items-center gap-2">
                                <div className="w-1 h-5 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                                {dayShifts[0].date &&
                                  format(
                                    new Date(dayShifts[0].date),
                                    "EEEE, MMMM d, yyyy",
                                    { locale: dateLocale }
                                  )}
                              </div>
                              <div className="text-xs sm:text-sm px-2.5 py-1 bg-primary/15 text-primary rounded-full font-semibold shadow-sm">
                                {dayShifts.length}{" "}
                                {dayShifts.length === 1
                                  ? t("shift.shift_one")
                                  : t("shift.shifts")}
                              </div>
                            </div>
                          </div>
                          <div className="p-3 sm:p-4 grid gap-2 sm:gap-3 sm:grid-cols-2">
                            {dayShifts.map((shift) => (
                              <ShiftCard
                                key={shift.id}
                                shift={shift}
                                onDelete={deleteShift}
                              />
                            ))}
                          </div>
                        </motion.div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Action Button for Manual Shift Creation - Desktop Only */}
      {selectedCalendar && (
        <motion.div
          className="hidden sm:block fixed bottom-6 right-6 z-50"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          <Button
            size="lg"
            className="h-16 w-16 rounded-full shadow-2xl shadow-primary/30 hover:shadow-primary/50 transition-all"
            onClick={handleManualShiftCreation}
          >
            <Plus className="h-7 w-7" />
          </Button>
        </motion.div>
      )}

      {/* Dialogs */}
      <CalendarDialog
        open={showCalendarDialog}
        onOpenChange={setShowCalendarDialog}
        onSubmit={createCalendar}
      />
      <ShiftDialog
        open={showShiftDialog}
        onOpenChange={setShowShiftDialog}
        onSubmit={handleShiftSubmit}
        selectedDate={selectedDate}
        onPresetsChange={fetchPresets}
        calendarId={selectedCalendar}
      />
      {selectedCalendar && (
        <PasswordDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          calendarId={selectedCalendar}
          calendarName={
            calendars.find((c) => c.id === selectedCalendar)?.name || ""
          }
          onSuccess={handlePasswordSuccess}
        />
      )}
      {selectedCalendar && (
        <ManagePasswordDialog
          open={showManagePasswordDialog}
          onOpenChange={setShowManagePasswordDialog}
          calendarId={selectedCalendar}
          calendarName={
            calendars.find((c) => c.id === selectedCalendar)?.name || ""
          }
          hasPassword={
            !!calendars.find((c) => c.id === selectedCalendar)?.passwordHash
          }
          onSuccess={() => {
            fetchCalendars();
          }}
        />
      )}
      <NoteDialog
        open={showNoteDialog}
        onOpenChange={handleNoteDialogChange}
        onSubmit={handleNoteSubmit}
        onDelete={selectedNote ? handleNoteDelete : undefined}
        selectedDate={selectedDate}
        note={selectedNote}
      />
      {calendarToDelete && (
        <DeleteCalendarDialog
          open={showDeleteCalendarDialog}
          onOpenChange={setShowDeleteCalendarDialog}
          calendarName={
            calendars.find((c) => c.id === calendarToDelete)?.name || ""
          }
          hasPassword={
            !!calendars.find((c) => c.id === calendarToDelete)?.passwordHash
          }
          onConfirm={deleteCalendar}
        />
      )}

      {/* Footer */}
      <div className="border-t bg-background mt-auto">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4 flex justify-between items-center">
          <LanguageSwitcher />
          {version && (
            <div className="text-xs text-muted-foreground font-mono">
              {t("version.label")}: {version}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  );
}
