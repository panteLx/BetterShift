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
import { FilterMenuButton } from "@/components/admin/admin-table-controls";
import { UserTable } from "@/components/admin/user-table";
import { UserEditSheet } from "@/components/admin/user-edit-sheet";
import { UserDetailsSheet } from "@/components/admin/user-details-sheet";
import { UserBanDialog } from "@/components/admin/user-ban-dialog";
import { UserUnbanDialog } from "@/components/admin/user-unban-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { UserPasswordResetDialog } from "@/components/admin/user-password-reset-dialog";
import { useAdminUsers, type AdminUser, type UserFilters, type UserSort } from "@/hooks/useAdminUsers";

type RoleFilter = "all" | "superadmin" | "admin" | "user";
type StatusFilter = "all" | "active" | "banned";
type Preset = "all" | "superadmin" | "banned";

// Stable references so the query key does not change between renders
const FILTERS: UserFilters = {};
const SORT: UserSort = { field: "createdAt", direction: "desc" };
const PAGINATION = { page: 1, limit: 1000 };

export default function AdminUsersPage() {
  const t = useTranslations();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Filtering happens client-side so the header can show totals of all accounts.
  const { users, isLoading, banUser, unbanUser, deleteUser, resetPassword } = useAdminUsers(
    FILTERS,
    SORT,
    PAGINATION
  );

  const counts = useMemo(
    () => ({
      total: users.length,
      banned: users.filter((u) => u.banned).length,
      superadmin: users.filter((u) => u.role === "superadmin").length,
    }),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter(
      (u) =>
        (roleFilter === "all" || (u.role || "user") === roleFilter) &&
        (statusFilter === "all" || u.banned === (statusFilter === "banned")) &&
        (!query ||
          u.email.toLowerCase().includes(query) ||
          (u.name || "").toLowerCase().includes(query))
    );
  }, [users, searchQuery, roleFilter, statusFilter]);

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

  if (isLoading && users.length === 0) {
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
          onValueChange={(value) => setRoleFilter(value as RoleFilter)}
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
          onValueChange={(value) => setStatusFilter(value as StatusFilter)}
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
          subtitle={t("adminUsers.subtitle", { count: counts.total, banned: counts.banned })}
        />

        <div className="flex flex-col gap-[11px] lg:flex-row lg:items-center lg:gap-[9px]">
          <AdminSearch
            value={searchQuery}
            onChange={setSearchQuery}
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
                  { value: "all", label: `${t("adminUsers.all")} ${counts.total}` },
                  { value: "superadmin", label: `${t("common.roles.superadmin")} ${counts.superadmin}` },
                  { value: "banned", label: `${t("admin.banned")} ${counts.banned}` },
                ]}
              />
            </div>
            {filterMenu}
          </div>
          <div className="hidden lg:block">{filterMenu}</div>
        </div>

        <UserTable
          users={filteredUsers}
          total={counts.total}
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
