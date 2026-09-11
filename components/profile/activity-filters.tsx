"use client";

import { ReactNode, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ChoiceChips, Field, inputClass } from "@/components/form-kit";
import { PanelDialog } from "@/components/panel-dialog";
import type { UnifiedActivityLog } from "@/hooks/useActivityLogs";
import { parseLocalDate } from "@/lib/date-utils";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type LogType = UnifiedActivityLog["type"];
type LogSeverity = UnifiedActivityLog["severity"];

export interface ActivityFilterValues {
  type: "all" | LogType;
  severity: "all" | LogSeverity;
  startDate: string;
  endDate: string;
}

export const EMPTY_ACTIVITY_FILTERS: ActivityFilterValues = {
  type: "all",
  severity: "all",
  startDate: "",
  endDate: "",
};

const TYPES: LogType[] = ["auth", "calendar", "sync", "security"];
const SEVERITIES: LogSeverity[] = ["info", "warning", "error", "critical"];

export function countActivityFilters(filters: ActivityFilterValues) {
  return [
    filters.type !== "all",
    filters.severity !== "all",
    !!(filters.startDate || filters.endDate),
  ].filter(Boolean).length;
}

export function useActivityLabels() {
  const t = useTranslations();
  const types: Record<LogType, string> = {
    auth: t("activityLog.auth"),
    calendar: t("activityLog.calendar"),
    sync: t("activityLog.sync"),
    security: t("activityLog.security"),
  };
  const severities: Record<LogSeverity, string> = {
    info: t("common.severity.info"),
    warning: t("common.severity.warning"),
    error: t("common.severity.error"),
    critical: t("common.severity.critical"),
  };
  return { types, severities };
}

function useRangeLabel(filters: ActivityFilterValues) {
  const dateLocale = getDateLocale(useLocale());
  if (!filters.startDate && !filters.endDate) return null;
  const fmt = (value: string) => format(parseLocalDate(value), "P", { locale: dateLocale });
  return `${filters.startDate ? fmt(filters.startDate) : "…"} – ${filters.endDate ? fmt(filters.endDate) : "…"}`;
}

function FilterFields({
  filters,
  onChange,
}: {
  filters: ActivityFilterValues;
  onChange: (patch: Partial<ActivityFilterValues>) => void;
}) {
  const t = useTranslations();
  const { types, severities } = useActivityLabels();

  return (
    <div className="flex flex-col gap-5">
      <Field label={t("activityLog.eventType")}>
        <ChoiceChips
          label={t("activityLog.eventType")}
          value={filters.type}
          onChange={(type) => onChange({ type })}
          options={[
            { value: "all" as const, label: t("activityLog.allTypes") },
            ...TYPES.map((value) => ({ value, label: types[value] })),
          ]}
        />
      </Field>
      <Field label={t("common.labels.severity")}>
        <ChoiceChips
          label={t("common.labels.severity")}
          value={filters.severity}
          onChange={(severity) => onChange({ severity })}
          options={[
            { value: "all" as const, label: t("common.filters.allSeverities") },
            ...SEVERITIES.map((value) => ({ value, label: severities[value] })),
          ]}
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("common.labels.startDate")} htmlFor="activity-start">
          <Input
            id="activity-start"
            type="date"
            value={filters.startDate}
            max={filters.endDate || undefined}
            onChange={(e) => onChange({ startDate: e.target.value })}
            className={cn(inputClass, "font-mono text-[13px]")}
          />
        </Field>
        <Field label={t("common.labels.endDate")} htmlFor="activity-end">
          <Input
            id="activity-end"
            type="date"
            value={filters.endDate}
            min={filters.startDate || undefined}
            onChange={(e) => onChange({ endDate: e.target.value })}
            className={cn(inputClass, "font-mono text-[13px]")}
          />
        </Field>
      </div>
    </div>
  );
}

