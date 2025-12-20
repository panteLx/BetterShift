"use client";

import { useTranslations } from "next-intl";
import { CalendarWithCount } from "@/lib/types";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { motion } from "motion/react";

interface CalendarCompareSheetProps {
  calendars: CalendarWithCount[];
  selectedIds: string[];
  onToggleCalendar: (id: string) => void;
  onStartCompare: () => void;
  onCancel: () => void;
}

const MAX_CALENDARS = 3;

export function CalendarCompareSheet({
  calendars,
  selectedIds,
  onToggleCalendar,
  onStartCompare,
  onCancel,
}: CalendarCompareSheetProps) {
  const t = useTranslations();
  const canStartCompare =
    selectedIds.length >= 2 && selectedIds.length <= MAX_CALENDARS;
  const isMaxReached = selectedIds.length >= MAX_CALENDARS;

  return (
    <BaseSheet
      open={true}
      onOpenChange={onCancel}
      title={t("calendar.selectToCompare")}
      description={t("calendar.selectToCompareDescription")}
      showSaveButton
      onSave={onStartCompare}
      saveDisabled={!canStartCompare}
      saveLabel={t("calendar.startComparing")}
      maxWidth="md"
    >
      {/* Mobile Warning */}
      <div className="lg:hidden mb-3">
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
          <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
            {t("calendar.mobileNotOptimized")}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        {calendars.map((calendar) => {
          const isSelected = selectedIds.includes(calendar.id);
          const isDisabled = !isSelected && isMaxReached;

          return (
            <motion.div
              key={calendar.id}
              className={`border rounded-lg p-4 transition-all ${
                isDisabled
                  ? "border-border opacity-50 cursor-not-allowed"
                  : isSelected
                  ? "border-primary bg-primary/5 cursor-pointer"
                  : "border-border hover:border-primary/50 hover:bg-accent/50 cursor-pointer"
              }`}
              onClick={() => !isDisabled && onToggleCalendar(calendar.id)}
              whileHover={!isDisabled ? { scale: 1.01 } : {}}
              whileTap={!isDisabled ? { scale: 0.99 } : {}}
            >
              <div className="flex items-center gap-3">
                <Checkbox
                  checked={isSelected}
                  disabled={isDisabled}
                  onCheckedChange={() =>
                    !isDisabled && onToggleCalendar(calendar.id)
                  }
                  className="pointer-events-none"
                />
                <div
                  className="w-4 h-4 rounded-full shrink-0"
                  style={{ backgroundColor: calendar.color }}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{calendar.name}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Info Footer */}
      <div className="mt-4 text-sm text-muted-foreground text-center">
        {selectedIds.length > 0 ? (
          <span>
            {t("calendar.compareSelected", {
              count: selectedIds.length,
            })}
          </span>
        ) : (
          <span>{t("calendar.selectToCompareDescription")}</span>
        )}
      </div>
    </BaseSheet>
  );
}
