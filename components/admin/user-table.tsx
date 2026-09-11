"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import {
  ChevronRight,
  Ellipsis,
  Eye,
  KeyRound,
  Lock,
  LockOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  AdminMobileCard,
  AdminTableCard,
  AdminTableHead,
  AdminTableRow,
  Count,
  RolePill,
  StatusPill,
  UserAvatar,
} from "@/components/admin/admin-kit";
import {
  RowActionButton,
  SortHeader,
  nextSort,
  type SortState,
} from "@/components/admin/admin-table-controls";
import { getDateLocale } from "@/lib/locales";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { useUserPermissions } from "@/hooks/useAdminAccess";

interface UserTableProps {
  users: AdminUser[];
  /** All accounts before filtering, for the "n of m" footer */
  total: number;
  onUserClick: (user: AdminUser) => void;
  onEditUser: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onBanUser: (user: AdminUser) => void;
  onUnbanUser: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

type RowHandlers = Omit<UserTableProps, "users" | "total">;

type SortColumn = "name" | "role" | "status" | "createdAt" | "lastActivity" | "calendarCount";

const TEMPLATE = "minmax(0,2.4fr) 120px 110px 130px 150px 90px 102px";
const ROLE_ORDER: Record<string, number> = { user: 0, admin: 1, superadmin: 2 };

function useDateFormatters() {
  const t = useTranslations();
  const dateLocale = getDateLocale(useLocale());
  return {
    created: (date: Date) => format(date, "PP", { locale: dateLocale }),
    lastActive: (date: Date | null) =>
      date
        ? formatDistanceToNow(date, { addSuffix: true, locale: dateLocale })
        : t("admin.neverActive"),
    until: (date: Date) => format(date, "PPP", { locale: dateLocale }),
  };
}

function BannedPill({ user }: { user: AdminUser }) {
  const t = useTranslations();
  const dates = useDateFormatters();
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="cursor-help">
            <StatusPill banned />
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          {user.banReason && <p className="text-xs font-medium">{user.banReason}</p>}
          <p className="text-xs opacity-80">
            {user.banExpires
              ? t("admin.bannedUntil", { date: dates.until(user.banExpires) })
              : t("admin.bannedPermanently")}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function UserRow({ user, ...handlers }: { user: AdminUser } & RowHandlers) {
  const t = useTranslations();
  const dates = useDateFormatters();
  const { canEdit, canBan, canDelete, canResetPassword } = useUserPermissions(user);

  return (
    <AdminTableRow
      template={TEMPLATE}
      muted={user.banned ? "danger" : undefined}
      onClick={() => handlers.onUserClick(user)}
    >
      <div className="flex min-w-0 items-center gap-[11px]">
        <UserAvatar name={user.name || user.email} image={user.image} size={32} />
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-fg-strong">{user.name}</div>
          <div className="truncate text-[12px] text-fg-tertiary">{user.email}</div>
        </div>
      </div>
      <div>
        <RolePill role={user.role} />
      </div>
      <div>{user.banned ? <BannedPill user={user} /> : <StatusPill banned={false} />}</div>
      <span className="truncate text-[12.5px] text-fg-secondary">{dates.created(user.createdAt)}</span>
      <span className="truncate text-[12.5px] text-fg-secondary">
        {dates.lastActive(user.lastActivity)}
      </span>
      <Count value={user.calendarCount} />
      {/* Stop clicks and Enter/Space from also opening the details panel */}
      <div
        className="flex items-center justify-end gap-1.5"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <RowActionButton
          icon={Pencil}
          label={t("admin.editUser")}
          disabled={!canEdit}
          onClick={() => handlers.onEditUser(user)}
        />
        {user.banned ? (
          <RowActionButton
            icon={LockOpen}
            label={t("admin.unbanUser")}
            disabled={!canBan}
            onClick={() => handlers.onUnbanUser(user)}
          />
        ) : (
          <RowActionButton
            icon={Lock}
            label={t("admin.banUser")}
            disabled={!canBan}
            onClick={() => handlers.onBanUser(user)}
          />
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RowActionButton icon={Ellipsis} label={t("adminUsers.moreActions")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={() => handlers.onUserClick(user)}>
              <Eye />
              {t("common.viewDetails")}
            </DropdownMenuItem>
            {canResetPassword && (
              <DropdownMenuItem onClick={() => handlers.onResetPassword(user)}>
                <KeyRound />
                {t("admin.resetPassword")}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handlers.onDeleteUser(user)}
                  className="text-danger focus:text-danger"
                >
                  <Trash2 />
                  {t("admin.deleteUser")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AdminTableRow>
  );
}

function UserCard({ user, onClick }: { user: AdminUser; onClick: () => void }) {
  const t = useTranslations();
  const dates = useDateFormatters();
  return (
    <AdminMobileCard onClick={onClick}>
      <div className="flex items-start gap-[11px]">
        <UserAvatar name={user.name || user.email} image={user.image} size={36} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-fg-strong">{user.name}</div>
          <div className="mt-px truncate text-[12.5px] text-fg-tertiary">{user.email}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RolePill role={user.role} />
            <StatusPill banned={user.banned} />
            <span className="font-mono text-[11.5px] text-fg-faint">
              {t("adminUsers.calendarCount", { count: user.calendarCount })} ·{" "}
              {dates.lastActive(user.lastActivity)}
            </span>
          </div>
        </div>
        <ChevronRight className="mt-[3px] size-[17px] shrink-0 text-fg-faint" />
      </div>
    </AdminMobileCard>
  );
}

export function UserTable({ users, total, ...handlers }: UserTableProps) {
  const t = useTranslations();
  const [sort, setSort] = useState<SortState<SortColumn>>({
    column: "createdAt",
    direction: "desc",
  });

  const sortedUsers = [...users].sort((a, b) => {
    let comparison = 0;
    switch (sort.column) {
      case "name":
        comparison = (a.name || "").localeCompare(b.name || "");
        break;
      case "role":
        comparison = (ROLE_ORDER[a.role ?? "user"] ?? 0) - (ROLE_ORDER[b.role ?? "user"] ?? 0);
        break;
      case "status":
        comparison = Number(a.banned) - Number(b.banned);
        break;
      case "createdAt":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "lastActivity":
        comparison = (a.lastActivity?.getTime() ?? 0) - (b.lastActivity?.getTime() ?? 0);
        break;
      case "calendarCount":
        comparison = a.calendarCount - b.calendarCount;
        break;
    }
    return sort.direction === "asc" ? comparison : -comparison;
  });

  const onSort = (column: SortColumn) => setSort((prev) => nextSort(prev, column));
  const header = (column: SortColumn, label: string) => (
    <SortHeader column={column} label={label} sort={sort} onSort={onSort} />
  );
  const empty = (
    <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">
      {t("common.empty.noUsersFound")}
    </p>
  );

  return (
    <>
      <AdminTableCard
        className="hidden lg:block"
        footer={<span>{t("adminUsers.shownOf", { shown: users.length, total })}</span>}
      >
        <AdminTableHead
          template={TEMPLATE}
          columns={[
            header("name", t("common.labels.user")),
            header("role", t("admin.role")),
            header("status", t("common.labels.status")),
            header("createdAt", t("common.stats.created")),
            header("lastActivity", t("common.time.lastActive")),
            header("calendarCount", t("admin.calendarsCount")),
            <span key="actions" className="block text-right">
              {t("adminUsers.actions")}
            </span>,
          ]}
        />
        {sortedUsers.length === 0
          ? empty
          : sortedUsers.map((user) => <UserRow key={user.id} user={user} {...handlers} />)}
      </AdminTableCard>

      <div className="flex flex-col gap-[9px] lg:hidden">
        {sortedUsers.length === 0 ? (
          <div className="rounded-[11px] border border-line">{empty}</div>
        ) : (
          sortedUsers.map((user) => (
            <UserCard key={user.id} user={user} onClick={() => handlers.onUserClick(user)} />
          ))
        )}
      </div>
    </>
  );
}
