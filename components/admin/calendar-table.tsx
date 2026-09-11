"use client";

import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronRight, Ellipsis, Eye, Pencil, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Pill } from "@/components/form-kit";
import {
  AdminTableCard,
  AdminTableHead,
  AdminTableRow,
  Count,
  UserAvatar,
} from "@/components/admin/admin-kit";
import {
  RowActionButton,
  SortHeader,
  nextSort,
  type SortState,
} from "@/components/admin/admin-table-controls";
import { AdminPagination } from "@/components/admin/admin-pagination";
import { getDateLocale } from "@/lib/locales";
import type { CalendarSortField } from "@/lib/admin-list";
import type { AdminCalendar } from "@/hooks/useAdminCalendars";
import {
  useCanEditCalendar,
  useCanDeleteCalendar,
  useCanTransferCalendar,
} from "@/hooks/useAdminAccess";
import { cn } from "@/lib/utils";
import { shiftVars } from "@/lib/shift-display";

interface CalendarTableProps {
  /** One page of calendars, already sorted by the API */
  calendars: AdminCalendar[];
  /** Calendars matching the current search and filters */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort: SortState<CalendarSortField>;
  onSortChange: (sort: SortState<CalendarSortField>) => void;
  /** Dims the rows while the next page loads */
  isStale?: boolean;
  selectedIds: string[];
  onToggleSelect: (calendarId: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  onCalendarClick: (calendar: AdminCalendar) => void;
  onEditCalendar: (calendar: AdminCalendar) => void;
  onTransferCalendar: (calendar: AdminCalendar) => void;
  onDeleteCalendar: (calendar: AdminCalendar) => void;
  onBulkTransfer: () => void;
  onBulkDelete: () => void;
  onClearSelection: () => void;
  emptyMessage?: string;
}

const TEMPLATE =
  "18px minmax(0,1.2fr) minmax(0,2fr) 110px 90px 90px 70px 120px 102px";

// Dark enough for white initials in both themes
const OWNER_COLORS = ["#0f766e", "#6d28d9", "#344054", "#b45309", "#1d4ed8", "#be185d", "#15803d"];

/** Stable avatar color per owner, as in 13d. */
export function ownerColor(key: string | null | undefined) {
  if (!key) return OWNER_COLORS[2];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0;
  return OWNER_COLORS[Math.abs(hash) % OWNER_COLORS.length];
}

export function isOrphaned(calendar: Pick<AdminCalendar, "ownerId" | "owner">) {
  return !calendar.ownerId || !calendar.owner;
}

export function GuestPermissionPill({ permission }: { permission: AdminCalendar["guestPermission"] }) {
  const t = useTranslations();
  if (permission === "write") return <Pill tone="brand">{t("common.labels.permissions.write")}</Pill>;
  if (permission === "read") return <Pill>{t("common.labels.permissions.read")}</Pill>;
  return <Pill className="text-fg-tertiary">{t("common.labels.permissions.none")}</Pill>;
}

function CalendarDot({ color, className }: { color: string; className?: string }) {
  return (
    <span
      className={cn("shift-rail size-2 shrink-0 rounded-full", className)}
      style={shiftVars(color)}
    />
  );
}

function OwnerCell({ calendar, compact }: { calendar: AdminCalendar; compact?: boolean }) {
  const t = useTranslations();
  if (isOrphaned(calendar)) {
    return <Pill tone="warning">{t("admin.calendars.orphaned")}</Pill>;
  }
  const owner = calendar.owner!;
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <UserAvatar
        name={owner.name || owner.email}
        image={owner.image}
        size={compact ? 28 : 30}
        color={ownerColor(calendar.ownerId)}
      />
      <div className="min-w-0">
        <div
          className={cn(
            "truncate font-semibold",
            compact ? "text-[12.5px] text-fg-body" : "text-[13px] text-fg-strong"
          )}
        >
          {owner.name}
        </div>
        <div className={cn("truncate text-fg-tertiary", compact ? "text-[11.5px]" : "text-[12px]")}>
          {owner.email}
        </div>
      </div>
    </div>
  );
}

