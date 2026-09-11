"use client";

import { Fragment, KeyboardEvent, MouseEvent, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronRight, SlidersHorizontal, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AdminMobileCard,
  AdminPageHeader,
  AdminSearch,
  AdminTableCard,
  AdminTableHead,
  AdminTableRow,
  SeverityPill,
} from "@/components/admin/admin-kit";
import { SortHeader, nextSort, type SortState } from "@/components/admin/admin-table-controls";
import { AuditLogDetailsDialog } from "@/components/admin/audit-log-details-dialog";
import { AuditLogDeleteDialog } from "@/components/admin/audit-log-delete-dialog";
import {
  AuditFilterBar,
  AuditFilterChips,
  AuditFilterSheet,
  EMPTY_AUDIT_FILTERS,
  hasAuditFilters,
  type AuditFilterValues,
} from "@/components/admin/audit-log-filters";
import { useAuditDescription } from "@/components/admin/audit-describe";
import { useAdminAuditLogs, type AuditLog, type AuditLogFilters } from "@/hooks/useAdminAuditLogs";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";
import { useDebouncedSearch, useResettableState } from "@/hooks/useAdminList";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

type SortColumn = "timestamp" | "action" | "severity" | "user" | "ipAddress";

const PAGE_SIZE = 25;
// Stable identities so the resettable state falls back to the same value
const EMPTY_ROWS: Set<string> = new Set();
const EMPTY_IDS: string[] = [];
const COLUMNS = "18px 160px 180px minmax(0,140px) 96px minmax(0,1fr) 118px 64px";

const stop = (e: MouseEvent | KeyboardEvent) => e.stopPropagation();

