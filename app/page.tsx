"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { CalendarDialog } from "@/components/calendar-dialog";
import { ShiftDialog, ShiftFormData } from "@/components/shift-dialog";
import { PasswordDialog } from "@/components/password-dialog";
import { ManagePasswordDialog } from "@/components/manage-password-dialog";
import { DeleteCalendarDialog } from "@/components/delete-calendar-dialog";
import { ICloudSyncManageDialog } from "@/components/icloud-sync-manage-dialog";
import { DayShiftsDialog } from "@/components/day-shifts-dialog";
import { LanguageSwitcher } from "@/components/language-switcher";
import { ShiftStats } from "@/components/shift-stats";
import { NoteDialog } from "@/components/note-dialog";
import { AppHeader } from "@/components/app-header";
import { CalendarGrid } from "@/components/calendar-grid";
import { ShiftsList } from "@/components/shifts-list";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
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
  startOfWeek,
  endOfWeek,
} from "date-fns";
import { de, enUS } from "date-fns/locale";
import { CalendarNote, ShiftPreset } from "@/lib/db/schema";
import { ShiftWithCalendar } from "@/lib/types";
import { formatDateToLocal } from "@/lib/date-utils";
import { toast } from "sonner";
import { motion } from "motion/react";
import { useCalendars } from "@/hooks/useCalendars";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { useNotes } from "@/hooks/useNotes";
import { useSSEConnection } from "@/hooks/useSSEConnection";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "de" ? de : enUS;

  // Custom hooks for data management
  const {
    calendars,
    selectedCalendar,
    setSelectedCalendar,
    loading,
    createCalendar: createCalendarHook,
    deleteCalendar: deleteCalendarHook,
    refetchCalendars,
  } = useCalendars(searchParams.get("id"));

  const {
    shifts,
    setShifts,
    createShift: createShiftHook,
    updateShift: updateShiftHook,
    deleteShift: deleteShiftHook,
    refetchShifts,
  } = useShifts(selectedCalendar);

  const { presets, refetchPresets } = usePresets(selectedCalendar);

  const {
    notes,
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
    refetchNotes,
  } = useNotes(selectedCalendar);

  // Local state
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
  const [showICloudSyncDialog, setShowICloudSyncDialog] = useState(false);
  const [showDayShiftsDialog, setShowDayShiftsDialog] = useState(false);
  const [selectedDayDate, setSelectedDayDate] = useState<Date | null>(null);
  const [selectedDayShifts, setSelectedDayShifts] = useState<
    ShiftWithCalendar[]
  >([]);
  const [calendarToDelete, setCalendarToDelete] = useState<
    string | undefined
  >();
  const [selectedNote, setSelectedNote] = useState<CalendarNote | undefined>();
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "edit";
    shiftId?: string;
    formData?: ShiftFormData;
    presetAction?: () => Promise<void>;
    noteAction?: () => Promise<void>;
  } | null>(null);
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [togglingDates, setTogglingDates] = useState<Set<string>>(new Set());
  const [isConnected, setIsConnected] = useState(true);
  const [version, setVersion] = useState<string | null>(null);

  // SSE Connection for real-time updates
  useSSEConnection({
    calendarId: selectedCalendar,
    onShiftUpdate: refetchShifts,
    onPresetUpdate: refetchPresets,
    onNoteUpdate: refetchNotes,
    onStatsRefresh: () => setStatsRefreshTrigger((prev) => prev + 1),
    isConnected,
    setIsConnected,
  });

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

  useEffect(() => {
    fetchVersion();
  }, []);

  // Update URL when selected calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, router]);

  const initiateDeleteCalendar = (id: string) => {
    setCalendarToDelete(id);
    setShowDeleteCalendarDialog(true);
  };

  const handleICloudSyncClick = async () => {
    if (!selectedCalendar) return;

    const calendar = calendars.find((c) => c.id === selectedCalendar);
    if (!calendar) return;

    // Check if calendar is password protected
    if (calendar.passwordHash) {
      const storedPassword = localStorage.getItem(
        `calendar_password_${selectedCalendar}`
      );

      if (storedPassword) {
        // Verify stored password
        try {
          const response = await fetch(
            `/api/calendars/${selectedCalendar}/verify-password`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ password: storedPassword }),
            }
          );

          if (response.ok) {
            setShowICloudSyncDialog(true);
            return;
          } else {
            // Password invalid, remove from storage
            localStorage.removeItem(`calendar_password_${selectedCalendar}`);
          }
        } catch (error) {
          console.error("Password verification failed:", error);
        }
      }

      // Show password dialog
      setPendingAction({
        type: "edit",
        presetAction: async () => {
          setShowICloudSyncDialog(true);
        },
      });
      setShowPasswordDialog(true);
    } else {
      // No password protection
      setShowICloudSyncDialog(true);
    }
  };

  const handleDeleteCalendar = async (password?: string) => {
    if (!calendarToDelete) return;

    const success = await deleteCalendarHook(calendarToDelete, password);
    if (success) {
      setShowDeleteCalendarDialog(false);
      setCalendarToDelete(undefined);
    }
  };

  const handlePasswordSuccess = async (password: string) => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "delete" && pendingAction.shiftId) {
        const response = await fetch(`/api/shifts/${pendingAction.shiftId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ password }),
        });
        if (response.ok) {
          setShifts(shifts.filter((s) => s.id !== pendingAction.shiftId));
          setStatsRefreshTrigger((prev) => prev + 1);
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
        await pendingAction.presetAction();
      } else if (pendingAction.noteAction) {
        await pendingAction.noteAction();
        setShowNoteDialog(false);
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

  const handleNoteSubmit = async (noteText: string) => {
    const handlePasswordRequired = () => {
      setPendingAction({
        type: "edit",
        noteAction: async () => {
          if (selectedNote) {
            await updateNoteHook(
              selectedNote.id,
              noteText,
              handlePasswordRequired
            );
          } else if (selectedDate) {
            await createNoteHook(
              noteText,
              selectedDate,
              handlePasswordRequired
            );
          }
        },
      });
      setShowPasswordDialog(true);
    };

    if (selectedNote) {
      const success = await updateNoteHook(
        selectedNote.id,
        noteText,
        handlePasswordRequired
      );
      if (success) {
        setShowNoteDialog(false);
      }
    } else if (selectedDate) {
      const success = await createNoteHook(
        noteText,
        selectedDate,
        handlePasswordRequired
      );
      if (success) {
        setShowNoteDialog(false);
      }
    }
  };

  const handleNoteDelete = async () => {
    if (!selectedNote) return;

    const handlePasswordRequired = () => {
      setPendingAction({
        type: "delete",
        noteAction: async () => {
          if (selectedNote) {
            await deleteNoteHook(selectedNote.id, handlePasswordRequired);
          }
        },
      });
      setShowPasswordDialog(true);
    };

    const success = await deleteNoteHook(
      selectedNote.id,
      handlePasswordRequired
    );
    if (success) {
      setShowNoteDialog(false);
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

  const handleDayClick = (date: Date) => {
    handleAddShift(date);
  };

  const handleLongPressDay = (date: Date) => {
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
    createShiftHook(formData);
    setStatsRefreshTrigger((prev) => prev + 1);
  };

  const handleUpdateShift = async (id: string, formData: ShiftFormData) => {
    const success = await updateShiftHook(id, formData, () => {
      setPendingAction({ type: "edit", shiftId: id, formData });
      setShowPasswordDialog(true);
    });
    if (success) {
      setStatsRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleDeleteShift = async (id: string) => {
    const success = await deleteShiftHook(id, () => {
      setPendingAction({ type: "delete", shiftId: id });
      setShowPasswordDialog(true);
    });
    if (success) {
      setStatsRefreshTrigger((prev) => prev + 1);
    }
  };

  const handleManualShiftCreation = async () => {
    if (!selectedCalendar) return;

    try {
      const password = localStorage.getItem(
        `calendar_password_${selectedCalendar}`
      );

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
        localStorage.removeItem(`calendar_password_${selectedCalendar}`);
        setPendingAction({
          type: "edit",
          presetAction: handleManualShiftCreation,
        });
        setShowPasswordDialog(true);
        return;
      }

      setSelectedDate(new Date());
      setShowShiftDialog(true);
    } catch (error) {
      console.error("Failed to verify password:", error);
      toast.error(t("password.errorVerification"));
    }
  };

  const handleShowAllShifts = (date: Date, dayShifts: ShiftWithCalendar[]) => {
    setSelectedDayDate(date);
    setSelectedDayShifts(dayShifts);
    setShowDayShiftsDialog(true);
  };

  const handleDeleteShiftFromDayDialog = async (shiftId: string) => {
    setShowDayShiftsDialog(false);
    await handleDeleteShift(shiftId);
    // Refresh the shifts after deletion
    refetchShifts();
  };

  const handleAddShift = async (date: Date) => {
    if (!selectedPresetId) return;

    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    // Capture date immediately to prevent wrong date assignment
    const targetDate = new Date(date);
    const dateKey = formatDateToLocal(targetDate);

    // Check if this date is already being toggled
    if (togglingDates.has(dateKey)) return;

    // Add date to toggling set
    setTogglingDates((prev) => new Set(prev).add(dateKey));

    try {
      const password = selectedCalendar
        ? localStorage.getItem(`calendar_password_${selectedCalendar}`)
        : null;

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
          localStorage.removeItem(`calendar_password_${selectedCalendar}`);
          setPendingAction({
            type: "edit",
            presetAction: () => handleAddShift(targetDate),
          });
          setShowPasswordDialog(true);
          setTogglingDates((prev) => {
            const next = new Set(prev);
            next.delete(dateKey);
            return next;
          });
          return;
        }
      }

      const existingShift = shifts.find(
        (shift) =>
          shift.date &&
          isSameDay(new Date(shift.date), targetDate) &&
          shift.title === preset.title &&
          shift.startTime === preset.startTime &&
          shift.endTime === preset.endTime
      );

      if (existingShift) {
        // Optimistic UI update - remove shift immediately
        const previousShifts = [...shifts];
        setShifts(shifts.filter((s) => s.id !== existingShift.id));
        setStatsRefreshTrigger((prev) => prev + 1);

        try {
          const response = await fetch(`/api/shifts/${existingShift.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ password }),
          });

          if (!response.ok) {
            // Revert on error
            setShifts(previousShifts);
            setStatsRefreshTrigger((prev) => prev + 1);
            toast.error(t("shift.deleteError"));
          } else {
            toast.success(t("shift.deleted"));
          }
        } catch (error) {
          console.error("Failed to delete shift:", error);
          // Revert on error
          setShifts(previousShifts);
          setStatsRefreshTrigger((prev) => prev + 1);
          toast.error(t("shift.deleteError"));
        }
      } else {
        const shiftData: ShiftFormData = {
          date: dateKey,
          startTime: preset.startTime,
          endTime: preset.endTime,
          title: preset.title,
          color: preset.color,
          notes: preset.notes || "",
          presetId: preset.id,
          isAllDay: preset.isAllDay || false,
        };

        const newShift = await createShiftHook(shiftData);
        if (newShift) {
          setStatsRefreshTrigger((prev) => prev + 1);
        }
      }
    } finally {
      // Remove date from toggling set
      setTogglingDates((prev) => {
        const next = new Set(prev);
        next.delete(dateKey);
        return next;
      });
    }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
        <motion.div
          className="text-center space-y-4"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
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
          onSubmit={createCalendarHook}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <AppHeader
        calendars={calendars}
        selectedCalendar={selectedCalendar}
        presets={presets}
        selectedPresetId={selectedPresetId}
        isConnected={isConnected}
        showMobileCalendarDialog={showMobileCalendarDialog}
        onSelectCalendar={setSelectedCalendar}
        onSelectPreset={setSelectedPresetId}
        onCreateCalendar={() => setShowCalendarDialog(true)}
        onManagePassword={() => setShowManagePasswordDialog(true)}
        onDeleteCalendar={initiateDeleteCalendar}
        onICloudSync={handleICloudSyncClick}
        onPresetsChange={refetchPresets}
        onShiftsChange={refetchShifts}
        onPasswordRequired={handlePresetPasswordRequired}
        onManualShiftCreation={handleManualShiftCreation}
        onMobileCalendarDialogChange={setShowMobileCalendarDialog}
      />

      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
        {/* Month Navigation */}
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
        <CalendarGrid
          calendarDays={calendarDays}
          currentDate={currentDate}
          shifts={shifts}
          notes={notes}
          selectedPresetId={selectedPresetId}
          togglingDates={togglingDates}
          onDayClick={handleDayClick}
          onDayRightClick={handleDayRightClick}
          onNoteIconClick={handleNoteIconClick}
          onLongPress={handleLongPressDay}
          onShowAllShifts={handleShowAllShifts}
        />

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
                <p className="text-xs sm:hidden text-foreground/80 leading-relaxed">
                  {t("note.hintMobile", {
                    default:
                      "Long press on a day to open notes. The note icon shows existing notes.",
                  })}
                </p>
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
          <ShiftStats
            calendarId={selectedCalendar}
            currentDate={currentDate}
            refreshTrigger={statsRefreshTrigger}
          />

          <ShiftsList
            shifts={shifts}
            currentDate={currentDate}
            onDeleteShift={handleDeleteShift}
          />
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
        onSubmit={createCalendarHook}
      />
      <ShiftDialog
        open={showShiftDialog}
        onOpenChange={setShowShiftDialog}
        onSubmit={handleShiftSubmit}
        selectedDate={selectedDate}
        onPresetsChange={refetchPresets}
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
          onSuccess={refetchCalendars}
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
          onConfirm={handleDeleteCalendar}
        />
      )}
      {selectedCalendar && (
        <ICloudSyncManageDialog
          open={showICloudSyncDialog}
          onOpenChange={setShowICloudSyncDialog}
          calendarId={selectedCalendar}
          onSyncComplete={() => {
            refetchShifts();
            refetchCalendars();
            setStatsRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}

      {/* Day Shifts Dialog */}
      <DayShiftsDialog
        open={showDayShiftsDialog}
        onOpenChange={setShowDayShiftsDialog}
        date={selectedDayDate}
        shifts={selectedDayShifts}
        locale={locale}
        onDeleteShift={handleDeleteShiftFromDayDialog}
      />

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
