"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { CalendarWithCount } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { PanelDialog } from "@/components/panel-dialog";
import { cn } from "@/lib/utils";

interface CalendarCompareSheetProps {
  open: boolean;
  calendars: CalendarWithCount[];
  selectedIds: string[];
  onToggleCalendar: (id: string) => void;
  onStartCompare: () => void;
  onCancel: () => void;
}

export const MAX_COMPARE_CALENDARS = 3;

export function CalendarCompareSheet({
  open,
  calendars,
  selectedIds,
  onToggleCalendar,
  onStartCompare,
  onCancel,
}: CalendarCompareSheetProps) {
  const t = useTranslations();
  const canStart = selectedIds.length >= 2 && selectedIds.length <= MAX_COMPARE_CALENDARS;
  const maxReached = selectedIds.length >= MAX_COMPARE_CALENDARS;

  return (
    <PanelDialog
      open={open}
      onOpenChange={(next) => !next && onCancel()}
      title={t("calendar.selectToCompare")}
      description={t("calendar.selectToCompareDescription")}
      footer={
        <>
          <Button variant="outline" className="h-10 flex-1 font-semibold" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button className="h-10 flex-1 font-semibold" disabled={!canStart} onClick={onStartCompare}>
            {t("calendar.startComparing")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        {calendars.map((calendar) => {
          const selected = selectedIds.includes(calendar.id);
          const disabled = !selected && maxReached;
          return (
            <button
              key={calendar.id}
              type="button"
              role="checkbox"
              aria-checked={selected}
              disabled={disabled}
              onClick={() => onToggleCalendar(calendar.id)}
              className={cn(
                "flex items-center gap-3 rounded-[10px] border-[1.5px] px-3 py-[11px] text-left transition-colors disabled:opacity-50",
                selected
                  ? "border-brand bg-surface-today"
                  : "border-line bg-surface-card hover:bg-surface-panel"
              )}
            >
              <span
                className="size-3 shrink-0 rounded-[4px]"
                style={{ backgroundColor: calendar.color }}
              />
              <span
                className={cn(
                  "flex-1 truncate text-[14px] font-semibold",
                  selected ? "text-brand-ink" : "text-fg-strong"
                )}
              >
                {calendar.name}
              </span>
              <span
                className={cn(
                  "flex size-5 items-center justify-center rounded-[6px] border",
                  selected ? "border-brand bg-brand text-white" : "border-control"
                )}
              >
                {selected && <Check className="size-3.5" />}
              </span>
            </button>
          );
        })}
        <p className="pt-1 text-[12px] text-fg-tertiary">
          {t("calendar.compareSelected", { count: selectedIds.length })} ·{" "}
          {t("calendarCompare.maxHint", { max: MAX_COMPARE_CALENDARS })}
        </p>
      </div>
    </PanelDialog>
  );
}
