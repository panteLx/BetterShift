"use client";

import { Fragment, useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { format } from "date-fns";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Search,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLogs, type UnifiedActivityLog } from "@/hooks/useActivityLogs";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { ChoiceChips, inputClass, Pill } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { UserMenu } from "@/components/user-menu";
import { AccountPageHeader } from "@/components/profile/account-layout";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type TypeFilter = "all" | UnifiedActivityLog["type"];
type SeverityFilter = "all" | UnifiedActivityLog["severity"];
type SortColumn = "timestamp" | "type" | "severity";

const SEVERITY_ORDER = { info: 0, warning: 1, error: 2, critical: 3 };

const SEVERITY_TONE = {
  info: "neutral",
  warning: "warning",
  error: "danger",
  critical: "danger",
} as const;

// Chip rows scroll sideways on phones instead of wrapping into a tall block
const chipRowClass =
  "-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0 [&_[role=radiogroup]]:flex-nowrap lg:[&_[role=radiogroup]]:flex-wrap [&_button]:shrink-0 [&_button]:whitespace-nowrap";

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
      <div className="eyebrow">{t("activityLog.details")}</div>
      {log.metadata ? (
        <pre
          className={cn(
            "max-w-full overflow-auto whitespace-pre-wrap break-words rounded-[9px] border border-line p-3 font-mono text-[12px] leading-relaxed text-fg-body",
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
export default function ActivityLogPage() {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const router = useRouter();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { isLoading: authLoading, isAuthenticated } = useAuth();

  const [page, setPage] = useState(0);
  const limit = 50;
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [sortColumn, setSortColumn] = useState<SortColumn | null>("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filters = useMemo(
    () => ({
      type: typeFilter !== "all" ? typeFilter : undefined,
      severity: severityFilter !== "all" ? severityFilter : undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [typeFilter, severityFilter, debouncedSearch, startDate, endDate]
  );

  const pagination = useMemo(
    () => ({
      limit,
      offset: page * limit,
    }),
    [page, limit]
  );

  const { logs, total, isLoading, error, clearLogs } = useActivityLogs(filters, pagination);

  const hasMore = (page + 1) * limit < total;

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [clearDialogOpen, setClearDialogOpen] = useState(false);

  // Every filter change starts again on the first page
  const handleTypeFilterChange = (value: TypeFilter) => {
    setTypeFilter(value);
    setPage(0);
  };

  const handleSeverityFilterChange = (value: SeverityFilter) => {
    setSeverityFilter(value);
    setPage(0);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setPage(0);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setPage(0);
  };

  const handleDebouncedSearchChange = useCallback((value: string) => {
    setDebouncedSearch(value);
    setPage(0);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      handleDebouncedSearchChange(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, handleDebouncedSearchChange]);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Only the initial auth check blocks the page; refetches keep the table visible
  if (authLoading) {
    return <FullscreenLoader />;
  }

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  };

  const sortedLogs = [...logs].sort((a, b) => {
    if (!sortColumn) return 0;

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
    await clearLogs();
  };

  const clearFilters = () => {
    setTypeFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setStartDate("");
    setEndDate("");
    setPage(0);
  };

  const hasActiveFilters =
    typeFilter !== "all" || severityFilter !== "all" || startDate || endDate || searchQuery;

  const goToNextPage = () => setPage((prev) => prev + 1);
  const goToPreviousPage = () => setPage((prev) => Math.max(0, prev - 1));

  const typeLabels: Record<UnifiedActivityLog["type"], string> = {
    auth: t("activityLog.auth"),
    calendar: t("activityLog.calendar"),
    sync: t("activityLog.sync"),
    security: t("activityLog.security"),
  };
  const severityLabels: Record<UnifiedActivityLog["severity"], string> = {
    info: t("common.severity.info"),
    warning: t("common.severity.warning"),
    error: t("common.severity.error"),
    critical: t("common.severity.critical"),
  };

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
    <Pill tone={SEVERITY_TONE[severity] ?? "neutral"}>{severityLabels[severity] ?? severity}</Pill>
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
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <span className="text-[13px] text-fg-secondary">
        {t("activityLog.showingResults", {
          start: page * limit + 1,
          end: Math.min((page + 1) * limit, total),
          total,
        })}
      </span>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="h-8 font-semibold"
          onClick={goToPreviousPage}
          disabled={page === 0}
        >
          <ChevronLeft className="size-4" />
          {t("common.previous")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8 font-semibold"
          onClick={goToNextPage}
          disabled={!hasMore}
        >
          {t("common.next")}
          <ChevronRight className="size-4" />
        </Button>
      </div>
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
              <th className="eyebrow px-3 py-2.5">{t("activityLog.resource")}</th>
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
                        <ChevronRight
                          className={cn("size-4 transition-transform", expanded && "rotate-90")}
                        />
                      </button>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-[12.5px] text-fg-body">
                      {formatTimestamp(log.timestamp)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-[13px] text-fg-body">
                      {typeLabels[log.type] ?? log.type}
                    </td>
                    <td className="max-w-[260px] px-3 py-3">
                      <ActionCode action={log.action} />
                    </td>
                    <td className="px-3 py-3 text-[13px] text-fg-secondary">
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
      <div className="border-t border-line bg-surface-panel">{paginationFooter}</div>
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
                  className={cn(
                    "size-4 shrink-0 text-fg-tertiary transition-transform",
                    expanded && "rotate-90"
                  )}
                />
              </span>
              <span className="truncate text-[13.5px] text-fg-body">
                {typeLabels[log.type] ?? log.type}
                {log.resourceType && <span className="text-fg-secondary"> · {log.resourceType}</span>}
              </span>
              <span className="font-mono text-[12px] text-fg-tertiary">
                {formatTimestamp(log.timestamp)}
              </span>
            </button>
            {expanded && (
              <div className="border-t border-line-subtle px-3.5 pb-3.5 pt-3">
                {log.resourceId && (
                  <div className="mb-3 truncate font-mono text-[12px] text-fg-tertiary">
                    {log.resourceId}
                  </div>
                )}
                <LogDetails log={log} surface="bg-surface-panel" />
              </div>
            )}
          </div>
        );
      })}
      <div className="-mx-4">{paginationFooter}</div>
    </div>
  );

  const placeholderClass =
    "rounded-[12px] border border-dashed border-control px-4 py-12 text-center text-[13.5px] text-fg-tertiary";

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <AccountPageHeader
        className="sticky top-0 z-20"
        title={t("activityLog.title")}
        subtitle={t("activityLog.description")}
        backHref="/profile"
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              className="h-9 font-semibold text-danger hover:bg-danger-soft hover:text-danger lg:h-8"
              onClick={() => setClearDialogOpen(true)}
              disabled={total === 0}
              aria-label={t("activityLog.clearAll")}
            >
              <Trash2 className="size-4" />
              <span className="hidden sm:inline">{t("activityLog.clearAll")}</span>
            </Button>
            <UserMenu />
          </>
        }
      />

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-5 lg:px-[22px] lg:py-6">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 sm:min-w-[240px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
              <Input
                placeholder={t("activityLog.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(inputClass, "pl-9")}
              />
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={startDate}
                onChange={(e) => handleStartDateChange(e.target.value)}
                aria-label={t("common.labels.startDate")}
                className={cn(inputClass, "min-w-0 flex-1 font-mono text-[13px] sm:w-[150px] sm:flex-none")}
              />
              <span className="text-fg-tertiary">–</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => handleEndDateChange(e.target.value)}
                aria-label={t("common.labels.endDate")}
                className={cn(inputClass, "min-w-0 flex-1 font-mono text-[13px] sm:w-[150px] sm:flex-none")}
              />
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                className="h-10 self-start font-semibold text-fg-secondary sm:self-auto"
                onClick={clearFilters}
              >
                <X className="size-4" />
                {t("common.filters.clearFilters")}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center lg:gap-x-5">
            <div className={chipRowClass}>
              <ChoiceChips
                label={t("activityLog.eventType")}
                value={typeFilter}
                onChange={handleTypeFilterChange}
                options={[
                  { value: "all", label: t("activityLog.allTypes") },
                  { value: "auth", label: typeLabels.auth },
                  { value: "calendar", label: typeLabels.calendar },
                  { value: "sync", label: typeLabels.sync },
                  { value: "security", label: typeLabels.security },
                ]}
              />
            </div>
            <div className={chipRowClass}>
              <ChoiceChips
                label={t("common.labels.severity")}
                value={severityFilter}
                onChange={handleSeverityFilterChange}
                options={[
                  { value: "all", label: t("common.filters.allSeverities") },
                  { value: "info", label: severityLabels.info },
                  { value: "warning", label: severityLabels.warning },
                  { value: "error", label: severityLabels.error },
                  { value: "critical", label: severityLabels.critical },
                ]}
              />
            </div>
            <span className="text-[12.5px] text-fg-tertiary lg:ml-auto">
              {t("activityLog.totalLogs", { count: total })}
            </span>
          </div>
        </div>

        {isLoading && logs.length === 0 ? (
          <div className={placeholderClass}>{t("common.loading")}</div>
        ) : error ? (
          <StatusBanner tone="danger" icon={TriangleAlert} title={t("common.error")}>
            {error?.message || String(error)}
          </StatusBanner>
        ) : logs.length === 0 ? (
          <div className={placeholderClass}>{t("activityLog.noLogs")}</div>
        ) : desktop ? (
          table
        ) : (
          cards
        )}
      </main>

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
    </div>
  );
}
