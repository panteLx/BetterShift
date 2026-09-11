"use client";

import { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { CalendarDays, Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChoiceChips, Field, inputClass } from "@/components/form-kit";
import { PanelDialog } from "@/components/panel-dialog";
import { parseLocalDate } from "@/lib/date-utils";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

export interface AuditFilterValues {
  action: string;
  severity: string;
  startDate: string;
  endDate: string;
}

export const EMPTY_AUDIT_FILTERS: AuditFilterValues = { action: "all", severity: "all", startDate: "", endDate: "" };

export function hasAuditFilters(filters: AuditFilterValues) {
  return (
    filters.action !== "all" || filters.severity !== "all" || !!filters.startDate || !!filters.endDate
  );
}

function useFilterOptions() {
  const t = useTranslations();
  return {
    actions: [
      { value: "all", label: t("admin.allActions") },
      { value: "admin.", label: t("admin.adminActions") },
      { value: "calendar.", label: t("admin.calendarActions") },
      { value: "auth.", label: t("admin.authActions") },
      { value: "security.", label: t("admin.securityActions") },
    ],
    severities: [
      { value: "all", label: t("common.filters.allSeverities") },
      { value: "info", label: t("common.severity.info") },
      { value: "warning", label: t("common.severity.warning") },
      { value: "error", label: t("common.severity.error") },
      { value: "critical", label: t("common.severity.critical") },
    ],
  };
}

function useRangeLabel(filters: AuditFilterValues) {
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const fmt = (value: string) => format(parseLocalDate(value), "P", { locale: dateLocale });
  if (!filters.startDate && !filters.endDate) return null;
  return `${filters.startDate ? fmt(filters.startDate) : "…"} – ${filters.endDate ? fmt(filters.endDate) : "…"}`;
}

const triggerClass =
  "h-9 gap-2 rounded-[9px] border-line bg-surface-card px-3 text-[13.5px] text-fg-body shadow-none data-[size=default]:h-9";

function DateInputs({
  filters,
  onChange,
}: {
  filters: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
}) {
  const t = useTranslations();
  return (
    <div className="grid grid-cols-2 gap-3">
      <Field label={t("common.labels.startDate")} htmlFor="audit-start">
        <Input
          id="audit-start"
          type="date"
          value={filters.startDate}
          max={filters.endDate || undefined}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className={inputClass}
        />
      </Field>
      <Field label={t("common.labels.endDate")} htmlFor="audit-end">
        <Input
          id="audit-end"
          type="date"
          value={filters.endDate}
          min={filters.startDate || undefined}
          onChange={(e) => onChange({ endDate: e.target.value })}
          className={inputClass}
        />
      </Field>
    </div>
  );
}

/** Desktop filter row next to the search (13f). */
export function AuditFilterBar({
  filters,
  onChange,
  onClear,
}: {
  filters: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
  onClear: () => void;
}) {
  const t = useTranslations();
  const { actions, severities } = useFilterOptions();
  const rangeLabel = useRangeLabel(filters);

  return (
    <>
      <Select value={filters.action} onValueChange={(action) => onChange({ action })}>
        <SelectTrigger aria-label={t("common.labels.action")} className={triggerClass}>
          <Filter className="size-[15px] text-fg-tertiary" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {actions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.severity} onValueChange={(severity) => onChange({ severity })}>
        <SelectTrigger aria-label={t("common.labels.severity")} className={triggerClass}>
          <Filter className="size-[15px] text-fg-tertiary" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {severities.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex h-9 items-center gap-2 rounded-[9px] border px-3 text-[13.5px] transition-colors hover:bg-surface-panel",
              rangeLabel ? "border-brand bg-brand-soft text-brand-ink" : "border-line bg-surface-card text-fg-body"
            )}
          >
            <CalendarDays className={cn("size-[15px]", rangeLabel ? "text-brand-ink" : "text-fg-tertiary")} />
            {rangeLabel ? (
              <span className="font-mono text-[12.5px]">{rangeLabel}</span>
            ) : (
              t("adminAudit.dateRange")
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[340px] rounded-[12px] border-line bg-background p-4">
          <DateInputs filters={filters} onChange={onChange} />
          {rangeLabel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onChange({ startDate: "", endDate: "" })}
              className="mt-3 h-8 px-2 text-fg-secondary"
            >
              <X className="size-4" />
              {t("adminAudit.clearRange")}
            </Button>
          )}
        </PopoverContent>
      </Popover>

      {hasAuditFilters(filters) && (
        <Button variant="ghost" onClick={onClear} className="h-9 gap-1.5 px-2.5 text-[13px] text-fg-secondary">
          <X className="size-4" />
          {t("common.filters.clearFilters")}
        </Button>
      )}
    </>
  );
}

function SummaryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center whitespace-nowrap rounded-full border px-3 text-[12.5px]",
        active
          ? "border-brand bg-brand-soft font-semibold text-brand-ink"
          : "border-line bg-surface-card font-medium text-fg-body"
      )}
    >
      {children}
    </button>
  );
}

/** Phone filter summary: one chip per filter, each opening the filter sheet. */
export function AuditFilterChips({
  filters,
  onOpen,
}: {
  filters: AuditFilterValues;
  onOpen: () => void;
}) {
  const { actions, severities } = useFilterOptions();
  const rangeLabel = useRangeLabel(filters);
  const t = useTranslations();

  return (
    <div className="-mx-4 flex gap-[7px] overflow-x-auto px-4 lg:hidden">
      <SummaryChip active={filters.action !== "all"} onClick={onOpen}>
        {actions.find((option) => option.value === filters.action)?.label}
      </SummaryChip>
      <SummaryChip active={filters.severity !== "all"} onClick={onOpen}>
        {severities.find((option) => option.value === filters.severity)?.label}
      </SummaryChip>
      <SummaryChip active={!!rangeLabel} onClick={onOpen}>
        {rangeLabel ? <span className="font-mono">{rangeLabel}</span> : t("adminAudit.dateRange")}
      </SummaryChip>
    </div>
  );
}

/** Phone filter sheet (13k); changes apply immediately like the desktop controls. */
export function AuditFilterSheet({
  open,
  onOpenChange,
  filters,
  onChange,
  onClear,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: AuditFilterValues;
  onChange: (patch: Partial<AuditFilterValues>) => void;
  onClear: () => void;
}) {
  const t = useTranslations();
  const { actions, severities } = useFilterOptions();

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("adminAudit.filterTitle")}
      bodyClassName="flex flex-col gap-5"
      footer={
        <>
          <Button
            variant="outline"
            onClick={onClear}
            disabled={!hasAuditFilters(filters)}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.filters.clearFilters")}
          </Button>
          <Button onClick={() => onOpenChange(false)} className="h-10 flex-1 font-semibold">
            {t("adminAudit.done")}
          </Button>
        </>
      }
    >
      <Field label={t("common.labels.action")}>
        <ChoiceChips
          value={filters.action}
          onChange={(action) => onChange({ action })}
          options={actions}
          label={t("common.labels.action")}
        />
      </Field>
      <Field label={t("common.labels.severity")}>
        <ChoiceChips
          value={filters.severity}
          onChange={(severity) => onChange({ severity })}
          options={severities}
          label={t("common.labels.severity")}
        />
      </Field>
      <DateInputs filters={filters} onChange={onChange} />
    </PanelDialog>
  );
}
