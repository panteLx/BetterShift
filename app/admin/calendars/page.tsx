"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { SegmentedControl } from "@/components/segmented-control";
import { StatusBanner } from "@/components/status-banner";
import { AdminPageHeader, AdminSearch } from "@/components/admin/admin-kit";
import { FilterMenuButton, type SortState } from "@/components/admin/admin-table-controls";
import { CalendarTable } from "@/components/admin/calendar-table";
import { CalendarDetailsSheet } from "@/components/admin/calendar-details-sheet";
import { CalendarEditSheet } from "@/components/admin/calendar-edit-sheet";
import { CalendarTransferSheet } from "@/components/admin/calendar-transfer-sheet";
import { CalendarDeleteDialog } from "@/components/admin/calendar-delete-dialog";
import { CalendarBulkDeleteDialog } from "@/components/admin/calendar-bulk-delete-dialog";
import {
  useAdminCalendarActions,
  useAdminCalendars,
  type AdminCalendar,
} from "@/hooks/useAdminCalendars";
import { useDebouncedSearch, useResettableState } from "@/hooks/useAdminList";
import {
  ADMIN_PAGE_SIZE,
  type CalendarContentFilter,
  type CalendarListParams,
  type CalendarOwnerFilter,
  type CalendarSortField,
} from "@/lib/admin-list";

const NO_SELECTION: string[] = [];

