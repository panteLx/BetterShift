"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale } from "next-intl";
import { isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { getDateLocale } from "@/lib/locales";
import { motion } from "motion/react";
import { ShiftWithCalendar } from "@/lib/types";
import { useCalendars } from "@/hooks/useCalendars";
import { useShifts } from "@/hooks/useShifts";
import { usePresets } from "@/hooks/usePresets";
import { useNotes } from "@/hooks/useNotes";
import { useSSEConnection } from "@/hooks/useSSEConnection";
import { usePasswordManagement } from "@/hooks/usePasswordManagement";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useShiftActions } from "@/hooks/useShiftActions";
import { useNoteActions } from "@/hooks/useNoteActions";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useDialogStates } from "@/hooks/useDialogStates";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { EmptyCalendarState } from "@/components/empty-calendar-state";
import { LockedCalendarView } from "@/components/locked-calendar-view";
import { CalendarSkeleton } from "@/components/calendar-skeleton";
import { CalendarContentSkeleton } from "@/components/calendar-content-skeleton";
import { LockedCalendarSkeleton } from "@/components/locked-calendar-skeleton";
import { CalendarContent } from "@/components/calendar-content";
import { AppFooter } from "@/components/app-footer";
import { AppHeader } from "@/components/app-header";
import { DialogManager } from "@/components/dialog-manager";
import { getCalendarDays } from "@/lib/calendar-utils";
import { getCachedPassword } from "@/lib/password-cache";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  // Data hooks
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
    loading: shiftsLoading,
    createShift: createShiftHook,
    updateShift: updateShiftHook,
    deleteShift: deleteShiftHook,
    refetchShifts,
  } = useShifts(selectedCalendar);

  const {
    presets,
    loading: presetsLoading,
    refetchPresets,
  } = usePresets(selectedCalendar);

  const {
    notes,
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
    refetchNotes,
  } = useNotes(selectedCalendar);

  // External sync management
  const {
    externalSyncs,
    hasSyncErrors,
    syncLogRefreshTrigger,
    setSyncLogRefreshTrigger,
    fetchExternalSyncs,
    fetchSyncErrorStatus,
  } = useExternalSync(selectedCalendar || null);

  // Password management
  const {
    pendingAction,
    setPendingAction,
    isCalendarUnlocked,
    setIsCalendarUnlocked,
    isVerifyingCalendarPassword,
    shouldHideUIElements,
    handlePasswordSuccess: baseHandlePasswordSuccess,
    verifyPasswordForAction,
  } = usePasswordManagement(selectedCalendar || null, calendars);

  // View settings
  const viewSettings = useViewSettings();

  // Dialog states
  const dialogStates = useDialogStates();

  // Note actions
  const noteActions = useNoteActions({
    createNote: createNoteHook,
    updateNote: updateNoteHook,
    deleteNote: deleteNoteHook,
    onPasswordRequired: (action) => {
      setPendingAction({ type: "edit", action });
      dialogStates.setShowPasswordDialog(true);
    },
  });

  // Local state
  const [selectedPresetId, setSelectedPresetId] = useState<
    string | undefined
  >();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [statsRefreshTrigger, setStatsRefreshTrigger] = useState(0);
  const [isConnected, setIsConnected] = useState(true);

  // Version info
  const versionInfo = useVersionInfo();

  // Shift actions
  const shiftActions = useShiftActions({
    selectedCalendar: selectedCalendar || null,
    shifts,
    setShifts,
    presets,
    createShift: createShiftHook,
    updateShift: updateShiftHook,
    deleteShift: deleteShiftHook,
    onStatsRefresh: () => setStatsRefreshTrigger((prev) => prev + 1),
    onPasswordRequired: (action) => {
      setPendingAction({ type: "edit", action });
      dialogStates.setShowPasswordDialog(true);
    },
  });

  // SSE Connection
  useSSEConnection({
    calendarId: selectedCalendar,
    onShiftUpdate: refetchShifts,
    onPresetUpdate: refetchPresets,
    onNoteUpdate: refetchNotes,
    onStatsRefresh: () => setStatsRefreshTrigger((prev) => prev + 1),
    onSyncLogUpdate: () => {
      fetchSyncErrorStatus();
      setSyncLogRefreshTrigger((prev) => prev + 1);
    },
    isConnected,
    setIsConnected,
  });

  // Update URL when calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, router]);

  // Handle password success with data refresh
  const handlePasswordSuccess = async () => {
    await Promise.all([
      refetchShifts(),
      refetchPresets(),
      refetchNotes(),
      fetchExternalSyncs(),
      fetchSyncErrorStatus(),
    ]);
    setStatsRefreshTrigger((prev) => prev + 1);
    baseHandlePasswordSuccess();

    // Execute pending action if exists
    if (pendingAction?.action) {
      await pendingAction.action();
      setPendingAction(null);
    }
  };

  // Calendar operations
  const handleDeleteCalendar = async (password?: string) => {
    if (!selectedCalendar) return;
    const success = await deleteCalendarHook(selectedCalendar, password);
    if (success) {
      dialogStates.setShowCalendarSettingsDialog(false);
    }
  };

  // External sync operations
  const handleExternalSyncClick = async () => {
    const executed = await verifyPasswordForAction(async () => {
      dialogStates.setShowExternalSyncDialog(true);
    });
    if (!executed) {
      dialogStates.setShowPasswordDialog(true);
    }
  };

  const handleSyncNotifications = async () => {
    const executed = await verifyPasswordForAction(async () => {
      dialogStates.setShowSyncNotificationDialog(true);
    });
    if (!executed) {
      dialogStates.setShowPasswordDialog(true);
    }
  };

  const handleSyncComplete = () => {
    refetchShifts();
    refetchCalendars();
    setStatsRefreshTrigger((prev) => prev + 1);
    fetchExternalSyncs();
    fetchSyncErrorStatus();
  };

  // Manual shift creation
  const handleManualShiftCreation = async () => {
    const executed = await verifyPasswordForAction(async () => {
      setSelectedDate(new Date());
      dialogStates.setShowShiftDialog(true);
    });
    if (!executed) {
      dialogStates.setShowPasswordDialog(true);
    }
  };

  // Day interaction handlers
  const handleDayClick = (date: Date) => {
    shiftActions.handleAddShift(date, selectedPresetId);
  };

  const handleDayRightClick = (e: React.MouseEvent, date: Date) => {
    e.preventDefault();
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    noteActions.openNoteDialog(date, existingNote);
  };

  const handleNoteIconClick = (e: React.MouseEvent, date: Date) => {
    e.stopPropagation();
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    noteActions.openNoteDialog(date, existingNote);
  };

  const handleLongPressDay = (date: Date) => {
    const existingNote = notes.find(
      (note) => note.date && isSameDay(new Date(note.date), date)
    );
    noteActions.openNoteDialog(date, existingNote);
  };

  const handleShowAllShifts = (date: Date, dayShifts: ShiftWithCalendar[]) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedDayShifts(dayShifts);
    dialogStates.setShowDayShiftsDialog(true);
  };

  const handleShowSyncedShifts = (
    date: Date,
    syncedShifts: ShiftWithCalendar[]
  ) => {
    dialogStates.setSelectedDayDate(date);
    dialogStates.setSelectedSyncedShifts(syncedShifts);
    dialogStates.setShowSyncedShiftsDialog(true);
  };

  const handleDeleteShiftFromDayDialog = async (shiftId: string) => {
    dialogStates.setShowDayShiftsDialog(false);
    await shiftActions.handleDeleteShift(shiftId);
    refetchShifts();
  };

  // Calendar grid calculations
  const calendarDays = getCalendarDays(currentDate);

  // Check if selected calendar is locked and has no cached password
  const isSelectedCalendarLocked =
    selectedCalendar &&
    calendars.find((c) => c.id === selectedCalendar)?.isLocked &&
    !getCachedPassword(selectedCalendar);

  // Loading state
  if (loading) {
    return <CalendarSkeleton />;
  }

  // Empty state
  if (calendars.length === 0) {
    return (
      <EmptyCalendarState
        onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
      />
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
        showMobileCalendarDialog={dialogStates.showMobileCalendarDialog}
        hasSyncErrors={hasSyncErrors}
        onSelectCalendar={setSelectedCalendar}
        onSelectPreset={setSelectedPresetId}
        onCreateCalendar={() => dialogStates.setShowCalendarDialog(true)}
        onManagePassword={() =>
          dialogStates.setShowCalendarSettingsDialog(true)
        }
        onExternalSync={handleExternalSyncClick}
        onSyncNotifications={handleSyncNotifications}
        onPresetsChange={refetchPresets}
        onShiftsChange={refetchShifts}
        onStatsRefresh={() => setStatsRefreshTrigger((prev) => prev + 1)}
        onPasswordRequired={(action) => {
          setPendingAction({ type: "edit", presetAction: action });
          dialogStates.setShowPasswordDialog(true);
        }}
        onManualShiftCreation={handleManualShiftCreation}
        onMobileCalendarDialogChange={dialogStates.setShowMobileCalendarDialog}
        onViewSettingsClick={() => dialogStates.setShowViewSettingsDialog(true)}
        presetsLoading={presetsLoading && !isSelectedCalendarLocked}
        hidePresetHeader={viewSettings.hidePresetHeader}
        onHidePresetHeaderChange={viewSettings.handleHidePresetHeaderChange}
      />

      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
        {isVerifyingCalendarPassword || shiftsLoading ? (
          isSelectedCalendarLocked ? (
            <LockedCalendarSkeleton />
          ) : (
            <CalendarContentSkeleton daysCount={calendarDays.length} />
          )
        ) : selectedCalendar && !isCalendarUnlocked ? (
          <LockedCalendarView
            calendarId={selectedCalendar}
            onUnlock={() => {
              setIsCalendarUnlocked(true);
              handlePasswordSuccess();
            }}
          />
        ) : (
          <CalendarContent
            calendarDays={calendarDays}
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            shifts={shifts}
            notes={notes}
            selectedPresetId={selectedPresetId}
            togglingDates={shiftActions.togglingDates}
            externalSyncs={externalSyncs}
            maxShiftsToShow={
              viewSettings.shiftsPerDay === null
                ? undefined
                : viewSettings.shiftsPerDay
            }
            maxExternalShiftsToShow={
              viewSettings.externalShiftsPerDay === null
                ? undefined
                : viewSettings.externalShiftsPerDay
            }
            showShiftNotes={viewSettings.showShiftNotes}
            showFullTitles={viewSettings.showFullTitles}
            shiftSortType={viewSettings.shiftSortType}
            shiftSortOrder={viewSettings.shiftSortOrder}
            combinedSortMode={viewSettings.combinedSortMode}
            selectedCalendar={selectedCalendar || null}
            statsRefreshTrigger={statsRefreshTrigger}
            shouldHideUIElements={shouldHideUIElements}
            locale={dateLocale}
            onDayClick={handleDayClick}
            onDayRightClick={
              shouldHideUIElements ? undefined : handleDayRightClick
            }
            onNoteIconClick={
              shouldHideUIElements ? undefined : handleNoteIconClick
            }
            onLongPress={shouldHideUIElements ? undefined : handleLongPressDay}
            onShowAllShifts={handleShowAllShifts}
            onShowSyncedShifts={handleShowSyncedShifts}
            onDeleteShift={shiftActions.handleDeleteShift}
          />
        )}
      </div>

      {/* Floating Action Button */}
      {selectedCalendar && !shouldHideUIElements && (
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
      <DialogManager
        showCalendarDialog={dialogStates.showCalendarDialog}
        onCalendarDialogChange={dialogStates.setShowCalendarDialog}
        onCreateCalendar={createCalendarHook}
        showShiftDialog={dialogStates.showShiftDialog}
        onShiftDialogChange={dialogStates.setShowShiftDialog}
        onShiftSubmit={shiftActions.handleShiftSubmit}
        selectedDate={selectedDate}
        selectedCalendar={selectedCalendar || null}
        onPresetsChange={refetchPresets}
        showPasswordDialog={dialogStates.showPasswordDialog}
        onPasswordDialogChange={dialogStates.setShowPasswordDialog}
        calendars={calendars}
        onPasswordSuccess={handlePasswordSuccess}
        showCalendarSettingsDialog={dialogStates.showCalendarSettingsDialog}
        onCalendarSettingsDialogChange={
          dialogStates.setShowCalendarSettingsDialog
        }
        onCalendarSettingsSuccess={refetchCalendars}
        onDeleteCalendar={handleDeleteCalendar}
        showExternalSyncDialog={dialogStates.showExternalSyncDialog}
        onExternalSyncDialogChange={dialogStates.setShowExternalSyncDialog}
        syncErrorRefreshTrigger={syncLogRefreshTrigger}
        onSyncComplete={handleSyncComplete}
        showSyncNotificationDialog={dialogStates.showSyncNotificationDialog}
        onSyncNotificationDialogChange={
          dialogStates.setShowSyncNotificationDialog
        }
        onErrorsMarkedRead={fetchSyncErrorStatus}
        onSyncLogUpdate={() => setSyncLogRefreshTrigger((prev) => prev + 1)}
        showDayShiftsDialog={dialogStates.showDayShiftsDialog}
        onDayShiftsDialogChange={dialogStates.setShowDayShiftsDialog}
        selectedDayDate={dialogStates.selectedDayDate}
        selectedDayShifts={dialogStates.selectedDayShifts}
        locale={locale}
        onDeleteShiftFromDayDialog={handleDeleteShiftFromDayDialog}
        showSyncedShiftsDialog={dialogStates.showSyncedShiftsDialog}
        onSyncedShiftsDialogChange={dialogStates.setShowSyncedShiftsDialog}
        selectedSyncedShifts={dialogStates.selectedSyncedShifts}
        showViewSettingsDialog={dialogStates.showViewSettingsDialog}
        onViewSettingsDialogChange={dialogStates.setShowViewSettingsDialog}
        viewSettings={viewSettings}
        onViewSettingsChange={{
          handleShiftsPerDayChange: viewSettings.handleShiftsPerDayChange,
          handleExternalShiftsPerDayChange:
            viewSettings.handleExternalShiftsPerDayChange,
          handleShowShiftNotesChange: viewSettings.handleShowShiftNotesChange,
          handleShowFullTitlesChange: viewSettings.handleShowFullTitlesChange,
          handleShiftSortTypeChange: viewSettings.handleShiftSortTypeChange,
          handleShiftSortOrderChange: viewSettings.handleShiftSortOrderChange,
          handleCombinedSortModeChange:
            viewSettings.handleCombinedSortModeChange,
        }}
        showNoteDialog={noteActions.showNoteDialog}
        onNoteDialogChange={noteActions.handleNoteDialogChange}
        selectedNote={noteActions.selectedNote}
        selectedNoteDate={noteActions.selectedDate}
        onNoteSubmit={noteActions.handleNoteSubmit}
        onNoteDelete={
          noteActions.selectedNote ? noteActions.handleNoteDelete : undefined
        }
      />

      <AppFooter versionInfo={versionInfo} />
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
