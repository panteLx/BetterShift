"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Search, Filter, RefreshCw } from "lucide-react";
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
import { UserTable } from "@/components/admin/user-table";
import { UserEditSheet } from "@/components/admin/user-edit-sheet";
import { UserDetailsSheet } from "@/components/admin/user-details-sheet";
import { UserBanDialog } from "@/components/admin/user-ban-dialog";
import { UserUnbanDialog } from "@/components/admin/user-unban-dialog";
import { UserDeleteDialog } from "@/components/admin/user-delete-dialog";
import { UserPasswordResetDialog } from "@/components/admin/user-password-reset-dialog";
import {
  useAdminUsers,
  type AdminUser,
  type UserFilters,
  type UserSort,
} from "@/hooks/useAdminUsers";

export default function AdminUsersPage() {
  const t = useTranslations();
  const {
    fetchUsers,
    banUser,
    unbanUser,
    deleteUser,
    resetPassword,
    isLoading,
  } = useAdminUsers();

  // State
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);

  // Filters & Sort
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<
    "all" | "superadmin" | "admin" | "user"
  >("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "banned">(
    "all"
  );
  const sortField = "createdAt" as const;
  const sortDirection = "desc" as const;

  // Dialogs & Sheets
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [showEditSheet, setShowEditSheet] = useState(false);
  const [showDetailsSheet, setShowDetailsSheet] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showUnbanDialog, setShowUnbanDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);

  // Load users
  const loadUsers = async () => {
    const filters: UserFilters = {
      search: searchQuery || undefined,
      role: roleFilter,
      status: statusFilter,
    };

    const sort: UserSort = {
      field: sortField,
      direction: sortDirection,
    };

    const result = await fetchUsers(filters, sort, {
      page: 1,
      limit: 1000,
    });

    if (result) {
      setUsers(result.users);
      setTotalUsers(result.total);
    }
  };

  // Initial load
  useEffect(() => {
    const filters: UserFilters = {
      search: searchQuery || undefined,
      role: roleFilter,
      status: statusFilter,
    };

    const sort: UserSort = {
      field: sortField,
      direction: sortDirection,
    };

    const loadData = async () => {
      const result = await fetchUsers(filters, sort, {
        page: 1,
        limit: 1000,
      });

      if (result) {
        setUsers(result.users);
        setTotalUsers(result.total);
      }
    };

    loadData();
  }, [
    searchQuery,
    roleFilter,
    statusFilter,
    sortField,
    sortDirection,
    fetchUsers,
  ]);

  // Handlers
  const handleUserClick = (user: AdminUser) => {
    setSelectedUser(user);
    setShowDetailsSheet(true);
  };

  const handleEditUser = (user: AdminUser) => {
    setSelectedUser(user);
    setShowEditSheet(true);
  };

  const handleResetPassword = (user: AdminUser) => {
    setSelectedUser(user);
    setShowPasswordDialog(true);
  };

  const handleBanUser = (user: AdminUser) => {
    setSelectedUser(user);
    setShowBanDialog(true);
  };

  const handleUnbanUser = (user: AdminUser) => {
    setSelectedUser(user);
    setShowUnbanDialog(true);
  };

  const handleDeleteUser = (user: AdminUser) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  const handleBanConfirm = async (reason: string, expiresAt?: Date) => {
    if (!selectedUser) return;
    const success = await banUser(selectedUser.id, reason, expiresAt);
    if (success) {
      loadUsers();
      setShowBanDialog(false);
    }
  };

  const handleUnbanConfirm = async () => {
    if (!selectedUser) return;
    const success = await unbanUser(selectedUser.id);
    if (success) {
      loadUsers();
      setShowUnbanDialog(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedUser) return;
    const success = await deleteUser(selectedUser.id);
    if (success) {
      loadUsers();
      setShowDeleteDialog(false);
    }
  };

  const handlePasswordResetConfirm = async (newPassword: string) => {
    if (!selectedUser) return;
    const success = await resetPassword(selectedUser.id, newPassword);
    if (success) {
      setShowPasswordDialog(false);
    }
  };

  const handleRefresh = () => {
    loadUsers();
  };

  if (isLoading && users.length === 0) {
    return <FullscreenLoader />;
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">
              {t("admin.userManagement")}
            </h2>
            <p className="text-muted-foreground mt-2">
              {t("admin.userManagementDescription")}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={isLoading ? "animate-spin" : ""} />
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("admin.searchUsers")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Role Filter */}
          <Select
            value={roleFilter}
            onValueChange={(value: "all" | "superadmin" | "admin" | "user") =>
              setRoleFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allRoles")}</SelectItem>
              <SelectItem value="superadmin">
                {t("common.roles.superadmin")}
              </SelectItem>
              <SelectItem value="admin">{t("common.roles.admin")}</SelectItem>
              <SelectItem value="user">{t("common.roles.user")}</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select
            value={statusFilter}
            onValueChange={(value: "all" | "active" | "banned") =>
              setStatusFilter(value)
            }
          >
            <SelectTrigger className="w-full sm:w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.allStatuses")}</SelectItem>
              <SelectItem value="active">
                {t("common.status.active")}
              </SelectItem>
              <SelectItem value="banned">{t("admin.banned")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Results Count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <p>{t("admin.usersCount", { count: totalUsers })}</p>
        </div>

        {/* Table */}
        <UserTable
          users={users}
          isLoading={isLoading}
          onUserClick={handleUserClick}
          onEditUser={handleEditUser}
          onResetPassword={handleResetPassword}
          onBanUser={handleBanUser}
          onUnbanUser={handleUnbanUser}
          onDeleteUser={handleDeleteUser}
        />
      </div>

      {/* Edit Sheet */}
      {selectedUser && (
        <UserEditSheet
          key={selectedUser.id}
          open={showEditSheet}
          onOpenChange={setShowEditSheet}
          user={selectedUser}
          onSuccess={loadUsers}
        />
      )}

      {/* Details Sheet */}
      {selectedUser && (
        <UserDetailsSheet
          open={showDetailsSheet}
          onOpenChange={setShowDetailsSheet}
          userId={selectedUser.id}
          onEdit={() => {
            setShowDetailsSheet(false);
            setShowEditSheet(true);
          }}
          onResetPassword={() => {
            setShowDetailsSheet(false);
            setShowPasswordDialog(true);
          }}
          onBan={() => {
            setShowDetailsSheet(false);
            setShowBanDialog(true);
          }}
          onUnban={() => {
            setShowDetailsSheet(false);
            setShowUnbanDialog(true);
          }}
          onDelete={() => {
            setShowDetailsSheet(false);
            setShowDeleteDialog(true);
          }}
        />
      )}

      {/* Ban Dialog */}
      {selectedUser && (
        <UserBanDialog
          open={showBanDialog}
          onOpenChange={setShowBanDialog}
          user={selectedUser}
          onConfirm={handleBanConfirm}
        />
      )}

      {/* Unban Dialog */}
      {selectedUser && (
        <UserUnbanDialog
          open={showUnbanDialog}
          onOpenChange={setShowUnbanDialog}
          user={selectedUser}
          onConfirm={handleUnbanConfirm}
        />
      )}

      {/* Delete Dialog */}
      {selectedUser && (
        <UserDeleteDialog
          open={showDeleteDialog}
          onOpenChange={setShowDeleteDialog}
          user={selectedUser}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {/* Password Reset Dialog */}
      {selectedUser && (
        <UserPasswordResetDialog
          open={showPasswordDialog}
          onOpenChange={setShowPasswordDialog}
          user={selectedUser}
          onConfirm={handlePasswordResetConfirm}
        />
      )}
    </>
  );
}
