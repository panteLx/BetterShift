"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { useAuth } from "@/hooks/useAuth";
import { useActivityLogs } from "@/hooks/useActivityLogs";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import {
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Activity Log Page - Full-screen table view for user activity logs
 *
 * Features:
 * - Merged view of auditLogs + syncLogs
 * - Advanced filters (type, date range, severity, search)
 * - Sortable columns
 * - Expandable rows for metadata
 * - Pagination
 * - Actions: Clear all, Mark all as read, Refresh
 * - Responsive design
 */
export default function ActivityLogPage() {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const router = useRouter();
  const { isLoading: authLoading, isAuthenticated } = useAuth();
  const versionInfo = useVersionInfo();
  const {
    logs,
    total,
    page,
    limit,
    hasMore,
    loading,
    error,
    filters,
    updateFilters,
    clearFilters,
    fetchLogs,
    clearLogs,
    goToNextPage,
    goToPreviousPage,
  } = useActivityLogs();

  // UI State (must be defined before any early returns)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<
    "timestamp" | "type" | "severity" | null
  >("timestamp");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Show fullscreen loader during initial data fetch
  if (authLoading || loading) {
    return <FullscreenLoader />;
  }

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

  // Sort logs
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
        const severityOrder = { info: 0, warning: 1, error: 2, critical: 3 };
        comparison =
          (severityOrder[a.severity as keyof typeof severityOrder] ?? 0) -
          (severityOrder[b.severity as keyof typeof severityOrder] ?? 0);
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Handle sort column click
  const handleSort = (column: "timestamp" | "type" | "severity") => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  // Severity badge color
  const getSeverityColor = (severity: string) => {
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
  };

  // Type badge color
  const getTypeColor = (type: string) => {
    switch (type) {
      case "auth":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "calendar":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      case "sync":
        return "bg-cyan-500/10 text-cyan-500 border-cyan-500/20";
      case "security":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20";
    }
  };

  // Handle date changes
  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    updateFilters({
      startDate: value ? new Date(value) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    updateFilters({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: value ? new Date(value) : undefined,
    });
  };

  // Clear all logs with confirmation
  const handleClearAll = async () => {
    setClearDialogOpen(false);
    await clearLogs();
  };

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader showUserMenu />

      <div className="flex-1 bg-gradient-to-br from-background via-background to-primary/5">
        <main className="container py-4 sm:py-8 max-w-full sm:max-w-6xl mx-auto px-2 sm:px-4">
          {/* Header */}
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
              {t("activityLog.title")}
            </h1>
            <p className="text-sm text-muted-foreground">
              {t("activityLog.description")}
            </p>
          </div>

          {/* Filters Bar */}
          <div className="mb-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Type Filter */}
              <Select
                value={filters.type || "all"}
                onValueChange={(value) =>
                  updateFilters({
                    type:
                      value === "all"
                        ? undefined
                        : (value as "auth" | "calendar" | "sync" | "security"),
                  })
                }
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder={t("activityLog.allTypes")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("activityLog.allTypes")}
                  </SelectItem>
                  <SelectItem value="auth">{t("activityLog.auth")}</SelectItem>
                  <SelectItem value="calendar">
                    {t("common.labels.calendar")}
                  </SelectItem>
                  <SelectItem value="sync">{t("activityLog.sync")}</SelectItem>
                  <SelectItem value="security">
                    {t("activityLog.security")}
                  </SelectItem>
                </SelectContent>
              </Select>

              {/* Severity Filter */}
              <Select
                value={filters.severity || "all"}
                onValueChange={(value) =>
                  updateFilters({
                    severity:
                      value === "all"
                        ? undefined
                        : (value as "info" | "warning" | "error" | "critical"),
                  })
                }
              >
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue
                    placeholder={t("common.filters.allSeverities")}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("common.filters.allSeverities")}
                  </SelectItem>
                  <SelectItem value="info">
                    {t("common.severity.info")}
                  </SelectItem>
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

              {/* Date Range - Start Date */}
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  placeholder={t("common.labels.startDate")}
                  className="w-full sm:w-[150px]"
                />
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => handleEndDateChange(e.target.value)}
                  placeholder={t("common.labels.endDate")}
                  className="w-full sm:w-[150px]"
                />
              </div>

              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("activityLog.searchPlaceholder")}
                  value={filters.search || ""}
                  onChange={(e) => updateFilters({ search: e.target.value })}
                  className="pl-9"
                />
              </div>

              {/* Clear Filters */}
              {(filters.type ||
                filters.severity ||
                startDate ||
                endDate ||
                filters.search) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    clearFilters();
                    setStartDate("");
                    setEndDate("");
                  }}
                >
                  {t("common.filters.clearFilters")}
                </Button>
              )}
            </div>

            {/* Actions Row */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {t("activityLog.totalLogs", { count: total })}
              </div>

              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await fetchLogs();
                    toast.success(t("activityLog.refreshed"));
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">
                    {t("activityLog.refresh")}
                  </span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={total === 0}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">
                    {t("activityLog.clearAll")}
                  </span>
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          {loading && logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("common.loading")}
            </div>
          ) : error ? (
            <div className="text-center py-12 text-red-500">
              {t("common.error")}: {error}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {t("activityLog.noLogs")}
            </div>
          ) : (
            <div className="border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-sm">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort("timestamp")}
                    >
                      <div className="flex items-center gap-2">
                        {t("common.labels.time")}
                        {sortColumn === "timestamp" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => handleSort("type")}
                    >
                      <div className="flex items-center gap-2">
                        {t("activityLog.eventType")}
                        {sortColumn === "type" &&
                          (sortDirection === "asc" ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          ))}
                      </div>
                    </TableHead>
                    <TableHead>{t("common.labels.action")}</TableHead>
                    <TableHead>{t("activityLog.resource")}</TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/80 transition-colors"
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLogs.map((log) => (
                    <React.Fragment key={log.id}>
                      <TableRow
                        className="cursor-pointer"
                        onClick={() => toggleRow(log.id)}
                      >
                        <TableCell className="text-center">
                          {expandedRows.has(log.id) ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {log.timestamp &&
                          log.timestamp instanceof Date &&
                          !isNaN(log.timestamp.getTime()) ? (
                            <>
                              {format(log.timestamp, "MMM dd, yyyy", {
                                locale: dateLocale,
                              })}
                              <br />
                              <span className="text-xs text-muted-foreground">
                                {format(log.timestamp, "HH:mm:ss", {
                                  locale: dateLocale,
                                })}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Invalid date
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn("text-xs", getTypeColor(log.type))}
                          >
                            {t(`activityLog.${log.type}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-mono text-xs">
                          {log.action}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {log.resourceType ? (
                            <span>
                              {log.resourceType}
                              {log.resourceId && (
                                <span className="text-xs block truncate max-w-[150px]">
                                  {log.resourceId}
                                </span>
                              )}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              getSeverityColor(log.severity)
                            )}
                          >
                            {t(`common.severity.${log.severity}`)}
                          </Badge>
                        </TableCell>
                      </TableRow>

                      {/* Expanded Row - Metadata */}
                      {expandedRows.has(log.id) && (
                        <TableRow className="bg-muted/20">
                          <TableCell colSpan={6} className="p-4">
                            <div className="space-y-2">
                              <div className="text-sm font-semibold">
                                {t("activityLog.details")}:
                              </div>
                              {log.metadata ? (
                                <pre className="text-xs bg-background p-3 rounded border whitespace-pre-wrap break-words overflow-auto max-w-full">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  {t("activityLog.noMetadata")}
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between p-4 border-t bg-muted/20">
                <div className="text-sm text-muted-foreground">
                  {t("activityLog.showingResults", {
                    start: page * limit + 1,
                    end: Math.min((page + 1) * limit, total),
                    total,
                  })}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToPreviousPage}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    {t("common.previous")}
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={goToNextPage}
                    disabled={!hasMore}
                  >
                    {t("common.next")}
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      <AppFooter versionInfo={versionInfo} />

      {/* Clear All Confirmation Dialog */}
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