export default function AdminAuditLogsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const isSuperAdmin = useIsSuperAdmin();
  const describe = useAuditDescription();

  const search = useDebouncedSearch(500);
  const [filterValues, setFilterValues] = useState<AuditFilterValues>(EMPTY_AUDIT_FILTERS);
  const [sort, setSort] = useState<SortState<SortColumn>>({ column: "timestamp", direction: "desc" });

  // Any change to search or filters starts over on the first page, with nothing selected
  const listKey = [search.query, filterValues.action, filterValues.severity, filterValues.startDate, filterValues.endDate].join("|");
  const [page, setPage] = useResettableState(listKey, 0);
  const [expandedRows, setExpandedRows] = useResettableState<Set<string>>(listKey, EMPTY_ROWS);
  const [selectedLogIds, setSelectedLogIds] = useResettableState<string[]>(listKey, EMPTY_IDS);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showFilterSheet, setShowFilterSheet] = useState(false);

  const filters = useMemo<AuditLogFilters>(
    () => ({
      action: filterValues.action !== "all" ? filterValues.action : undefined,
      severity:
        filterValues.severity !== "all" ? (filterValues.severity as AuditLogFilters["severity"]) : undefined,
      search: search.query || undefined,
      startDate: filterValues.startDate || undefined,
      endDate: filterValues.endDate || undefined,
    }),
    [filterValues, search.query]
  );
  const sortParams = useMemo(() => ({ field: sort.column, direction: sort.direction }), [sort]);
  const pagination = useMemo(() => ({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }), [page]);

  const { logs, total, isLoading } = useAdminAuditLogs(filters, sortParams, pagination);

  const updateFilters = (patch: Partial<AuditFilterValues>) => {
    setFilterValues((prev) => ({ ...prev, ...patch }));
  };

  const clearFilters = () => {
    setFilterValues(EMPTY_AUDIT_FILTERS);
    search.setInput("");
  };

  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  };

  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds((prev) => (prev.includes(logId) ? prev.filter((id) => id !== logId) : [...prev, logId]));
  };

  const isAllSelected = logs.length > 0 && selectedLogIds.length === logs.length;
  const toggleSelectAll = () => setSelectedLogIds(isAllSelected ? [] : logs.map((log) => log.id));

  const openDetails = (log: AuditLog) => {
    setSelectedLog(log);
    setShowDetailsDialog(true);
  };

  const hasNext = page * PAGE_SIZE + logs.length < total;
  const template = isSuperAdmin ? `20px ${COLUMNS}` : COLUMNS;
  const formatTimestamp = (date: Date) => format(date, "PP p", { locale: dateLocale });
  const userLabel = (log: AuditLog) =>
    log.userId ? log.userName || log.userEmail || t("admin.unknownUser") : t("admin.systemAction");

  const sortHeader = (column: SortColumn, label: string) => (
    <SortHeader column={column} label={label} sort={sort} onSort={(c) => setSort((s) => nextSort(s, c))} />
  );

  const pager = (
    <div className="flex shrink-0 gap-[7px]">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setPage((p) => Math.max(0, p - 1))}
        disabled={page === 0}
        className="h-[30px] rounded-lg px-[11px] text-[12.5px]"
      >
        {t("common.previous")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => hasNext && setPage((p) => p + 1)}
        disabled={!hasNext}
        className="h-[30px] rounded-lg px-[11px] text-[12.5px] font-semibold"
      >
        {t("common.next")}
      </Button>
    </div>
  );

  const showing =
    total > 0
      ? t("admin.showingLogs", {
          from: page * PAGE_SIZE + 1,
          to: Math.min(page * PAGE_SIZE + logs.length, total),
          total,
        })
      : "";

  const emptyText = isLoading ? t("common.loading") : t("admin.noLogsFound");

  return (
    <div className="flex flex-col gap-3 lg:gap-4">
      <AdminPageHeader
        title={t("admin.auditLogs")}
        subtitle={t("adminAudit.subtitle", { count: total })}
        actions={
          isSuperAdmin && (
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(true)}
              className="h-[38px] gap-2 rounded-[9px] border-warning-line bg-warning-surface px-3.5 font-semibold text-warning-title hover:bg-warning-soft hover:text-warning-title dark:border-warning-line dark:bg-warning-surface dark:hover:bg-warning-soft"
            >
              <Trash2 className="size-4" />
              {t("admin.deleteOldLogs")}
            </Button>
          )
        }
        mobileActions={
          <>
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => setShowDeleteDialog(true)}
                aria-label={t("admin.deleteOldLogs")}
                className="flex size-[34px] items-center justify-center rounded-[9px] border border-warning-line bg-warning-surface text-warning-title"
              >
                <Trash2 className="size-[17px]" />
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowFilterSheet(true)}
              aria-label={t("adminAudit.filterTitle")}
              className={cn(
                "relative flex size-[34px] items-center justify-center rounded-[9px] border",
                hasAuditFilters(filterValues) ? "border-brand text-brand-ink" : "border-line text-fg-secondary"
              )}
            >
              <SlidersHorizontal className="size-[17px]" />
              {hasAuditFilters(filterValues) && (
                <span className="absolute right-1 top-1 size-1.5 rounded-full bg-brand" />
              )}
            </button>
          </>
        }
      />

      <div className="flex flex-wrap items-center gap-[9px]">
        <AdminSearch
          value={search.input}
          onChange={search.setInput}
          placeholder={t("admin.searchLogs")}
          className="lg:w-[340px]"
        />
        <div className="hidden flex-wrap items-center gap-[9px] lg:flex">
          <AuditFilterBar filters={filterValues} onChange={updateFilters} onClear={clearFilters} />
        </div>
      </div>
      <AuditFilterChips filters={filterValues} onOpen={() => setShowFilterSheet(true)} />

      {selectedLogIds.length > 0 && isSuperAdmin && (
        <div className="hidden items-center justify-between gap-3 rounded-[11px] border border-line bg-surface-panel px-3.5 py-2.5 lg:flex">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-fg-strong">
              {t("admin.selectedLogs", { count: selectedLogIds.length })}
            </span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedLogIds([])} className="h-8 text-fg-secondary">
              <X className="size-4" />
              {t("admin.clearSelection")}
            </Button>
          </div>
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} className="h-8 font-semibold">
            <Trash2 className="size-4" />
            {t("common.deleteSelected")}
          </Button>
        </div>
      )}

      {/* Desktop table */}
      <AdminTableCard
        className="hidden lg:block"
        footer={
          total > 0 && (
            <>
              <span>{showing}</span>
              {pager}
            </>
          )
        }
      >
        <AdminTableHead
          template={template}
          columns={[
            ...(isSuperAdmin
              ? [
                  <Checkbox
                    key="all"
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label={t("adminAudit.selectAll")}
                  />,
                ]
              : []),
            "",
            sortHeader("timestamp", t("admin.timestamp")),
            sortHeader("action", t("common.labels.action")),
            sortHeader("user", t("common.labels.user")),
            sortHeader("severity", t("adminAudit.severityShort")),
            t("adminAudit.whatHappened"),
            sortHeader("ipAddress", t("common.labels.ipAddress")),
            "",
          ]}
        />
        {logs.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-fg-tertiary">{emptyText}</div>
        ) : (
          logs.map((log) => {
            const expanded = expandedRows.has(log.id);
            return (
              <Fragment key={log.id}>
                <AdminTableRow template={template} onClick={() => toggleRow(log.id)}>
                  {isSuperAdmin && (
                    <div onClick={stop} onKeyDown={stop} className="flex">
                      <Checkbox
                        checked={selectedLogIds.includes(log.id)}
                        onCheckedChange={() => toggleLogSelection(log.id)}
                        aria-label={t("adminAudit.selectEntry")}
                      />
                    </div>
                  )}
                  <ChevronRight
                    className={cn(
                      "size-[15px] transition-transform",
                      expanded ? "rotate-90 text-fg-secondary" : "text-fg-faint"
                    )}
                  />
                  <span className="font-mono text-[12.5px] text-fg-body">{formatTimestamp(log.timestamp)}</span>
                  <span className="max-w-full justify-self-start truncate rounded-[6px] bg-surface-sunken px-2 py-[3px] font-mono text-[12px] font-medium text-fg-body">
                    {log.action}
                  </span>
                  <span className={cn("truncate text-[13px]", log.userId ? "text-fg-body" : "text-fg-tertiary")}>
                    {userLabel(log)}
                  </span>
                  <span className="justify-self-start">
                    <SeverityPill severity={log.severity} />
                  </span>
                  <span className="truncate text-[12.5px] text-fg-tertiary">{describe(log)}</span>
                  <span className="truncate font-mono text-[12px] text-fg-tertiary">{log.ipAddress || "—"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDetails(log);
                    }}
                    onKeyDown={stop}
                    className="justify-self-end text-[12.5px] font-semibold text-brand-ink hover:underline"
                  >
                    {t("adminAudit.details")}
                  </button>
                </AdminTableRow>
                {expanded && (
                  <div className="flex flex-col gap-2 border-b border-line-subtle bg-surface-panel px-4 py-3">
                    <div className="eyebrow">{t("admin.metadata")}</div>
                    <pre className="max-h-72 overflow-auto rounded-lg border border-line bg-background p-3 font-mono text-[12px] text-fg-body">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                    {log.userAgent && (
                      <div className="text-[12px] text-fg-tertiary">
                        <span className="font-semibold text-fg-secondary">{t("admin.userAgent")}:</span>{" "}
                        {log.userAgent}
                      </div>
                    )}
                  </div>
                )}
              </Fragment>
            );
          })
        )}
      </AdminTableCard>

      {/* Phone cards */}
      <div className="flex flex-col gap-[9px] lg:hidden">
        {logs.length === 0 ? (
          <div className="rounded-[11px] border border-line px-4 py-8 text-center text-[13px] text-fg-tertiary">
            {emptyText}
          </div>
        ) : (
          logs.map((log) => (
            <AdminMobileCard key={log.id} onClick={() => openDetails(log)}>
              <div className="flex w-full items-center gap-2">
                <span className="min-w-0 truncate rounded-[6px] bg-surface-sunken px-2 py-[3px] font-mono text-[12px] font-medium text-fg-body">
                  {log.action}
                </span>
                <span className="flex-1" />
                <SeverityPill severity={log.severity} />
                <ChevronRight className="size-4 shrink-0 text-fg-faint" />
              </div>
              <div className="text-[13.5px] leading-snug text-fg-body">{describe(log)}</div>
              <div className="flex min-w-0 items-center gap-1.5 text-[12px] text-fg-tertiary">
                <span className="truncate">{userLabel(log)}</span>
                <span className="text-fg-faint">·</span>
                <span className="shrink-0 font-mono">{formatTimestamp(log.timestamp)}</span>
              </div>
            </AdminMobileCard>
          ))
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 pt-1 text-[12px] text-fg-tertiary">
            <span className="min-w-0">{showing}</span>
            {pager}
          </div>
        )}
      </div>

      {selectedLog && (
        <AuditLogDetailsDialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog} log={selectedLog} />
      )}

      <AuditLogDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedLogIds={selectedLogIds}
        onSuccess={() => {
          setPage(0);
          setSelectedLogIds([]);
        }}
      />

      <AuditFilterSheet
        open={showFilterSheet}
        onOpenChange={setShowFilterSheet}
        filters={filterValues}
        onChange={updateFilters}
        onClear={clearFilters}
      />
    </div>
  );
}