export default function AdminCalendarsPage() {
  const t = useTranslations();

  const search = useDebouncedSearch();
  const [contentFilter, setContentFilter] = useState<CalendarContentFilter>("all");
  const [ownerFilter, setOwnerFilter] = useState<CalendarOwnerFilter>("all");
  const [sort, setSort] = useState<SortState<CalendarSortField>>({ column: "createdAt", direction: "desc" });

  // Any change to search, filters or sort starts over on the first page
  const listKey = [search.query, contentFilter, ownerFilter, sort.column, sort.direction].join("|");
  const [requestedPage, setPage] = useResettableState(listKey, 1);

  const params = useMemo<CalendarListParams>(
    () => ({
      search: search.query,
      content: contentFilter,
      owner: ownerFilter,
      sort: sort.column,
      order: sort.direction,
      page: requestedPage,
      limit: ADMIN_PAGE_SIZE,
    }),
    [search.query, contentFilter, ownerFilter, sort, requestedPage]
  );

  const { calendars, total, counts, page, isLoading, isPlaceholderData } = useAdminCalendars(params);
  const { deleteCalendar, bulkDeleteCalendars } = useAdminCalendarActions();
  const orphanedCount = counts?.orphaned ?? 0;

  // Selection is per page: it clears when the page, search, filters or sort change
  const [selection, setSelection] = useResettableState(`${listKey}|${page}`, NO_SELECTION);
  const selectedIds = useMemo(
    () => selection.filter((id) => calendars.some((cal) => cal.id === id)),
    [selection, calendars]
  );
  const selectedCalendars = calendars.filter((cal) => selectedIds.includes(cal.id));

  // Dialogs & Sheets
  const [selectedCalendar, setSelectedCalendar] = useState<AdminCalendar | null>(null);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Bulk operations
  const [showBulkTransferSheet, setShowBulkTransferSheet] = useState(false);
  const [calendarsForBulkTransfer, setCalendarsForBulkTransfer] = useState<AdminCalendar[]>([]);

  const handleToggleSelect = (calendarId: string) => {
    setSelection((prev) =>
      prev.includes(calendarId) ? prev.filter((id) => id !== calendarId) : [...prev, calendarId]
    );
  };

  const isAllSelected = calendars.length > 0 && selectedIds.length === calendars.length;

  const handleToggleSelectAll = () => {
    setSelection(isAllSelected ? [] : calendars.map((cal) => cal.id));
  };

  const openFor = (setter: (open: boolean) => void) => (calendar: AdminCalendar) => {
    setSelectedCalendar(calendar);
    setter(true);
  };

  const fromDetails = (setter: (open: boolean) => void) => () => {
    setShowDetailsSheet(false);
    setter(true);
  };

  const handleBulkTransfer = () => {
    setCalendarsForBulkTransfer(selectedCalendars);
    setShowBulkTransferSheet(true);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteConfirm = async () => {
    if (selectedIds.length === 0) return;
    if (await bulkDeleteCalendars(selectedIds)) setSelection([]);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedCalendar) return;
    if (await deleteCalendar(selectedCalendar.id)) {
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
    setSelection([]);
  };

  const showOrphanedBanner = orphanedCount > 0 && ownerFilter !== "with-owner";

  if (isLoading && !counts) {
    return <FullscreenLoader />;
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title={t("admin.calendarsMenu")}
          subtitle={
            counts
              ? t("adminCalendars.subtitle", { count: counts.total, shifts: counts.shifts })
              : undefined
          }
        />

        {showOrphanedBanner && (
          <StatusBanner
            tone="warning"
            icon={TriangleAlert}
            title={t("admin.calendars.orphanedWarning", { count: orphanedCount })}
            action={
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-[8px] font-semibold"
                onClick={() => setOwnerFilter(ownerFilter === "orphaned" ? "all" : "orphaned")}
              >
                {ownerFilter === "orphaned" ? t("common.viewAll") : t("adminCalendars.showOrphaned")}
              </Button>
            }
          >
            {t("admin.calendars.orphanedWarningDescription")}
          </StatusBanner>
        )}

        <div className="flex items-center gap-[9px] max-lg:flex-wrap">
          <AdminSearch
            value={search.input}
            onChange={search.setInput}
            placeholder={t("admin.calendars.searchPlaceholder")}
            className="lg:w-[340px]"
          />
          <SegmentedControl
            value={contentFilter}
            onChange={setContentFilter}
            label={t("adminCalendars.filterLabel")}
            className="min-w-0 flex-1 lg:flex-none lg:[&>button]:flex-none lg:[&>button]:px-[13px]"
            options={[
              { value: "all", label: t("adminUsers.all") },
              { value: "shared", label: t("adminCalendars.filterShared") },
              { value: "synced", label: t("adminCalendars.filterSynced") },
            ]}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <FilterMenuButton
                label={t("adminUsers.moreFilters")}
                active={ownerFilter !== "all"}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-48">
              <DropdownMenuLabel>{t("admin.calendars.owner")}</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={ownerFilter}
                onValueChange={(value) => setOwnerFilter(value as CalendarOwnerFilter)}
              >
                <DropdownMenuRadioItem value="all">
                  {t("admin.calendars.allStatuses")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="orphaned">
                  {t("admin.calendars.orphanedOnly")}
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="with-owner">
                  {t("admin.calendars.withOwner")}
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <CalendarTable
          calendars={calendars}
          total={total}
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={setPage}
          sort={sort}
          onSortChange={setSort}
          isStale={isPlaceholderData}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onToggleSelectAll={handleToggleSelectAll}
          isAllSelected={isAllSelected}
          onCalendarClick={openFor(setShowDetailsSheet)}
          onEditCalendar={openFor(setShowEditSheet)}
          onTransferCalendar={openFor(setShowTransferSheet)}
          onDeleteCalendar={openFor(setShowDeleteDialog)}
          onBulkTransfer={handleBulkTransfer}
          onBulkDelete={handleBulkDelete}
          onClearSelection={() => setSelection([])}
          emptyMessage={search.query ? t("admin.calendars.noSearchResults") : undefined}
        />
      </div>

      {selectedCalendar && (
        <>
          <CalendarDetailsSheet
            key={`details-${selectedCalendar.id}`}
            open={showDetailsSheet}
            onOpenChange={setShowDetailsSheet}
            calendarId={selectedCalendar.id}
            onEdit={fromDetails(setShowEditSheet)}
            onTransfer={fromDetails(setShowTransferSheet)}
            onDelete={fromDetails(setShowDeleteDialog)}
          />
          <CalendarEditSheet
            key={`edit-${selectedCalendar.id}`}
            open={showEditSheet}
            onOpenChange={setShowEditSheet}
            calendar={selectedCalendar}
            onSuccess={handleSuccess}
          />
          <CalendarTransferSheet
            open={showTransferSheet}
            onOpenChange={setShowTransferSheet}
            calendars={[selectedCalendar]}
            onSuccess={handleSuccess}
          />
          <CalendarDeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            calendar={selectedCalendar}
            onConfirm={handleDeleteConfirm}
          />
        </>
      )}

      {calendarsForBulkTransfer.length > 0 && (
        <CalendarTransferSheet
          open={showBulkTransferSheet}
          onOpenChange={setShowBulkTransferSheet}
          calendars={calendarsForBulkTransfer}
          onSuccess={handleSuccess}
        />
      )}

      {selectedIds.length > 0 && (
        <CalendarBulkDeleteDialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
          calendars={selectedCalendars}
          onConfirm={handleBulkDeleteConfirm}
        />
      )}
    </>
  );
}