function CalendarRow({
  calendar,
  isSelected,
  onToggleSelect,
  onCalendarClick,
  onEditCalendar,
  onTransferCalendar,
  onDeleteCalendar,
}: {
  calendar: AdminCalendar;
  isSelected: boolean;
} & Pick<
  CalendarTableProps,
  "onToggleSelect" | "onCalendarClick" | "onEditCalendar" | "onTransferCalendar" | "onDeleteCalendar"
>) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const canEdit = useCanEditCalendar();
  const canDelete = useCanDeleteCalendar();
  const canTransfer = useCanTransferCalendar();

  return (
    <AdminTableRow
      template={TEMPLATE}
      muted={isSelected ? "panel" : undefined}
      onClick={() => onCalendarClick(calendar)}
    >
      {/* Stop clicks and Enter/Space from also opening the details panel */}
      <div
        className="flex items-center"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(calendar.id)}
          aria-label={calendar.name}
        />
      </div>
      <div className="flex min-w-0 items-center gap-2.5">
        <CalendarDot color={calendar.color} />
        <span className="truncate text-[13.5px] font-semibold text-fg-strong">{calendar.name}</span>
      </div>
      <OwnerCell calendar={calendar} />
      <span className="truncate text-[12.5px] text-fg-secondary">
        {format(calendar.createdAt, "PP", { locale: dateLocale })}
      </span>
      <Count value={calendar.shiftsCount} />
      <Count value={calendar.sharesCount} />
      <Count value={calendar.externalSyncsCount || 0} />
      <div>
        <GuestPermissionPill permission={calendar.guestPermission} />
      </div>
      <div
        className="flex items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <RowActionButton
          icon={Pencil}
          label={t("admin.calendars.editCalendar")}
          disabled={!canEdit}
          onClick={() => onEditCalendar(calendar)}
        />
        <RowActionButton
          icon={Send}
          label={t("admin.calendars.transferOwnership")}
          disabled={!canTransfer}
          onClick={() => onTransferCalendar(calendar)}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RowActionButton icon={Ellipsis} label={t("adminUsers.moreActions")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => onCalendarClick(calendar)}>
              <Eye />
              {t("common.viewDetails")}
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDeleteCalendar(calendar)}
                  className="text-danger focus:text-danger"
                >
                  <Trash2 />
                  {t("admin.calendars.deleteCalendar")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AdminTableRow>
  );
}

function CalendarCard({
  calendar,
  isSelected,
  onToggleSelect,
  onClick,
}: {
  calendar: AdminCalendar;
  isSelected: boolean;
  onToggleSelect: () => void;
  onClick: () => void;
}) {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  const stat = (label: string, value: number) => (
    <div>
      <div className="text-[11px] text-fg-tertiary">{label}</div>
      <div
        className={cn(
          "font-mono text-[15px] font-medium",
          value === 0 ? "text-fg-faint" : "text-fg-strong"
        )}
      >
        {value}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-[11px] border py-3 pl-[13px]",
        isSelected ? "border-brand bg-brand-soft" : "border-line bg-surface-card"
      )}
    >
      <Checkbox
        checked={isSelected}
        onCheckedChange={onToggleSelect}
        aria-label={calendar.name}
        className="mt-[3px]"
      />
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 flex-col gap-2.5 pr-[13px] text-left"
      >
        <div className="flex w-full items-center gap-2.5">
          <CalendarDot color={calendar.color} />
          <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-fg-strong">
            {calendar.name}
          </span>
          <GuestPermissionPill permission={calendar.guestPermission} />
          <ChevronRight className="size-[17px] shrink-0 text-fg-faint" />
        </div>
        <OwnerCell calendar={calendar} compact />
        <div className="flex w-full gap-4 border-t border-line-subtle pt-[9px]">
          {stat(t("common.labels.shifts"), calendar.shiftsCount)}
          {stat(t("common.labels.shares"), calendar.sharesCount)}
          {stat(t("admin.calendars.externalSyncsShort"), calendar.externalSyncsCount || 0)}
          <div>
            <div className="text-[11px] text-fg-tertiary">{t("common.stats.created")}</div>
            <div className="mt-px text-[13px] font-medium text-fg-strong">
              {format(calendar.createdAt, "PP", { locale: dateLocale })}
            </div>
          </div>
        </div>
      </button>
    </div>
  );
}

