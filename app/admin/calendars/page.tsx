"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Filter, AlertCircle, Send, Trash2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { CalendarTable } from "@/components/admin/calendar-table";
import { CalendarDetailsSheet } from "@/components/admin/calendar-details-sheet";
import { CalendarEditSheet } from "@/components/admin/calendar-edit-sheet";
import { CalendarTransferSheet } from "@/components/admin/calendar-transfer-sheet";
import { CalendarDeleteDialog } from "@/components/admin/calendar-delete-dialog";
import { CalendarBulkDeleteDialog } from "@/components/admin/calendar-bulk-delete-dialog";
import {
  useAdminCalendars,
  type AdminCalendar,
  type CalendarFilters,
  type CalendarSort,
} from "@/hooks/useAdminCalendars";
import { useAdminLevel } from "@/hooks/useAdminAccess";

export default function AdminCalendarsPage() {
  const t = useTranslations();
  const adminLevel = useAdminLevel();
  const isSuperAdmin = adminLevel === "superadmin";

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "orphaned" | "with-owner"
  >("all");
  const sortField = "createdAt" as const;
  const sortDirection = "desc" as const;

  // Build filters and sort
  const filters: CalendarFilters = {
    search: searchQuery || undefined,
    status: statusFilter,
  };

  const sort: CalendarSort = {
    field: sortField,
    direction: sortDirection,
  };

  // Use hook with filters
  const {
    calendars,
    orphanedCount,
    isLoading,
    deleteCalendar,
    bulkDeleteCalendars,
  } = useAdminCalendars(filters, sort);

  // Selection
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Dialogs & Sheets
  const [selectedCalendar, setSelectedCalendar] =
    useState<AdminCalendar | null>(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Bulk operations
  const [showBulkTransferSheet, setShowBulkTransferSheet] = useState(false);
  const [calendarsForBulkTransfer, setCalendarsForBulkTransfer] = useState<
    AdminCalendar[]
  >([]);

  // Selection handlers
  const handleToggleSelect = (calendarId: string) => {
    setSelectedIds((prev) =>
      prev.includes(calendarId)
        ? prev.filter((id) => id !== calendarId)
        : [...prev, calendarId]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedIds.length === calendars.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(calendars.map((cal) => cal.id));
    }
  };

  const handleClearSelection = () => {
    setSelectedIds([]);
  };

  // Handlers
  const handleCalendarClick = (calendar: AdminCalendar) => {
    setSelectedCalendar(calendar);
    setShowDetailsSheet(true);
  };

  const handleEditCalendar = (calendar: AdminCalendar) => {
    setSelectedCalendar(calendar);
    setShowEditSheet(true);
  };

  const handleTransferCalendar = (calendar: AdminCalendar) => {
    setSelectedCalendar(calendar);
    setShowTransferSheet(true);
  };

  const handleDeleteCalendar = (calendar: AdminCalendar) => {
    setSelectedCalendar(calendar);
    setShowDeleteDialog(true);
  };

  const handleBulkTransfer = () => {
    const selectedCalendars = calendars.filter((cal) =>
      selectedIds.includes(cal.id)
    );
    setCalendarsForBulkTransfer(selectedCalendars);
    setShowBulkTransferSheet(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;

    const success = await bulkDeleteCalendars(selectedIds);
    if (success) {
      setSelectedIds([]);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCalendar) return;
    const success = await deleteCalendar(selectedCalendar.id);
    if (success) {
      setShowDeleteDialog(false);
      setSelectedCalendar(null);
    }
  };

  const handleSuccess = () => {
    setShowEditSheet(false);
    setShowTransferSheet(false);
    setShowBulkTransferSheet(false);
    setSelectedCalendar(null);
    setCalendarsForBulkTransfer([]);
    setSelectedIds([]);
  };

  const handleEditFromDetails = () => {
    setShowDetailsSheet(false);
    setShowEditSheet(true);
  };

  const handleTransferFromDetails = () => {
    setShowDetailsSheet(false);
    setShowTransferSheet(true);
  };

  const handleDeleteFromDetails = () => {
    setShowDetailsSheet(false);
    setShowDeleteDialog(true);
  };

  const isAllSelected =
    calendars.length > 0 && selectedIds.length === calendars.length;
  const hasOrphanedCalendars = orphanedCount > 0;
  const showOrphanedBanner =
    hasOrphanedCalendars && statusFilter !== "with-owner";

  if (isLoading && calendars.length === 0) {
    return <FullscreenLoader />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {t("admin.calendars.title")}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t("admin.calendars.description")}
            </p>
          </div>
        </div>

        {/* Orphaned Calendars Warning Banner */}
        {showOrphanedBanner && (
          <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {t("admin.calendars.orphanedWarning", { count: orphanedCount })}
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                {t("admin.calendars.orphanedWarningDescription")}
              </p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("admin.calendars.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | "orphaned" | "with-owner") =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <SelectValue />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.calendars.allStatuses")}
              </SelectItem>
              <SelectItem value="orphaned">
                {t("admin.calendars.orphanedOnly")}
              </SelectItem>
              <SelectItem value="with-owner">
                {t("admin.calendars.withOwner")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>
            {t("admin.calendars.calendarsCount", { count: calendars.length })}
          </p>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedIds.length > 0 && (
          <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/50">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {t("admin.calendars.selectedCount", {
                  count: selectedIds.length,
                })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkTransfer}>
                <Send className="h-4 w-4 mr-2" />
                {t("admin.calendars.transferSelected")}
              </Button>
              {isSuperAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("common.deleteSelected")}
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleClearSelection}>
                <X className="h-4 w-4 mr-2" />
                {t("admin.calendars.clearSelection")}
              </Button>
            </div>
          </div>
        )}

        {/* Calendar Table */}
        {calendars.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-lg">
            <p className="text-muted-foreground">
              {searchQuery
                ? t("admin.calendars.noSearchResults")
                : t("admin.calendars.noCalendarsFound")}
            </p>
          </div>
        ) : (
          <CalendarTable
            calendars={calendars}
            selectedIds={selectedIds}
            onToggleSelect={handleToggleSelect}
            onToggleSelectAll={handleToggleSelectAll}
            isAllSelected={isAllSelected}
            onCalendarClick={handleCalendarClick}
            onEditCalendar={handleEditCalendar}
            onTransferCalendar={handleTransferCalendar}
            onDeleteCalendar={handleDeleteCalendar}
          />
        )}

        {/* Calendar Details Sheet */}
        {selectedCalendar && (
          <CalendarDetailsSheet
            open={showDetailsSheet}
            onOpenChange={setShowDetailsSheet}
            calendarId={selectedCalendar.id}
            onEdit={handleEditFromDetails}
            onTransfer={handleTransferFromDetails}
            onDelete={handleDeleteFromDetails}
          />
        )}

        {/* Calendar Edit Sheet */}
        {selectedCalendar && (
          <CalendarEditSheet
            open={showEditSheet}
            onOpenChange={setShowEditSheet}
            calendar={selectedCalendar}
            onSuccess={handleSuccess}
          />
        )}

        {/* Calendar Transfer Sheet (Single) */}
        {selectedCalendar && (
          <CalendarTransferSheet
            open={showTransferSheet}
            onOpenChange={setShowTransferSheet}
            calendars={[selectedCalendar]}
            onSuccess={handleSuccess}
          />
        )}

        {/* Calendar Transfer Sheet (Bulk) */}
        {calendarsForBulkTransfer.length > 0 && (
          <CalendarTransferSheet
            open={showBulkTransferSheet}
            onOpenChange={setShowBulkTransferSheet}
            calendars={calendarsForBulkTransfer}
            onSuccess={handleSuccess}
          />
        )}

        {/* Calendar Delete Dialog */}
        {selectedCalendar && (
          <CalendarDeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            calendar={selectedCalendar}
            onConfirm={handleDeleteConfirm}
          />
        )}

        {/* Calendar Bulk Delete Dialog */}
        {selectedIds.length > 0 && (
          <CalendarBulkDeleteDialog
            open={showBulkDeleteDialog}
            onOpenChange={setShowBulkDeleteDialog}
            calendars={calendars.filter((cal) => selectedIds.includes(cal.id))}
            onConfirm={handleBulkDeleteConfirm}
          />
        )}
      </div>
    </>
  );
}
