"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Columns3, List } from "lucide-react";
import { SegmentedControl } from "@/components/segmented-control";
import { AVAILABLE_VIEW_MODES, CalendarViewMode } from "@/hooks/useCalendarViewMode";

const ICONS = { month: CalendarDays, week: Columns3, list: List } as const;

export function ViewModeSwitcher({
  value,
  onChange,
  variant,
}: {
  value: CalendarViewMode;
  onChange: (mode: CalendarViewMode) => void;
  /** "icon" is the phone title row, where three words do not fit */
  variant: "text" | "icon";
}) {
  const t = useTranslations();

  const labels: Record<CalendarViewMode, string> = {
    month: t("calendarView.viewMonth"),
    week: t("calendarView.viewWeek"),
    list: t("calendarView.viewList"),
  };

  return (
    <SegmentedControl<CalendarViewMode>
      label={t("calendarView.viewMode")}
      value={value}
      onChange={onChange}
      // Icon track: 36px per segment plus the 6px track padding
      className={variant === "icon" ? "w-[114px] shrink-0" : "shrink-0"}
      options={AVAILABLE_VIEW_MODES.map((mode) => {
        const Icon = ICONS[mode];
        return variant === "icon"
          ? { value: mode, label: <Icon className="size-4" />, ariaLabel: labels[mode] }
          : { value: mode, label: <span className="px-3">{labels[mode]}</span> };
      })}
    />
  );
}
