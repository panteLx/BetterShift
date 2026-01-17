import { ShiftWithCalendar } from "@/lib/types";
import { useTranslations } from "next-intl";

interface CalendarShiftCardProps {
  shift: ShiftWithCalendar;
  showShiftNotes?: boolean;
  showFullTitles?: boolean;
  onEditShift?: (shift: ShiftWithCalendar) => void;
}

export function CalendarShiftCard({
  shift,
  showShiftNotes = false,
  showFullTitles = false,
  onEditShift,
}: CalendarShiftCardProps) {
  const t = useTranslations();

  const isClickable = onEditShift && !shift.externalSyncId && !shift.syncedFromExternal;

  const handleClick = (e: React.MouseEvent) => {
    if (isClickable) {
      e.stopPropagation(); // Prevent triggering day click
      onEditShift(shift);
    }
  };

  return (
    <div
      className={`text-[10px] sm:text-xs px-0.5 py-0.5 sm:px-1.5 sm:py-1 rounded transition-all ${isClickable ? "cursor-pointer hover:ring-2 hover:ring-primary/50 hover:shadow-sm" : ""
        }`}
      style={{
        backgroundColor: shift.color ? `${shift.color}20` : "#3b82f620",
        borderLeft: `2px solid ${shift.color || "#3b82f6"}`,
      }}
      title={`${shift.title} ${shift.isAllDay
          ? `(${t("shift.allDay")})`
          : `(${shift.startTime} - ${shift.endTime})`
        }${shift.notes ? `\n${shift.notes}` : ""}`}
      onClick={handleClick}
    >
      <div
        className={`font-semibold leading-[1.1] sm:leading-tight break-words ${showFullTitles ? "" : "line-clamp-2"
          }`}
      >
        {shift.title}
      </div>
      <div className="text-[9px] sm:text-[10px] opacity-70 leading-tight">
        {shift.isAllDay ? (
          t("shift.allDay")
        ) : (
          <>
            <span className="sm:hidden">{shift.startTime.substring(0, 5)}</span>
            <span className="hidden sm:inline">
              {shift.startTime.substring(0, 5)} -{" "}
              {shift.endTime.substring(0, 5)}
            </span>
          </>
        )}
      </div>
      {showShiftNotes && shift.notes && (
        <div className="text-[9px] sm:text-[10px] opacity-60 leading-tight mt-0.5 line-clamp-2">
          {shift.notes}
        </div>
      )}
    </div>
  );
}

