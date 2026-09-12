"use client";

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
import { AdminPagination } from "@/components/admin/admin-pagination";
import { getDateLocale } from "@/lib/locales";
import type { UserSortField } from "@/lib/admin-list";
import type { AdminUser } from "@/hooks/useAdminUsers";
import { useUserPermissions } from "@/hooks/useAdminAccess";
import { cn } from "@/lib/utils";

interface UserTableProps {
  /** One page of users, already sorted by the API */
  users: AdminUser[];
  /** Accounts matching the current search and filters */
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  sort: SortState<UserSortField>;
  onSortChange: (sort: SortState<UserSortField>) => void;
  /** Dims the rows while the next page loads */
  isStale?: boolean;
  onUserClick: (user: AdminUser) => void;
  onEditUser: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onBanUser: (user: AdminUser) => void;
  onUnbanUser: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

type RowHandlers = Pick<
  UserTableProps,
  "onUserClick" | "onEditUser" | "onResetPassword" | "onBanUser" | "onUnbanUser" | "onDeleteUser"
>;

const TEMPLATE = "minmax(0,2.4fr) 120px 110px 130px 150px 90px 102px";

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

export function UserTable({
  users,
  total,
  page,
  pageSize,
  onPageChange,
  sort,
  onSortChange,
  isStale,
  ...handlers
}: UserTableProps) {
  const t = useTranslations();

  const header = (column: UserSortField, label: string) => (
    <SortHeader
      column={column}
      label={label}
      sort={sort}
      onSort={(next) => onSortChange(nextSort(sort, next))}
    />
  );
  const empty = (
    <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">
      {t("common.empty.noUsersFound")}
    </p>
  );
  const pagination = (className?: string) => (
    <AdminPagination
      page={page}
      pageSize={pageSize}
      shown={users.length}
      total={total}
      onPageChange={onPageChange}
      className={className}
    />
  );

  return (
    <div aria-busy={isStale || undefined} className={cn(isStale && "opacity-60")}>
      <AdminTableCard className="hidden lg:block" footer={total > 0 && pagination()}>
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
        {users.length === 0
          ? empty
          : users.map((user) => <UserRow key={user.id} user={user} {...handlers} />)}
      </AdminTableCard>

      <div className="flex flex-col gap-[9px] lg:hidden">
        {users.length === 0 ? (
          <div className="rounded-[11px] border border-line">{empty}</div>
        ) : (
          users.map((user) => (
            <UserCard key={user.id} user={user} onClick={() => handlers.onUserClick(user)} />
          ))
        )}
        {total > pageSize && pagination("pt-1 text-[12px] text-fg-tertiary")}
      </div>
    </div>
  );
}
