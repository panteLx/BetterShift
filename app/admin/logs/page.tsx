"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useAdminAuditLogs, type AuditLog } from "@/hooks/useAdminAuditLogs";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditLogDetailsDialog } from "@/components/admin/audit-log-details-dialog";
import { AuditLogDeleteDialog } from "@/components/admin/audit-log-delete-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
  Filter,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";

/**
 * Admin Audit Logs Page
 *
 * Features:
 * - View all audit logs (admin + superadmin)
 * - Advanced filters (action, severity, user, date range)
 * - Sortable columns
 * - Expandable rows for metadata
 * - Pagination (50 per page)
 * - Delete old logs (superadmin only)
 * - Responsive design
 */
export default function AdminAuditLogsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const isSuperAdmin = useIsSuperAdmin();

  // Filter State
  const [page, setPage] = useState(0);
  const limit = 25;
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Sort State
  const [sortColumn, setSortColumn] = useState<
    "timestamp" | "action" | "severity" | "user" | "ipAddress"
  >("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Build filters and sort for hook
  const filters = useMemo(
    () => ({
      action: actionFilter !== "all" ? actionFilter : undefined,
      severity:
        severityFilter !== "all"
          ? (severityFilter as "info" | "warning" | "error" | "critical")
          : undefined,
      search: debouncedSearch || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    }),
    [actionFilter, severityFilter, debouncedSearch, startDate, endDate]
  );

  const sort = useMemo(
    () => ({
      field: sortColumn,
      direction: sortDirection,
    }),
    [sortColumn, sortDirection]
  );

  const pagination = useMemo(
    () => ({
      limit,
      offset: page * limit,
    }),
    [page, limit]
  );

  // Use hook with live updates
  const { logs, total, isLoading } = useAdminAuditLogs(
    filters,
    sort,
    pagination
  );

  // UI State
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Memoized helper functions for badge colors
  const getSeverityColor = useMemo(
    () => (severity: string) => {
      switch (severity) {
        case "info":
          return "bg-blue-500/10 text-blue-500 border-blue-500/20";
        case "warning":
          return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
        case "error":
          return "bg-orange-500/10 text-orange-500 border-orange-500/20";
        case "critical":
          return "bg-red-500/10 text-red-500 border-red-500/20";
        default:
          return "bg-gray-500/10 text-gray-500 border-gray-500/20";
      }
    },
    []
  );

  const getActionColor = useMemo(
    () => (action: string) => {
      if (action.startsWith("admin.")) {
        return "bg-red-500/10 text-red-500 border-red-500/20";
      }
      if (action.startsWith("calendar.")) {
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      }
      if (action.startsWith("auth.")) {
        return "bg-green-500/10 text-green-500 border-green-500/20";
      }
      if (action.startsWith("security.")) {
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      }
      return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    },
    []
  );

  const getUserInitials = useMemo(
    () => (name: string | null) => {
      if (!name) return "?";
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    },
    []
  );

  // Handler functions that combine filter changes with page reset
  const handleActionFilterChange = (value: string) => {
    setActionFilter(value);
    setPage(0);
    setSelectedLogIds([]);
    setExpandedRows(new Set());
  };

  const handleSeverityFilterChange = (value: string) => {
    setSeverityFilter(value);
    setPage(0);
    setSelectedLogIds([]);
    setExpandedRows(new Set());
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setPage(0);
    setSelectedLogIds([]);
    setExpandedRows(new Set());
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setPage(0);
    setSelectedLogIds([]);
    setExpandedRows(new Set());
  };

  const handleDebouncedSearchChange = (value: string) => {
    setDebouncedSearch(value);
    setPage(0);
    setSelectedLogIds([]);
    setExpandedRows(new Set());
  };

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      handleDebouncedSearchChange(searchQuery);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Toggle row expansion
  const toggleRow = (logId: string) => {
    setExpandedRows((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Handle sort column click - now triggers backend sort
  const handleSort = (
    column: "timestamp" | "action" | "severity" | "user" | "ipAddress"
  ) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Handle pagination
  const goToNextPage = () => {
    if (page * limit + logs.length < total) {
      setPage((prev) => prev + 1);
    }
  };

  const goToPreviousPage = () => {
    if (page > 0) {
      setPage((prev) => prev - 1);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setActionFilter("all");
    setSeverityFilter("all");
    setSearchQuery("");
    setStartDate("");
    setEndDate("");
    setPage(0);
    // Immediately clear debouncedSearch to prevent stale value
    handleDebouncedSearchChange("");
  };

  // Checkbox selection handlers
  const toggleLogSelection = (logId: string) => {
    setSelectedLogIds((prev) =>
      prev.includes(logId)
        ? prev.filter((id) => id !== logId)
        : [...prev, logId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLogIds.length === logs.length) {
      setSelectedLogIds([]);
    } else {
      setSelectedLogIds(logs.map((log) => log.id));
    }
  };

  const clearSelection = () => {
    setSelectedLogIds([]);
  };

  const isAllSelected =
    logs.length > 0 && selectedLogIds.length === logs.length;

  // Show loader only on initial load
  if (isLoading && logs.length === 0) {
    return <FullscreenLoader />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("admin.auditLogs")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("admin.auditLogsDescription")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline ml-2">
                {t("admin.deleteOldLogs")}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin.searchLogs")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Action Type Filter */}
          <Select value={actionFilter} onValueChange={handleActionFilterChange}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allActions")}</SelectItem>
              <SelectItem value="admin.">{t("admin.adminActions")}</SelectItem>
              <SelectItem value="calendar.">
                {t("admin.calendarActions")}
              </SelectItem>
              <SelectItem value="auth.">{t("admin.authActions")}</SelectItem>
              <SelectItem value="security.">
                {t("admin.securityActions")}
              </SelectItem>
            </SelectContent>
          </Select>

          {/* Severity Filter */}
          <Select
            value={severityFilter}
            onValueChange={handleSeverityFilterChange}
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("common.filters.allSeverities")}
              </SelectItem>
              <SelectItem value="info">{t("common.severity.info")}</SelectItem>
              <SelectItem value="warning">
                {t("common.severity.warning")}
              </SelectItem>
              <SelectItem value="error">
                {t("common.severity.error")}
              </SelectItem>
              <SelectItem value="critical">
                {t("common.severity.critical")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              {t("common.labels.startDate")}
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
            />
          </div>

          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">
              {t("common.labels.endDate")}
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
            />
          </div>

          {/* Clear Filters Button */}
          {(actionFilter !== "all" ||
            severityFilter !== "all" ||
            searchQuery ||
            startDate ||
            endDate) && (
            <div className="flex items-end">
              <Button variant="outline" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                {t("common.filters.clearFilters")}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <p>
          {t("admin.showingLogs", {
            from: page * limit + 1,
            to: Math.min(page * limit + logs.length, total),
            total,
          })}
        </p>
      </div>

      {/* Bulk Actions Bar */}
      {selectedLogIds.length > 0 && isSuperAdmin && (
        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">
              {t("admin.selectedLogs", { count: selectedLogIds.length })}
            </span>
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              <X className="h-4 w-4 mr-2" />
              {t("admin.clearSelection")}
            </Button>
          </div>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {t("common.deleteSelected")}
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              {isSuperAdmin && (
                <TableHead className="w-[50px]">
                  <Checkbox
                    checked={isAllSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
              )}
              <TableHead className="w-[50px]"></TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("timestamp")}
              >
                <div className="flex items-center gap-2">
                  {t("admin.timestamp")}
                  {sortColumn === "timestamp" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("action")}
              >
                <div className="flex items-center gap-2">
                  {t("common.labels.action")}
                  {sortColumn === "action" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("user")}
              >
                <div className="flex items-center gap-2">
                  {t("common.labels.user")}
                  {sortColumn === "user" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("severity")}
              >
                <div className="flex items-center gap-2">
                  {t("common.labels.severity")}
                  {sortColumn === "severity" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => handleSort("ipAddress")}
              >
                <div className="flex items-center gap-2">
                  {t("common.labels.ipAddress")}
                  {sortColumn === "ipAddress" &&
                    (sortDirection === "asc" ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    ))}
                </div>
              </TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isSuperAdmin ? 8 : 7}
                  className="text-center py-8 text-muted-foreground"
                >
                  {isLoading ? t("common.loading") : t("admin.noLogsFound")}
                </TableCell>
              </TableRow>
            ) : (
              logs.map((log) => (
                <React.Fragment key={log.id}>
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleRow(log.id)}
                  >
                    {isSuperAdmin && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={selectedLogIds.includes(log.id)}
                          onCheckedChange={() => toggleLogSelection(log.id)}
                        />
                      </TableCell>
                    )}
                    <TableCell>
                      {expandedRows.has(log.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(log.timestamp), "PPp", {
                        locale: dateLocale,
                      })}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getActionColor(log.action)}
                      >
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {log.userId ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {log.userImage && (
                              <AvatarImage
                                src={log.userImage}
                                alt={log.userName || ""}
                              />
                            )}
                            <AvatarFallback className="text-xs">
                              {getUserInitials(log.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm">
                            {log.userName ||
                              log.userEmail ||
                              t("admin.unknownUser")}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {t("admin.systemAction")}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={getSeverityColor(log.severity)}
                      >
                        {log.severity}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {log.ipAddress || "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedLog(log);
                          setShowDetailsDialog(true);
                        }}
                      >
                        {t("common.viewDetails")}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {expandedRows.has(log.id) && (
                    <TableRow>
                      <TableCell
                        colSpan={isSuperAdmin ? 8 : 7}
                        className="bg-muted/50"
                      >
                        <div className="p-4 space-y-2">
                          <div className="text-sm font-medium">
                            {t("admin.metadata")}:
                          </div>
                          <pre className="text-xs bg-background p-3 rounded border overflow-x-auto">
                            {JSON.stringify(log.metadata, null, 2)}
                          </pre>
                          {log.userAgent && (
                            <div className="text-xs text-muted-foreground">
                              <span className="font-medium">
                                {t("admin.userAgent")}:
                              </span>{" "}
                              {log.userAgent}
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {t("admin.page")} {page + 1} {t("common.of")}{" "}
            {Math.ceil(total / limit)}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goToPreviousPage}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToNextPage}
              disabled={page * limit + logs.length >= total}
            >
              {t("common.next")}
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      {selectedLog && (
        <AuditLogDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          log={selectedLog}
        />
      )}

      <AuditLogDeleteDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        selectedLogIds={selectedLogIds}
        onSuccess={() => {
          setPage(0);
          clearSelection();
          // No manual refetch needed - React Query will auto-update
        }}
      />
    </div>
  );
}
