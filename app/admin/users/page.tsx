"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { SegmentedControl } from "@/components/segmented-control";
import { ChoiceChips } from "@/components/form-kit";
import { AdminPageHeader, AdminSearch } from "@/components/admin/admin-kit";
import { FilterMenuButton, type SortState } from "@/components/admin/admin-table-controls";
import { UserTable } from "@/components/admin/user-table";
import { UserEditSheet } from "@/components/admin/user-edit-sheet";
import { UserDetailsSheet } from "@/components/admin/user-details-sheet";
import { UserBanDialog } from "@/components/admin/user-ban-dialog";
import { UserUnbanDialog } from "@/components/admin/user-unban-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { UserPasswordResetDialog } from "@/components/admin/user-password-reset-dialog";
import { useAdminUserActions, useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useDebouncedSearch, useResettableState } from "@/hooks/useAdminList";
import {
  ADMIN_PAGE_SIZE,
  type UserListParams,
  type UserRoleFilter,
  type UserSortField,
  type UserStatusFilter,
} from "@/lib/admin-list";

type Preset = "all" | "superadmin" | "banned";

export default function AdminUsersPage() {
  const t = useTranslations();

  const search = useDebouncedSearch();
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>("all");
  const [sort, setSort] = useState<SortState<UserSortField>>({ column: "createdAt", direction: "desc" });

  // Any change to search, filters or sort starts over on the first page
  const listKey = [search.query, roleFilter, statusFilter, sort.column, sort.direction].join("|");
  const [requestedPage, setPage] = useResettableState(listKey, 1);

  const params = useMemo<UserListParams>(
    () => ({
      search: search.query,
      role: roleFilter,
      status: statusFilter,
      sort: sort.column,
      order: sort.direction,
      page: requestedPage,
      limit: ADMIN_PAGE_SIZE,
    }),
    [search.query, roleFilter, statusFilter, sort, requestedPage]
  );

  const { users, total, counts, page, isLoading, isPlaceholderData } = useAdminUsers(params);
  const { banUser, unbanUser, deleteUser, resetPassword } = useAdminUserActions();

  // The segments cover the common cases; anything else lives in the filter menu.
  const preset: Preset | "custom" =
    roleFilter === "all" && statusFilter === "all"
      ? "all"
      : roleFilter === "superadmin" && statusFilter === "all"
        ? "superadmin"
        : roleFilter === "all" && statusFilter === "banned"
          ? "banned"
          : "custom";

  const applyPreset = (value: Preset) => {
    setRoleFilter(value === "superadmin" ? "superadmin" : "all");
    setStatusFilter(value === "banned" ? "banned" : "all");
  };

  // Dialogs & Sheets
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showUnbanDialog, setShowUnbanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  const openFor = (setter: (open: boolean) => void) => (user: AdminUser) => {
    setSelectedUser(user);
    setter(true);
  };

  const fromDetails = (setter: (open: boolean) => void) => () => {
    setShowDetailsSheet(false);
    setter(true);
  };

  const handleBanConfirm = async (reason: string, expiresAt?: Date) => {
    if (!selectedUser) return;
    if (await banUser(selectedUser.id, reason, expiresAt)) setShowBanDialog(false);
  };

  const handleUnbanConfirm = async () => {
    if (!selectedUser) return;
    if (await unbanUser(selectedUser.id)) setShowUnbanDialog(false);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    if (await deleteUser(selectedUser.id)) setShowDeleteDialog(false);
  };

  const handlePasswordResetConfirm = async (newPassword: string) => {
    if (!selectedUser) return;
    if (await resetPassword(selectedUser.id, newPassword)) setShowPasswordDialog(false);
  };

  if (isLoading && !counts) {
    return <FullscreenLoader />;
  }

  const filterMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <FilterMenuButton label={t("adminUsers.moreFilters")} active={preset === "custom"} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuLabel>{t("admin.role")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={roleFilter}
          onValueChange={(value) => setRoleFilter(value as UserRoleFilter)}
        >
          <DropdownMenuRadioItem value="all">{t("admin.allRoles")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="superadmin">{t("common.roles.superadmin")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="admin">{t("common.roles.admin")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="user">{t("common.roles.user")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("common.labels.status")}</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as UserStatusFilter)}
        >
          <DropdownMenuRadioItem value="all">{t("admin.allStatuses")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="active">{t("common.status.active")}</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="banned">{t("admin.banned")}</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <>
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title={t("admin.usersMenu")}
          subtitle={
            counts ? t("adminUsers.subtitle", { count: counts.total, banned: counts.banned }) : undefined
          }
        />

        <div className="flex flex-col gap-[11px] lg:flex-row lg:items-center lg:gap-[9px]">
          <AdminSearch
            value={search.input}
            onChange={search.setInput}
            placeholder={t("admin.searchUsers")}
            className="lg:w-[340px]"
          />
          <SegmentedControl
            value={preset as Preset}
            onChange={applyPreset}
            label={t("adminUsers.filterLabel")}
            className="hidden lg:flex [&>button]:flex-none [&>button]:px-[13px]"
            options={[
              { value: "all", label: t("admin.allRoles") },
              { value: "superadmin", label: t("common.roles.superadmin") },
              { value: "banned", label: t("admin.banned") },
            ]}
          />
          <div className="flex items-center gap-[7px] lg:hidden">
            <div className="min-w-0 flex-1 overflow-x-auto">
              <ChoiceChips
                value={preset === "custom" ? undefined : preset}
                onChange={applyPreset}
                label={t("adminUsers.filterLabel")}
                options={[
                  { value: "all", label: `${t("adminUsers.all")} ${counts?.total ?? ""}` },
                  { value: "superadmin", label: `${t("common.roles.superadmin")} ${counts?.superadmin ?? ""}` },
                  { value: "banned", label: `${t("admin.banned")} ${counts?.banned ?? ""}` },
                ]}
              />
            </div>
            {filterMenu}
          </div>
          <div className="hidden lg:block">{filterMenu}</div>
        </div>

        <UserTable
          users={users}
          total={total}
          page={page}
          pageSize={ADMIN_PAGE_SIZE}
          onPageChange={setPage}
          sort={sort}
          onSortChange={setSort}
          isStale={isPlaceholderData}
          onUserClick={openFor(setShowDetailsSheet)}
          onEditUser={openFor(setShowEditSheet)}
          onResetPassword={openFor(setShowPasswordDialog)}
          onBanUser={openFor(setShowBanDialog)}
          onUnbanUser={openFor(setShowUnbanDialog)}
          onDeleteUser={openFor(setShowDeleteDialog)}
        />
      </div>

      {selectedUser && (
        <>
          <UserEditSheet
            key={`edit-${selectedUser.id}`}
            open={showEditSheet}
            onOpenChange={setShowEditSheet}
            user={selectedUser}
            onSuccess={() => {}}
          />
          <UserDetailsSheet
            key={`details-${selectedUser.id}`}
            open={showDetailsSheet}
            onOpenChange={setShowDetailsSheet}
            userId={selectedUser.id}
            onEdit={fromDetails(setShowEditSheet)}
            onResetPassword={fromDetails(setShowPasswordDialog)}
            onBan={fromDetails(setShowBanDialog)}
            onUnban={fromDetails(setShowUnbanDialog)}
            onDelete={fromDetails(setShowDeleteDialog)}
          />
          <UserBanDialog
            open={showBanDialog}
            onOpenChange={setShowBanDialog}
            user={selectedUser}
            onConfirm={handleBanConfirm}
          />
          <UserUnbanDialog
            open={showUnbanDialog}
            onOpenChange={setShowUnbanDialog}
            user={selectedUser}
            onConfirm={handleUnbanConfirm}
          />
          <UserDeleteDialog
            open={showDeleteDialog}
            onOpenChange={setShowDeleteDialog}
            user={selectedUser}
            onConfirm={handleDeleteConfirm}
          />
          <UserPasswordResetDialog
            open={showPasswordDialog}
            onOpenChange={setShowPasswordDialog}
            user={selectedUser}
            onConfirm={handlePasswordResetConfirm}
          />
        </>
      )}
    </>
  );
}
