"use client";

import { useTranslations } from "next-intl";
import { ShiftWithCalendar } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { motion } from "motion/react";

interface ShiftCardProps {
  shift: ShiftWithCalendar;
  onDelete?: (id: string) => void;
  onEdit?: (shift: ShiftWithCalendar) => void;
}

export function ShiftCard({ shift, onDelete, onEdit }: ShiftCardProps) {
  const t = useTranslations();

  const isEditable = onEdit && !shift.externalSyncId && !shift.syncedFromExternal;

  const handleCardClick = () => {
    if (isEditable) {
      onEdit(shift);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      layout
    >
      <Card
        className={`p-3 sm:p-4 hover:shadow-lg active:scale-[0.98] transition-all group relative overflow-hidden border-l-4 ${isEditable ? "cursor-pointer" : ""
          }`}
        style={{ borderLeftColor: shift.color || "#3b82f6" }}
        onClick={handleCardClick}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm sm:text-base truncate">
              {shift.title}
            </h3>
            <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
              {shift.isAllDay ? (
                <span className="font-medium">{t("shift.allDay")}</span>
              ) : (
                <>
                  <span className="font-medium">{shift.startTime}</span>
                  <span className="opacity-50">→</span>
                  <span className="font-medium">{shift.endTime}</span>
                </>
              )}
            </div>
            {shift.notes && (
              <p className="text-xs sm:text-sm text-muted-foreground mt-2 line-clamp-2 leading-relaxed">
                {shift.notes}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            {isEditable && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 transition-all text-muted-foreground hover:text-foreground hover:bg-muted flex-shrink-0 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit(shift);
                }}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {!shift.externalSyncId && !shift.syncedFromExternal && onDelete && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9 transition-all text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950 flex-shrink-0 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shift.id);
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
        <div
          className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{ backgroundColor: shift.color || "#3b82f6" }}
        />
      </Card>
    </motion.div>
  );
}

