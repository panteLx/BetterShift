import { motion } from "motion/react";
import { StickyNote } from "lucide-react";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote } from "@/lib/db/schema";
import { isToday } from "date-fns";
import { useTranslations } from "next-intl";
import { useRef, useEffect } from "react";
import { formatDateToLocal } from "@/lib/date-utils";

interface CalendarGridProps {
  calendarDays: Date[];
  currentDate: Date;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  selectedPresetId: string | undefined;
  togglingDates: Set<string>;
  onDayClick: (date: Date) => void;
  onDayRightClick: (e: React.MouseEvent, date: Date) => void;
  onNoteIconClick: (e: React.MouseEvent, date: Date) => void;
  onLongPress: (date: Date) => void;
}

export function CalendarGrid({
  calendarDays,
  currentDate,
  shifts,
  notes,
  selectedPresetId,
  togglingDates,
  onDayClick,
  onDayRightClick,
  onNoteIconClick,
  onLongPress,
}: CalendarGridProps) {
  const t = useTranslations();
  const pressTimerRef = useRef<Record<string, NodeJS.Timeout>>({});

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      Object.values(pressTimerRef.current).forEach((timer) => {
        if (timer) clearTimeout(timer);
      });
      pressTimerRef.current = {};
    };
  }, []);

  const getShiftsForDate = (date: Date) => {
    return shifts.filter(
      (shift) => shift.date && isSameDay(new Date(shift.date), date)
    );
  };

  const isSameDay = (date1: Date, date2: Date) => {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  };

  return (
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

        // Use formatDateToLocal to match the format used in handleAddShift
        const dayKey = formatDateToLocal(day);
        const isToggling = togglingDates.has(dayKey);

        const handleTouchStart = (e: React.TouchEvent) => {
          pressTimerRef.current[dayKey] = setTimeout(
            () => onLongPress(day),
            500
          );
        };
        const handleTouchEnd = () => {
          if (pressTimerRef.current[dayKey]) {
            clearTimeout(pressTimerRef.current[dayKey]);
            delete pressTimerRef.current[dayKey];
          }
        };

        return (
          <motion.button
            key={idx}
            onClick={() => onDayClick(day)}
            onContextMenu={(e) => {
              e.preventDefault();
              onDayRightClick(e, day);
            }}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchEnd}
            disabled={isToggling}
            whileTap={{ scale: 0.95 }}
            style={{
              WebkitUserSelect: "none",
              userSelect: "none",
              WebkitTouchCallout: "none",
            }}
            className={`
              min-h-25 sm:min-h-28 px-1 py-1.5 sm:p-2.5 rounded-md sm:rounded-lg text-sm transition-all relative flex flex-col border sm:border-2
              ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/50"}
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
              ${isToggling ? "opacity-50 cursor-wait pointer-events-none" : ""}
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
                  onClick={(e) => onNoteIconClick(e, day)}
                  title={dayNote.note}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <StickyNote className="h-3.5 w-3.5 text-orange-500 cursor-pointer hover:text-orange-600 transition-colors" />
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
                    {shift.isAllDay ? (
                      t("shift.allDay")
                    ) : (
                      <>
                        <span className="sm:hidden">
                          {shift.startTime.substring(0, 5)}
                        </span>
                        <span className="hidden sm:inline">
                          {shift.startTime.substring(0, 5)} -{" "}
                          {shift.endTime.substring(0, 5)}
                        </span>
                      </>
                    )}
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
  );
}
