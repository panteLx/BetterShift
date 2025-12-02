"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShiftWithCalendar } from "@/lib/types";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface DayShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  shifts: ShiftWithCalendar[];
  locale: string;
  onDeleteShift?: (shiftId: string) => void;
}

export function DayShiftsDialog({
  open,
  onOpenChange,
  date,
  shifts,
  locale,
  onDeleteShift,
}: DayShiftsDialogProps) {
  const t = useTranslations();

  if (!date) return null;

  const dateLocale = locale === "de" ? de : enUS;
  const formattedDate = format(date, "EEEE, d. MMMM yyyy", {
    locale: dateLocale,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {formattedDate}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {shifts.length}{" "}
            {shifts.length === 1 ? t("shift.shift_one") : t("shift.shifts")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 overflow-y-auto flex-1 p-6">
          {shifts.map((shift) => (
            <div
              key={shift.id}
              className="flex items-start justify-between p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all"
              style={{ borderLeftColor: shift.color, borderLeftWidth: 4 }}
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold flex items-center gap-2">
                  <div
                    className="w-1 h-4 rounded-full"
                    style={{ backgroundColor: shift.color }}
                  />
                  <span className="truncate">{shift.title}</span>
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  {shift.isAllDay ? (
                    <span className="font-medium">{t("shift.allDay")}</span>
                  ) : (
                    <span>
                      {shift.startTime} - {shift.endTime}
                    </span>
                  )}
                </div>
                {shift.notes && (
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                    {shift.notes}
                  </p>
                )}
              </div>
              {onDeleteShift && !shift.icloudSyncId && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onDeleteShift(shift.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
