"use client";

import { useState, useEffect, Suspense } from "react";
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
import { LanguageSwitcher } from "@/components/language-switcher";
import { Button } from "@/components/ui/button";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
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
import { ShiftPreset } from "@/lib/db/schema";
import { formatDateToLocal } from "@/lib/date-utils";

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
  const [pendingAction, setPendingAction] = useState<{
    type: "delete" | "edit";
    shiftId?: string;
    formData?: ShiftFormData;
    presetAction?: () => Promise<void>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Fetch calendars on mount
  useEffect(() => {
    fetchCalendars();
  }, []);

  // Update URL when selected calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      router.replace(`/?id=${selectedCalendar}`, { scroll: false });
    }
  }, [selectedCalendar, router]);

  // Fetch shifts and presets when calendar changes
  useEffect(() => {
    if (selectedCalendar) {
      fetchShifts();
      fetchPresets();
    } else {
      setShifts([]);
      setPresets([]);
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
    } catch (error) {
      console.error("Failed to create calendar:", error);
    }
  };

  const createShift = async (formData: ShiftFormData) => {
    if (!selectedCalendar) return;

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
      setShifts([...shifts, newShift]);
    } catch (error) {
      console.error("Failed to create shift:", error);
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
    } catch (error) {
      console.error("Failed to update shift:", error);
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
    } catch (error) {
      console.error("Failed to delete shift:", error);
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

  const handleShiftSubmit = (formData: ShiftFormData) => {
    createShift(formData);
  };

  const handleAddShift = async (date: Date) => {
    // Only proceed if a preset is selected
    if (!selectedPresetId) return;

    const preset = presets.find((p) => p.id === selectedPresetId);
    if (!preset) return;

    // Check password before adding/deleting shift
    const checkAndToggle = async () => {
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
        await deleteShift(existingShift.id);
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
        createShift(shiftData);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (calendars.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md">
          <CalendarIcon className="h-16 w-16 mx-auto text-muted-foreground" />
          <h1 className="text-2xl font-bold">Welcome to BetterShift</h1>
          <p className="text-muted-foreground">
            Get started by creating your first calendar to track your shifts.
          </p>
          <Button onClick={() => setShowCalendarDialog(true)} size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Calendar
          </Button>
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
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
          <h1 className="text-xl sm:text-2xl font-bold">{t("app.title")}</h1>
          <CalendarSelector
            calendars={calendars}
            selectedId={selectedCalendar}
            onSelect={setSelectedCalendar}
            onCreateNew={() => setShowCalendarDialog(true)}
            onManagePassword={() => setShowManagePasswordDialog(true)}
          />
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

      {/* Month Navigation */}
      <div className="container max-w-4xl mx-auto px-1 py-3 sm:p-4 flex-1">
        <div className="flex items-center justify-between mb-3 sm:mb-4 px-2 sm:px-0">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-base sm:text-xl font-semibold">
            {format(currentDate, "MMMM yyyy", { locale: dateLocale })}
          </h2>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 sm:h-10 sm:w-10"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-px sm:gap-1 mb-6">
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
              className="text-center text-xs sm:text-xs font-medium text-muted-foreground p-0.5 sm:p-2"
            >
              {day}
            </div>
          ))}
          {calendarDays.map((day, idx) => {
            const dayShifts = getShiftsForDate(day);
            const isCurrentMonth = day.getMonth() === currentDate.getMonth();
            const isTodayDate = isToday(day);

            return (
              <button
                key={idx}
                onClick={() => handleAddShift(day)}
                disabled={!selectedPresetId}
                className={`
                  min-h-24 sm:min-h-24 px-0.5 py-1 sm:p-2 rounded-md text-sm transition-all relative flex flex-col border-2
                  ${
                    isCurrentMonth
                      ? "text-foreground"
                      : "text-muted-foreground/50"
                  }
                  ${
                    isTodayDate
                      ? "border-primary shadow-md shadow-primary/20 bg-primary/5"
                      : "border-transparent"
                  }
                  ${
                    selectedPresetId && isCurrentMonth
                      ? "hover:bg-accent cursor-pointer active:bg-accent/80"
                      : "cursor-not-allowed"
                  }
                  ${!isCurrentMonth ? "opacity-50" : ""}
                `}
              >
                <div
                  className={`text-xs sm:text-xs font-medium mb-0.5 ${
                    isTodayDate ? "text-primary font-bold" : ""
                  }`}
                >
                  {day.getDate()}
                </div>
                <div className="flex-1 space-y-0.5 overflow-hidden">
                  {dayShifts.slice(0, 2).map((shift) => (
                    <div
                      key={shift.id}
                      className="text-[10px] sm:text-xs px-0.5 sm:px-1 py-0.5 sm:py-0.5 rounded truncate"
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
                      <div className="font-medium truncate leading-tight">
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
                    <div className="text-[9px] sm:text-[10px] text-muted-foreground text-center">
                      +{dayShifts.length - 2}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Shifts List */}
        <div className="space-y-3 sm:space-y-4 px-2 sm:px-0">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-lg sm:text-xl font-bold">{t("shift.title")}</h3>
            {shifts.length > 0 && (
              <div className="flex gap-2 sm:gap-3 text-xs sm:text-sm">
                <div className="px-2 sm:px-3 py-1 bg-primary/10 rounded-full">
                  <span className="font-semibold text-primary">
                    {
                      shifts.filter((shift) => {
                        if (!shift.date) return false;
                        const shiftDate = new Date(shift.date);
                        return (
                          shiftDate.getMonth() === currentDate.getMonth() &&
                          shiftDate.getFullYear() === currentDate.getFullYear()
                        );
                      }).length
                    }
                  </span>
                  <span className="text-muted-foreground ml-1">
                    <span className="hidden sm:inline">
                      {t("shift.shiftsThisMonth")}
                    </span>
                    <span className="sm:hidden">{t("shift.shifts")}</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {shifts.length === 0 ? (
            <div className="border-2 border-dashed rounded-lg p-8 sm:p-12 text-center space-y-3 sm:space-y-4">
              <div className="flex justify-center">
                <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-full bg-muted flex items-center justify-center">
                  <CalendarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                </div>
              </div>
              <div className="space-y-1 sm:space-y-2">
                <h4 className="font-semibold text-base sm:text-lg">
                  {t("shift.noShifts")}
                </h4>
                <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto">
                  {presets.length === 0
                    ? t("shift.createPresetFirst")
                    : t("shift.noShiftsDescription")}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3">
              {Object.entries(
                shifts
                  .filter((shift) => {
                    if (!shift.date) return false;
                    const shiftDate = new Date(shift.date);
                    return (
                      shiftDate.getMonth() === currentDate.getMonth() &&
                      shiftDate.getFullYear() === currentDate.getFullYear()
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
              ).map(([dateKey, dayShifts]) => (
                <div
                  key={dateKey}
                  className="border rounded-lg overflow-hidden"
                >
                  <div className="bg-muted/50 px-3 sm:px-4 py-1.5 sm:py-2 border-b">
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-xs sm:text-sm">
                        {dayShifts[0].date &&
                          format(
                            new Date(dayShifts[0].date),
                            "EEEE, MMMM d, yyyy",
                            { locale: dateLocale }
                          )}
                      </div>
                      <div className="text-[10px] sm:text-xs text-muted-foreground">
                        {dayShifts.length}{" "}
                        {dayShifts.length === 1
                          ? t("shift.shift_one")
                          : t("shift.shifts")}
                      </div>
                    </div>
                  </div>
                  <div className="p-2 sm:p-3 grid gap-1.5 sm:gap-2 sm:grid-cols-2">
                    {dayShifts.map((shift) => (
                      <ShiftCard
                        key={shift.id}
                        shift={shift}
                        onDelete={deleteShift}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

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

      {/* Footer */}
      <div className="border-t bg-background mt-auto">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4 flex justify-center">
          <LanguageSwitcher />
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
