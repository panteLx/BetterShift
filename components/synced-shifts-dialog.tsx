"use client";

import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ShiftWithCalendar } from "@/lib/types";
import { format } from "date-fns";
import { de, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Clock } from "lucide-react";

interface SyncedShiftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: Date | null;
  shifts: ShiftWithCalendar[];
}

export function SyncedShiftsDialog({
  open,
  onOpenChange,
  date,
  shifts,
}: SyncedShiftsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = locale === "de" ? de : enUS;

  const formattedDate = date
    ? format(date, "EEEE, dd. MMMM yyyy", { locale: dateLocale })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {t("icloud.syncedShiftsTitle", { date: formattedDate })}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {t("icloud.viewSyncedShifts")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 max-h-[60vh] overflow-y-auto">
          {shifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              {t("shift.noShiftsInMonth")}
            </p>
          ) : (
            shifts.map((shift) => (
              <div
                key={shift.id}
                className="p-4 rounded-lg border transition-colors"
                style={{
                  backgroundColor: shift.color
                    ? `${shift.color}10`
                    : "#3b82f610",
                  borderLeft: `3px solid ${shift.color || "#3b82f6"}`,
                }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h4
                      className="font-semibold text-base mb-1 truncate"
                      style={{ color: shift.color || "#3b82f6" }}
                    >
                      {shift.title}
                    </h4>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {shift.isAllDay ? (
                        <span>{t("shift.allDay")}</span>
                      ) : (
                        <span>
                          {shift.startTime} - {shift.endTime}
                        </span>
                      )}
                    </div>
                    {shift.notes && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {shift.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
