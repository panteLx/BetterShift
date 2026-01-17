import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { format } from "date-fns";
import { useTranslations, useLocale } from "next-intl";
import { getDateLocale } from "@/lib/locales";
import { ShiftWithCalendar } from "@/lib/types";
import { ShiftCard } from "@/components/shift-card";
import { ChevronUp, ChevronDown, Calendar as CalendarIcon } from "lucide-react";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

interface ShiftsListProps {
  shifts: ShiftWithCalendar[];
  currentDate: Date;
  onDeleteShift?: (id: string) => void;
  onEditShift?: (shift: ShiftWithCalendar) => void;
  calendarId?: string; // Optional: if provided, uses this for permission check instead of first shift's calendarId
}

export function ShiftsList({
  shifts,
  currentDate,
  onDeleteShift,
  onEditShift,
  calendarId: propCalendarId,
}: ShiftsListProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const [showShiftsSection, setShowShiftsSection] = useState(false);

  // Get calendar ID from props or first shift
  const calendarId = propCalendarId || shifts[0]?.calendarId;
  const { canEdit } = useCalendarPermission(calendarId);

  const shiftsInMonth = shifts.filter((shift) => {
    if (!shift.date) return false;
    const shiftDate = shift.date as Date;
    return (
      shiftDate.getMonth() === currentDate.getMonth() &&
      shiftDate.getFullYear() === currentDate.getFullYear()
    );
  });

  const groupedShifts = shiftsInMonth
    .sort(
      (a, b) =>
        (a.date ? (a.date as Date).getTime() : 0) -
        (b.date ? (b.date as Date).getTime() : 0)
    )
    .reduce((acc, shift) => {
      const dateKey = shift.date
        ? format(shift.date as Date, "yyyy-MM-dd")
        : "unknown";
      if (!acc[dateKey]) acc[dateKey] = [];
      acc[dateKey].push(shift);
      return acc;
    }, {} as Record<string, ShiftWithCalendar[]>);

  return (
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
            {t("common.shifts")}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {!showShiftsSection && shiftsInMonth.length > 0 && (
            <div className="px-3 py-1.5 bg-primary/10 rounded-full">
              <span className="font-semibold text-primary text-xs sm:text-sm">
                {shiftsInMonth.length}
              </span>
            </div>
          )}
          {showShiftsSection ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {showShiftsSection && (
        <div className="border-t border-border/30 bg-muted/20 p-3 sm:p-4">
          {shiftsInMonth.length === 0 ? (
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
                {Object.entries(groupedShifts).map(
                  ([dateKey, dayShifts], index) => (
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
                                dayShifts[0].date as Date,
                                "EEEE, MMMM d, yyyy",
                                { locale: dateLocale }
                              )}
                          </div>
                          <div className="text-xs sm:text-sm px-2.5 py-1 bg-primary/15 text-primary rounded-full font-semibold shadow-sm">
                            {dayShifts.length}{" "}
                            {dayShifts.length === 1
                              ? t("shift.shift_one")
                              : t("common.shifts")}
                          </div>
                        </div>
                      </div>
                      <div className="p-3 sm:p-4 grid gap-2 sm:gap-3 sm:grid-cols-2">
                        {dayShifts.map((shift) => (
                          <ShiftCard
                            key={shift.id}
                            shift={shift}
                            onDelete={canEdit ? onDeleteShift : undefined}
                            onEdit={canEdit ? onEditShift : undefined}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )
                )}
              </motion.div>
            </AnimatePresence>
          )}
        </div>
      )}
    </div>
  );
}
