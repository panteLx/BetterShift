"use client";

import { useTranslations } from "next-intl";
import { ShiftWithCalendar } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface ShiftCardProps {
  shift: ShiftWithCalendar;
  onDelete: (id: string) => void;
}

export function ShiftCard({ shift, onDelete }: ShiftCardProps) {
  const t = useTranslations();

  return (
    <Card
      className="p-2 sm:p-3 hover:shadow-md transition-all group relative overflow-hidden"
      style={{ borderLeft: `4px solid ${shift.color || "#3b82f6"}` }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-xs sm:text-sm truncate">
            {shift.title}
          </h3>
          <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-muted-foreground mt-0.5">
            {shift.isAllDay ? (
              <span className="font-medium">{t("shift.allDay")}</span>
            ) : (
              <>
                <span className="font-medium">{shift.startTime}</span>
                <span>→</span>
                <span className="font-medium">{shift.endTime}</span>
              </>
            )}
          </div>
          {shift.notes && (
            <p className="text-[10px] sm:text-xs text-muted-foreground mt-1 sm:mt-1.5 line-clamp-2">
              {shift.notes}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 sm:h-7 sm:w-7 transition-opacity text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
          onClick={() => onDelete(shift.id)}
        >
          <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
        </Button>
      </div>
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{ backgroundColor: shift.color || "#3b82f6" }}
      />
    </Card>
  );
}
