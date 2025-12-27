import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { CalendarGrid } from "@/components/calendar-grid";
import { ShiftStats } from "@/components/shift-stats";
import { ShiftsList } from "@/components/shifts-list";
import { MonthNavigation } from "@/components/month-navigation";
import { GuestBanner } from "@/components/guest-banner";
import { ShiftWithCalendar } from "@/lib/types";
import { CalendarNote, ExternalSync } from "@/lib/db/schema";
import { Locale } from "date-fns";
import { useAuth } from "@/hooks/useAuth";

interface CalendarContentProps {
  calendarDays: Date[];
  currentDate: Date;
  onDateChange: (date: Date) => void;
  shifts: ShiftWithCalendar[];
  notes: CalendarNote[];
  selectedPresetId?: string;
  togglingDates: Set<string>;
  externalSyncs: ExternalSync[];
  maxShiftsToShow?: number;
  maxExternalShiftsToShow?: number;
  showShiftNotes: boolean;
  showFullTitles: boolean;
  shiftSortType: "startTime" | "createdAt" | "title";
  shiftSortOrder: "asc" | "desc";
  combinedSortMode: boolean;
  highlightedWeekdays?: number[];
  highlightColor?: string;
  selectedCalendar: string | null;
  statsRefreshTrigger: number;
  locale?: Locale;
  onDayClick: (date: Date) => void;
  onDayRightClick?: (e: React.MouseEvent, date: Date) => void;
  onNoteIconClick?: (e: React.MouseEvent, date: Date) => void;
  onLongPress?: (date: Date) => void;
  onShowAllShifts: (date: Date, shifts: ShiftWithCalendar[]) => void;
  onShowSyncedShifts: (date: Date, shifts: ShiftWithCalendar[]) => void;
  onDeleteShift?: (id: string) => void;
}

export function CalendarContent(props: CalendarContentProps) {
  const t = useTranslations();
  const { isGuest } = useAuth();

  return (
    <>
      <MonthNavigation
        currentDate={props.currentDate}
        onDateChange={props.onDateChange}
        locale={props.locale}
      />

      {/* Guest Banner - compact on mobile, default on desktop */}
      {isGuest && (
        <>
          <div className="mb-4 px-2 sm:hidden">
            <GuestBanner variant="compact" />
          </div>
          <div className="hidden sm:block mb-4">
            <GuestBanner variant="default" />
          </div>
        </>
      )}

      <CalendarGrid
        calendarDays={props.calendarDays}
        currentDate={props.currentDate}
        shifts={props.shifts}
        notes={props.notes}
        selectedPresetId={props.selectedPresetId}
        togglingDates={props.togglingDates}
        externalSyncs={props.externalSyncs}
        maxShiftsToShow={props.maxShiftsToShow}
        maxExternalShiftsToShow={props.maxExternalShiftsToShow}
        showShiftNotes={props.showShiftNotes}
        showFullTitles={props.showFullTitles}
        shiftSortType={props.shiftSortType}
        shiftSortOrder={props.shiftSortOrder}
        combinedSortMode={props.combinedSortMode}
        highlightedWeekdays={props.highlightedWeekdays}
        highlightColor={props.highlightColor}
        onDayClick={props.onDayClick}
        onDayRightClick={props.onDayRightClick}
        onNoteIconClick={props.onNoteIconClick}
        onLongPress={props.onLongPress}
        onShowAllShifts={props.onShowAllShifts}
        onShowSyncedShifts={props.onShowSyncedShifts}
      />

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

      <div className="space-y-3 sm:space-y-4 px-2 sm:px-0">
        <ShiftStats
          calendarId={props.selectedCalendar || undefined}
          currentDate={props.currentDate}
          refreshTrigger={props.statsRefreshTrigger}
        />

        <ShiftsList
          shifts={props.shifts}
          currentDate={props.currentDate}
          onDeleteShift={props.onDeleteShift}
          calendarId={props.selectedCalendar || undefined}
        />
      </div>
    </>
  );
}