function BulkActions({
  count,
  onBulkTransfer,
  onBulkDelete,
  onClearSelection,
}: {
  count: number;
} & Pick<CalendarTableProps, "onBulkTransfer" | "onBulkDelete" | "onClearSelection">) {
  const t = useTranslations();
  const canTransfer = useCanTransferCalendar();
  const canDelete = useCanDeleteCalendar();

  if (count === 0) {
    return <span>{t("adminCalendars.selectedNone")}</span>;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <span className="font-semibold text-fg-body">{t("adminCalendars.selectedCount", { count })}</span>
      {canTransfer && (
        <Button variant="outline" size="sm" onClick={onBulkTransfer} className="h-8 rounded-[8px]">
          <Send className="size-3.5 text-fg-secondary" />
          {t("admin.calendars.transferSelected")}
        </Button>
      )}
      {canDelete && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBulkDelete}
          className="h-8 rounded-[8px] border-danger-line text-danger hover:bg-danger-surface hover:text-danger"
        >
          <Trash2 className="size-3.5" />
          {t("common.deleteSelected")}
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        onClick={onClearSelection}
        aria-label={t("admin.calendars.clearSelection")}
        title={t("admin.calendars.clearSelection")}
        className="size-8 p-0 text-fg-secondary"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

export function CalendarTable({
  calendars,
  total,
  page,
  pageSize,
  onPageChange,
  sort,
  onSortChange,
  isStale,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  onBulkTransfer,
  onBulkDelete,
  onClearSelection,
  emptyMessage,
  ...rowHandlers
}: CalendarTableProps) {
  const t = useTranslations();

  const header = (column: CalendarSortField, label: string) => (
    <SortHeader
      column={column}
      label={label}
      sort={sort}
      onSort={(next) => onSortChange(nextSort(sort, next))}
    />
  );
  const bulk = (
    <BulkActions
      count={selectedIds.length}
      onBulkTransfer={onBulkTransfer}
      onBulkDelete={onBulkDelete}
      onClearSelection={onClearSelection}
    />
  );
  const empty = (
    <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">
      {emptyMessage ?? t("admin.calendars.noCalendarsFound")}
    </p>
  );
  const pagination = (className?: string, extra?: React.ReactNode) => (
    <AdminPagination
      page={page}
      pageSize={pageSize}
      shown={calendars.length}
      total={total}
      onPageChange={onPageChange}
      extra={extra}
      className={className}
    />
  );

  return (
    <div aria-busy={isStale || undefined} className={cn(isStale && "opacity-60")}>
      <AdminTableCard className="hidden lg:block" footer={total > 0 && pagination(undefined, bulk)}>
        <AdminTableHead
          template={TEMPLATE}
          columns={[
            <Checkbox
              key="select-all"
              checked={isAllSelected}
              onCheckedChange={onToggleSelectAll}
              disabled={calendars.length === 0}
              aria-label={t("adminCalendars.selectAll")}
            />,
            header("name", t("common.labels.name")),
            header("owner", t("admin.calendars.owner")),
            header("createdAt", t("common.stats.created")),
            header("shiftsCount", t("common.labels.shifts")),
            header("sharesCount", t("common.labels.shares")),
            header("externalSyncsCount", t("admin.calendars.externalSyncsShort")),
            header("guestPermission", t("adminCalendars.guestColumn")),
            <span key="actions" className="block text-right">
              {t("adminUsers.actions")}
            </span>,
          ]}
        />
        {calendars.length === 0
          ? empty
          : calendars.map((calendar) => (
              <CalendarRow
                key={calendar.id}
                calendar={calendar}
                isSelected={selectedIds.includes(calendar.id)}
                onToggleSelect={onToggleSelect}
                {...rowHandlers}
              />
            ))}
      </AdminTableCard>

      <div className="flex flex-col gap-[9px] lg:hidden">
        {selectedIds.length > 0 && (
          <div className="rounded-[11px] border border-line bg-surface-panel px-3.5 py-2.5 text-[12.5px] text-fg-secondary">
            {bulk}
          </div>
        )}
        {calendars.length === 0 ? (
          <div className="rounded-[11px] border border-line">{empty}</div>
        ) : (
          calendars.map((calendar) => (
            <CalendarCard
              key={calendar.id}
              calendar={calendar}
              isSelected={selectedIds.includes(calendar.id)}
              onToggleSelect={() => onToggleSelect(calendar.id)}
              onClick={() => rowHandlers.onCalendarClick(calendar)}
            />
          ))
        )}
        {total > pageSize && pagination("pt-1 text-[12px] text-fg-tertiary")}
      </div>
    </div>
  );
}