function ActiveFilterChip({ label, children, onRemove }: { label: string; children?: ReactNode; onRemove: () => void }) {
  const t = useTranslations();
  return (
    <button
      type="button"
      onClick={onRemove}
      aria-label={t("common.filters.remove", { filter: label })}
      className="flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-brand bg-brand-soft pl-3 pr-2 text-[12.5px] font-semibold text-brand-ink lg:h-8"
    >
      {children ?? label}
      <X className="size-3.5" />
    </button>
  );
}

/**
 * Search plus a filter button: a popover on desktop, a bottom sheet on phones.
 * Active filters show as removable chips next to the total count.
 */
export function ActivityToolbar({
  desktop,
  search,
  onSearchChange,
  filters,
  onChange,
  onClear,
  total,
}: {
  desktop: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  filters: ActivityFilterValues;
  onChange: (patch: Partial<ActivityFilterValues>) => void;
  onClear: () => void;
  /** `null` while the first page loads */
  total: number | null;
}) {
  const t = useTranslations();
  const { types, severities } = useActivityLabels();
  const rangeLabel = useRangeLabel(filters);
  const [sheetOpen, setSheetOpen] = useState(false);
  const count = countActivityFilters(filters);
  const anyActive = count > 0 || !!search;

  const trigger = (
    <button
      type="button"
      onClick={desktop ? undefined : () => setSheetOpen(true)}
      className={cn(
        "flex h-11 shrink-0 items-center gap-2 rounded-[9px] border px-3.5 text-[13.5px] font-medium transition-colors hover:bg-surface-panel lg:h-[38px]",
        count > 0 ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface-card text-fg-body"
      )}
    >
      <SlidersHorizontal className="size-4" />
      {t("common.filters.title")}
      {count > 0 && (
        <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 font-mono text-[11px] font-medium text-white">
          {count}
        </span>
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("activityLog.searchPlaceholder")}
            aria-label={t("activityLog.searchPlaceholder")}
            className="h-11 rounded-[9px] pl-9 text-[14px] lg:h-[38px] lg:text-[13.5px]"
          />
        </div>
        {desktop ? (
          <Popover>
            <PopoverTrigger asChild>{trigger}</PopoverTrigger>
            <PopoverContent align="end" className="w-[400px] rounded-[12px] border-line bg-background p-4">
              <FilterFields filters={filters} onChange={onChange} />
              {anyActive && (
                <Button variant="ghost" size="sm" onClick={onClear} className="mt-3 h-8 px-2 text-fg-secondary">
                  <X className="size-4" />
                  {t("common.filters.clearFilters")}
                </Button>
              )}
            </PopoverContent>
          </Popover>
        ) : (
          trigger
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filters.type !== "all" && (
          <ActiveFilterChip label={types[filters.type]} onRemove={() => onChange({ type: "all" })} />
        )}
        {filters.severity !== "all" && (
          <ActiveFilterChip label={severities[filters.severity]} onRemove={() => onChange({ severity: "all" })} />
        )}
        {rangeLabel && (
          <ActiveFilterChip label={rangeLabel} onRemove={() => onChange({ startDate: "", endDate: "" })}>
            <span className="font-mono font-medium">{rangeLabel}</span>
          </ActiveFilterChip>
        )}
        {anyActive && (
          <Button variant="ghost" onClick={onClear} className="h-9 gap-1.5 px-2.5 text-[13px] text-fg-secondary lg:h-8">
            <X className="size-4" />
            {t("common.filters.clearFilters")}
          </Button>
        )}
        {total !== null && (
          <span className="ml-auto text-[12.5px] text-fg-tertiary">
            {t("activityLog.totalLogs", { count: total })}
          </span>
        )}
      </div>

      {!desktop && (
        <PanelDialog
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title={t("common.filters.title")}
          footer={
            <>
              <Button
                variant="outline"
                onClick={onClear}
                disabled={!anyActive}
                className="h-11 flex-1 font-semibold"
              >
                {t("common.filters.clearFilters")}
              </Button>
              <Button onClick={() => setSheetOpen(false)} className="h-11 flex-1 font-semibold">
                {t("common.filters.done")}
              </Button>
            </>
          }
        >
          <FilterFields filters={filters} onChange={onChange} />
        </PanelDialog>
      )}
    </div>
  );
}
