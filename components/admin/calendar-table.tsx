"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { format } from "date-fns";
import {
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Send,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDateLocale } from "@/lib/locales";
import type { AdminCalendar } from "@/hooks/useAdminCalendars";
import {
  useCanEditCalendar,
  useCanDeleteCalendar,
  useCanTransferCalendar,
} from "@/hooks/useAdminAccess";

interface CalendarTableProps {
  calendars: AdminCalendar[];
  selectedIds: string[];
  onToggleSelect: (calendarId: string) => void;
  onToggleSelectAll: () => void;
  isAllSelected: boolean;
  onCalendarClick: (calendar: AdminCalendar) => void;
  onEditCalendar: (calendar: AdminCalendar) => void;
  onTransferCalendar: (calendar: AdminCalendar) => void;
  onDeleteCalendar: (calendar: AdminCalendar) => void;
}

type SortColumn =
  | "name"
  | "createdAt"
  | "owner"
  | "shiftsCount"
  | "sharesCount"
  | "externalSyncsCount"
  | "guestPermission";
type SortDirection = "asc" | "desc";

function CalendarTableRow({
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
  onToggleSelect: (calendarId: string) => void;
  onCalendarClick: (calendar: AdminCalendar) => void;
  onEditCalendar: (calendar: AdminCalendar) => void;
  onTransferCalendar: (calendar: AdminCalendar) => void;
  onDeleteCalendar: (calendar: AdminCalendar) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const canEdit = useCanEditCalendar();
  const canDelete = useCanDeleteCalendar();
  const canTransfer = useCanTransferCalendar();

  const isOrphaned = !calendar.ownerId || !calendar.owner;
  const hasActions = canEdit || canTransfer || canDelete;

  return (
    <TableRow
      className="cursor-pointer"
      onClick={() => onCalendarClick(calendar)}
    >
      {/* Checkbox */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect(calendar.id)}
        />
      </TableCell>

      {/* Calendar Name + Color */}
      <TableCell>
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full shrink-0 ring-2 ring-background"
            style={{ backgroundColor: calendar.color }}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{calendar.name}</p>
          </div>
        </div>
      </TableCell>

      {/* Owner */}
      <TableCell>
        {isOrphaned ? (
          <Badge
            variant="outline"
            className="bg-red-500/10 text-red-500 border-red-500/20"
          >
            {t("admin.calendars.orphaned")}
          </Badge>
        ) : (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              {calendar.owner?.image && (
                <AvatarImage src={calendar.owner.image} />
              )}
              <AvatarFallback className="text-xs">
                {calendar.owner?.name
                  ? calendar.owner.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()
                      .slice(0, 2)
                  : (calendar.owner?.email || "").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-sm truncate">{calendar.owner?.name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {calendar.owner?.email}
              </p>
            </div>
          </div>
        )}
      </TableCell>

      {/* Created */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {format(calendar.createdAt, "PP", { locale: dateLocale })}
        </span>
      </TableCell>

      {/* Shifts Count */}
      <TableCell>
        <span className="text-sm">{calendar.shiftsCount}</span>
      </TableCell>

      {/* Shares Count */}
      <TableCell>
        <span className="text-sm">{calendar.sharesCount}</span>
      </TableCell>

      {/* External Syncs Count */}
      <TableCell>
        <span className="text-sm">{calendar.externalSyncsCount || 0}</span>
      </TableCell>

      {/* Guest Permission */}
      <TableCell>
        {calendar.guestPermission === "none" ? (
          <Badge variant="secondary" className="text-xs">
            {t("common.labels.permissions.none")}
          </Badge>
        ) : calendar.guestPermission === "read" ? (
          <Badge variant="outline" className="text-xs">
            {t("common.labels.permissions.read")}
          </Badge>
        ) : (
          <Badge variant="default" className="text-xs">
            {t("common.labels.permissions.write")}
          </Badge>
        )}
      </TableCell>

      {/* Actions */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onCalendarClick(calendar)}>
                <Eye className="h-4 w-4 mr-2" />
                {t("common.viewDetails")}
              </DropdownMenuItem>
              {canEdit && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => onEditCalendar(calendar)}>
                    <Edit className="h-4 w-4 mr-2" />
                    {t("admin.calendars.editCalendar")}
                  </DropdownMenuItem>
                </>
              )}
              {canTransfer && (
                <DropdownMenuItem onClick={() => onTransferCalendar(calendar)}>
                  <Send className="h-4 w-4 mr-2" />
                  {t("admin.calendars.transferOwnership")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteCalendar(calendar)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("admin.calendars.deleteCalendar")}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TableCell>
    </TableRow>
  );
}

export function CalendarTable({
  calendars,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  isAllSelected,
  onCalendarClick,
  onEditCalendar,
  onTransferCalendar,
  onDeleteCalendar,
}: CalendarTableProps) {
  const t = useTranslations();
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort calendars (orphaned always first, then by selected column)
  const sortedCalendars = [...calendars].sort((a, b) => {
    // Orphaned calendars always on top
    const aOrphaned = !a.ownerId;
    const bOrphaned = !b.ownerId;

    if (aOrphaned !== bOrphaned) {
      return aOrphaned ? -1 : 1;
    }

    // Then sort by selected column
    if (!sortColumn) return 0;

    let comparison = 0;

    switch (sortColumn) {
      case "name":
        comparison = a.name.localeCompare(b.name);
        break;
      case "createdAt":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "owner":
        const aOwner = a.owner?.name || "";
        const bOwner = b.owner?.name || "";
        comparison = aOwner.localeCompare(bOwner);
        break;
      case "shiftsCount":
        comparison = a.shiftsCount - b.shiftsCount;
        break;
      case "sharesCount":
        comparison = a.sharesCount - b.sharesCount;
        break;
      case "externalSyncsCount":
        comparison = (a.externalSyncsCount || 0) - (b.externalSyncsCount || 0);
        break;
      case "guestPermission":
        const permissionOrder = { none: 0, read: 1, write: 2 };
        comparison =
          permissionOrder[a.guestPermission] -
          permissionOrder[b.guestPermission];
        break;
    }

    return sortDirection === "asc" ? comparison : -comparison;
  });

  // Handle sort column click
  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColumn(column);
      setSortDirection("desc");
    }
  };

  return (
    <div className="border border-border/50 bg-gradient-to-br from-card/95 via-card to-card/80 backdrop-blur-sm rounded-lg overflow-hidden shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[50px]">
              <Checkbox
                checked={isAllSelected}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center gap-2">
                {t("common.labels.name")}
                {sortColumn === "name" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("owner")}
            >
              <div className="flex items-center gap-2">
                {t("admin.calendars.owner")}
                {sortColumn === "owner" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("createdAt")}
            >
              <div className="flex items-center gap-2">
                {t("common.stats.created")}
                {sortColumn === "createdAt" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("shiftsCount")}
            >
              <div className="flex items-center gap-2">
                {t("common.labels.shifts")}
                {sortColumn === "shiftsCount" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("sharesCount")}
            >
              <div className="flex items-center gap-2">
                {t("common.labels.shares")}
                {sortColumn === "sharesCount" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("externalSyncsCount")}
            >
              <div className="flex items-center gap-2">
                {t("admin.calendars.externalSyncsShort")}
                {sortColumn === "externalSyncsCount" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("guestPermission")}
            >
              <div className="flex items-center gap-2">
                {t("admin.calendars.guestPermission")}
                {sortColumn === "guestPermission" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedCalendars.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center py-8">
                <p className="text-muted-foreground">
                  {t("admin.calendars.noCalendarsFound")}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            sortedCalendars.map((calendar) => (
              <CalendarTableRow
                key={calendar.id}
                calendar={calendar}
                isSelected={selectedIds.includes(calendar.id)}
                onToggleSelect={onToggleSelect}
                onCalendarClick={onCalendarClick}
                onEditCalendar={onEditCalendar}
                onTransferCalendar={onTransferCalendar}
                onDeleteCalendar={onDeleteCalendar}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
