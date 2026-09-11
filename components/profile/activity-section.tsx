"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Pill } from "@/components/form-kit";
import { PanelBody } from "@/components/panel-dialog";
import { StatusBanner } from "@/components/status-banner";
import { accountWideContentClass, SectionHeading } from "@/components/profile/account-layout";
import {
  ActivityToolbar,
  countActivityFilters,
  EMPTY_ACTIVITY_FILTERS,
  useActivityLabels,
  type ActivityFilterValues,
} from "@/components/profile/activity-filters";
import { useActivityLogs, type UnifiedActivityLog } from "@/hooks/useActivityLogs";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type SortColumn = "timestamp" | "type" | "severity";

const PAGE_SIZE = 50;
const SEVERITY_ORDER = { info: 0, warning: 1, error: 2, critical: 3 };
const SEVERITY_TONE = {
  info: "neutral",
  warning: "warning",
  error: "danger",
  critical: "danger",
} as const;

function ActionCode({ action }: { action: string }) {
  return (
    <code className="inline-block max-w-full truncate rounded-md bg-surface-sunken px-1.5 py-0.5 align-middle font-mono text-[12px] font-medium text-fg-body">
      {action}
    </code>
  );
}

function LogDetails({ log, surface }: { log: UnifiedActivityLog; surface: string }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-2">
      {log.resourceType && (
        <div className="min-w-0 text-[12.5px] text-fg-secondary">
          <span className="font-semibold text-fg-body">{t("activityLog.resource")}:</span> {log.resourceType}
          {log.resourceId && (
            <span className="ml-1.5 break-all font-mono text-[12px] text-fg-tertiary">{log.resourceId}</span>
          )}
        </div>
      )}
      <div className="eyebrow">{t("activityLog.details")}</div>
      {log.metadata ? (
        <pre
          className={cn(
            "max-h-72 max-w-full overflow-auto whitespace-pre-wrap break-words rounded-[9px] border border-line p-3 font-mono text-[12px] leading-relaxed text-fg-body",
            surface
          )}
        >
          {JSON.stringify(log.metadata, null, 2)}
        </pre>
      ) : (
        <p className="text-[13px] text-fg-tertiary">{t("activityLog.noMetadata")}</p>
      )}
    </div>
  );
}

/** Merged audit and sync log of the signed-in user, with filters, sorting and pagination. */
export function ActivitySection() {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { types, severities } = useActivityLabels();

  const [page, setPage] = useState(0);
  const [filterValues, setFilterValues] = useState<ActivityFilterValues>(EMPTY_ACTIVITY_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  const filters = useMemo(
    () => ({
      type: filterValues.type !== "all" ? filterValues.type : undefined,
      severity: filterValues.severity !== "all" ? filterValues.severity : undefined,
      search: debouncedSearch || undefined,
      startDate: filterValues.startDate || undefined,
      endDate: filterValues.endDate || undefined,
    }),
    [filterValues, debouncedSearch]
  );
  const pagination = useMemo(() => ({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }), [page]);

  const { logs, total, isLoading, isPlaceholderData, error, clearLogs } = useActivityLogs(filters, pagination);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(0);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const hasActiveFilters = countActivityFilters(filterValues) > 0 || !!searchQuery;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  // Every filter change starts again on the first page
  const updateFilters = (patch: Partial<ActivityFilterValues>) => {
    setFilterValues((prev) => ({ ...prev, ...patch }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilterValues(EMPTY_ACTIVITY_FILTERS);
    setSearchQuery("");
    setDebouncedSearch("");
    setPage(0);
  };

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  const handleClearAll = async () => {
    setClearDialogOpen(false);
    if (await clearLogs()) setPage(0);
  };

  // Sorting only reorders the loaded page; the API always returns newest first
  const sortedLogs = [...logs].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case "timestamp":
        comparison = a.timestamp.getTime() - b.timestamp.getTime();
        break;
      case "type":
        comparison = a.type.localeCompare(b.type);
        break;
      case "severity":
        comparison = (SEVERITY_ORDER[a.severity] ?? 0) - (SEVERITY_ORDER[b.severity] ?? 0);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const formatTimestamp = (timestamp: Date) =>
    timestamp instanceof Date && !isNaN(timestamp.getTime()) ? (
      <>
        {format(timestamp, "PP", { locale: dateLocale })}{" "}
        <span className="text-fg-tertiary">{format(timestamp, "HH:mm:ss", { locale: dateLocale })}</span>
      </>
    ) : (
      "—"
    );

  const severityPill = (severity: UnifiedActivityLog["severity"]) => (
    <Pill tone={SEVERITY_TONE[severity] ?? "neutral"}>{severities[severity] ?? severity}</Pill>
  );

  const sortHeader = (column: SortColumn, label: string) => {
    const sorted = sortColumn === column;
    const SortIcon = sortDirection === "asc" ? ChevronUp : ChevronDown;
    return (
      <th
        className="px-3 py-2.5 font-normal"
        aria-sort={sorted ? (sortDirection === "asc" ? "ascending" : "descending") : undefined}
      >
        <button
          type="button"
          onClick={() => handleSort(column)}
          className="eyebrow flex items-center gap-1 transition-colors hover:text-fg-strong"
        >
          {label}
          {sorted && <SortIcon className="size-3.5" />}
        </button>
      </th>
    );
  };

  const paginationFooter = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-[13px] text-fg-secondary">
        {t("activityLog.showingResults", {
          start: page * PAGE_SIZE + 1,
          end: Math.min((page + 1) * PAGE_SIZE, total),
          total,
        })}
      </span>
      {total > PAGE_SIZE && (
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-11 font-semibold lg:h-8"
            onClick={() => setPage((prev) => Math.max(0, prev - 1))}
            disabled={page === 0}
          >
            <ChevronLeft className="size-4" />
            {t("common.previous")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-11 font-semibold lg:h-8"
            onClick={() => setPage((prev) => prev + 1)}
            disabled={!hasMore}
          >
            {t("common.next")}
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}
    </div>
  );

  const table = (
    <div className="overflow-hidden rounded-[12px] border border-line bg-surface-card">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-surface-panel">
            <tr className="border-b border-line">
              <th className="w-10 px-3 py-2.5">
                <span className="sr-only">{t("activityLog.details")}</span>
              </th>
              {sortHeader("timestamp", t("common.labels.time"))}
              {sortHeader("type", t("activityLog.eventType"))}
              <th className="eyebrow px-3 py-2.5">{t("common.labels.action")}</th>
              {/* Below xl the resource moves into the expanded details */}
              <th className="eyebrow hidden px-3 py-2.5 xl:table-cell">{t("activityLog.resource")}</th>
              {sortHeader("severity", t("common.labels.severity"))}
            </tr>
          </thead>
          <tbody className="[&>tr:last-child]:border-b-0">
            {sortedLogs.map((log) => {
              const expanded = expandedRows.has(log.id);
              return (
                <Fragment key={log.id}>
                  <tr
                    className={cn(
                      "cursor-pointer border-b border-line-subtle transition-colors hover:bg-surface-panel",
                      expanded && "bg-surface-panel"
                    )}
                    onClick={() => toggleRow(log.id)}
                  >
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        aria-label={t("activityLog.details")}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRow(log.id);
                        }}
                        className="flex size-6 items-center justify-center rounded-md text-fg-tertiary hover:text-fg-strong"
                      >
                        <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-fg-body">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-body">
                      {types[log.type] ?? log.type}
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <ActionCode action={log.action} />
                    </td>
                    <td className="hidden px-3 py-3 text-[13px] text-fg-secondary xl:table-cell">
                      {log.resourceType ? (
                        <>
                          {log.resourceType}
                          {log.resourceId && (
                            <span className="block max-w-[180px] truncate font-mono text-[11.5px] text-fg-tertiary">
                              {log.resourceId}
                            </span>
                          )}
                        </>
                      ) : (
                        <span className="text-fg-faint">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">{severityPill(log.severity)}</td>
                  </tr>
                  {expanded && (
                    <tr className="border-b border-line-subtle bg-surface-panel">
                      <td colSpan={6} className="px-4 pb-4 pt-1">
                        <LogDetails log={log} surface="bg-surface-card" />
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t border-line bg-surface-panel px-4 py-3">{paginationFooter}</div>
    </div>
  );

  const cards = (
    <div className="flex flex-col gap-2.5">
      {sortedLogs.map((log) => {
        const expanded = expandedRows.has(log.id);
        return (
          <div key={log.id} className="overflow-hidden rounded-[12px] border border-line bg-surface-card">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggleRow(log.id)}
              className="flex w-full flex-col gap-1.5 px-3.5 py-3 text-left"
            >
              <span className="flex w-full items-center gap-2">
                <span className="min-w-0 flex-1">
                  <ActionCode action={log.action} />
                </span>
                {severityPill(log.severity)}
                <ChevronRight
                  className={cn("size-4 shrink-0 text-fg-tertiary transition-transform", expanded && "rotate-90")}
                />
              </span>
              <span className="truncate text-[13.5px] text-fg-body">
                {types[log.type] ?? log.type}
                {log.resourceType && <span className="text-fg-secondary"> · {log.resourceType}</span>}
              </span>
              <span className="font-mono text-[12px] text-fg-tertiary">{formatTimestamp(log.timestamp)}</span>
            </button>
            {expanded && (
              <div className="border-t border-line-subtle px-3.5 pb-3.5 pt-3">
                <LogDetails log={log} surface="bg-surface-panel" />
              </div>
            )}
          </div>
        );
      })}
      <div className="pt-1">{paginationFooter}</div>
    </div>
  );

  const placeholderClass =
    "rounded-[12px] border border-dashed border-control px-4 py-12 text-center text-[13.5px] text-fg-tertiary";

  return (
    <PanelBody>
      <div className={cn(accountWideContentClass, "flex flex-col gap-4")}>
        <SectionHeading
          title={t("activityLog.heading")}
          description={t("activityLog.description")}
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-11 font-semibold text-danger hover:bg-danger-soft hover:text-danger lg:h-[34px]"
              onClick={() => setClearDialogOpen(true)}
              // Clearing ignores the filters, so only an unfiltered empty log disables it
              disabled={total === 0 && !hasActiveFilters}
            >
              <Trash2 className="size-[15px]" />
              {t("activityLog.clearAll")}
            </Button>
          }
        />

        <ActivityToolbar
          desktop={desktop}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          filters={filterValues}
          onChange={updateFilters}
          onClear={clearFilters}
          total={isLoading && logs.length === 0 ? null : total}
        />

        {isLoading && logs.length === 0 ? (
          <div className={placeholderClass}>{t("common.loading")}</div>
        ) : error ? (
          <StatusBanner tone="danger" icon={TriangleAlert} title={t("common.error")}>
            {error.message || String(error)}
          </StatusBanner>
        ) : logs.length === 0 ? (
          <div className={placeholderClass}>
            {hasActiveFilters ? t("common.noResults") : t("activityLog.noLogs")}
          </div>
        ) : (
          <div className={cn(isPlaceholderData && "opacity-60")}>{desktop ? table : cards}</div>
        )}
      </div>

      <ConfirmationDialog
        open={clearDialogOpen}
        onOpenChange={setClearDialogOpen}
        onConfirm={handleClearAll}
        title={t("activityLog.clearAll")}
        description={t("activityLog.confirmClear")}
        confirmText={t("common.delete")}
        cancelText={t("common.cancel")}
        confirmVariant="destructive"
      />
    </PanelBody>
  );
}
