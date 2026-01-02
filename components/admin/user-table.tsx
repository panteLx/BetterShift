"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import {
  MoreVertical,
  Edit,
  Key,
  Ban,
  ShieldOff,
  Trash2,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { getDateLocale } from "@/lib/locales";
import type { AdminUser } from "@/hooks/useAdminUsers";
import {
  useCanEditUser,
  useCanBanUser,
  useCanDeleteUser,
  useCanResetPassword,
} from "@/hooks/useAdminAccess";

interface UserTableProps {
  users: AdminUser[];
  isLoading?: boolean;
  onUserClick: (user: AdminUser) => void;
  onEditUser: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onBanUser: (user: AdminUser) => void;
  onUnbanUser: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}

type SortColumn =
  | "name"
  | "email"
  | "role"
  | "status"
  | "createdAt"
  | "lastActivity"
  | "calendarCount"
  | "sharesCount";
type SortDirection = "asc" | "desc";

function UserTableRow({
  user,
  onUserClick,
  onEditUser,
  onResetPassword,
  onBanUser,
  onUnbanUser,
  onDeleteUser,
}: {
  user: AdminUser;
  onUserClick: (user: AdminUser) => void;
  onEditUser: (user: AdminUser) => void;
  onResetPassword: (user: AdminUser) => void;
  onBanUser: (user: AdminUser) => void;
  onUnbanUser: (user: AdminUser) => void;
  onDeleteUser: (user: AdminUser) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const canEdit = useCanEditUser(user);
  const canBan = useCanBanUser(user);
  const canDelete = useCanDeleteUser(user);
  const canResetPassword = useCanResetPassword(user);

  const getUserInitials = () => {
    if (user.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return user.email.slice(0, 2).toUpperCase();
  };

  const getRoleBadgeClass = () => {
    switch (user.role) {
      case "superadmin":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "admin":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  const hasActions = canEdit || canResetPassword || canBan || canDelete;

  return (
    <TableRow className="cursor-pointer" onClick={() => onUserClick(user)}>
      {/* Avatar + Name + Email */}
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            {user.image && <AvatarImage src={user.image} />}
            <AvatarFallback className="text-xs">
              {getUserInitials()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{user.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </div>
      </TableCell>

      {/* Role */}
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeClass()}`}
        >
          {t(`common.roles.${user.role}`)}
        </span>
      </TableCell>

      {/* Status */}
      <TableCell>
        {user.banned ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Badge variant="destructive" className="cursor-help">
                  {t("admin.banned")}
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="space-y-1">
                  {user.banReason && (
                    <p className="text-xs font-medium">{user.banReason}</p>
                  )}
                  {user.banExpires ? (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.bannedUntil", {
                        date: format(user.banExpires, "PPP", {
                          locale: dateLocale,
                        }),
                      })}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {t("admin.bannedPermanently")}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <Badge variant="secondary">{t("common.status.active")}</Badge>
        )}
      </TableCell>

      {/* Created */}
      <TableCell>
        <span className="text-sm text-muted-foreground">
          {format(user.createdAt, "PP", { locale: dateLocale })}
        </span>
      </TableCell>

      {/* Last Activity */}
      <TableCell>
        {user.lastActivity ? (
          <span className="text-sm text-muted-foreground">
            {formatDistanceToNow(user.lastActivity, {
              addSuffix: true,
              locale: dateLocale,
            })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">
            {t("admin.neverActive")}
          </span>
        )}
      </TableCell>

      {/* Calendar Count */}
      <TableCell>
        <span className="text-sm">{user.calendarCount}</span>
      </TableCell>

      {/* Shares Count */}
      <TableCell>
        <span className="text-sm">{user.sharesCount}</span>
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
              {canEdit && (
                <DropdownMenuItem onClick={() => onEditUser(user)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("admin.editUser")}
                </DropdownMenuItem>
              )}
              {canResetPassword && (
                <DropdownMenuItem onClick={() => onResetPassword(user)}>
                  <Key className="h-4 w-4 mr-2" />
                  {t("admin.resetPassword")}
                </DropdownMenuItem>
              )}
              {canBan && (
                <>
                  {(canEdit || canResetPassword) && <DropdownMenuSeparator />}
                  {!user.banned ? (
                    <DropdownMenuItem onClick={() => onBanUser(user)}>
                      <Ban className="h-4 w-4 mr-2" />
                      {t("admin.banUser")}
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onUnbanUser(user)}>
                      <ShieldOff className="h-4 w-4 mr-2" />
                      {t("admin.unbanUser")}
                    </DropdownMenuItem>
                  )}
                </>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDeleteUser(user)}
                    className="text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {t("admin.deleteUser")}
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

export function UserTable({
  users,
  onUserClick,
  onEditUser,
  onResetPassword,
  onBanUser,
  onUnbanUser,
  onDeleteUser,
}: UserTableProps) {
  const t = useTranslations();
  const [sortColumn, setSortColumn] = useState<SortColumn | null>("createdAt");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Sort users
  const sortedUsers = [...users].sort((a, b) => {
    if (!sortColumn) return 0;

    let comparison = 0;

    switch (sortColumn) {
      case "name":
        comparison = (a.name || "").localeCompare(b.name || "");
        break;
      case "email":
        comparison = a.email.localeCompare(b.email);
        break;
      case "role":
        const roleOrder = { user: 0, admin: 1, superadmin: 2 };
        comparison =
          (roleOrder[a.role as keyof typeof roleOrder] ?? 0) -
          (roleOrder[b.role as keyof typeof roleOrder] ?? 0);
        break;
      case "status":
        comparison = (a.banned ? 1 : 0) - (b.banned ? 1 : 0);
        break;
      case "createdAt":
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
        break;
      case "lastActivity":
        const aTime = a.lastActivity?.getTime() ?? 0;
        const bTime = b.lastActivity?.getTime() ?? 0;
        comparison = aTime - bTime;
        break;
      case "calendarCount":
        comparison = a.calendarCount - b.calendarCount;
        break;
      case "sharesCount":
        comparison = a.sharesCount - b.sharesCount;
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
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("name")}
            >
              <div className="flex items-center gap-2">
                {t("common.labels.user")}
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
              onClick={() => handleSort("role")}
            >
              <div className="flex items-center gap-2">
                {t("admin.role")}
                {sortColumn === "role" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("status")}
            >
              <div className="flex items-center gap-2">
                {t("common.labels.status")}
                {sortColumn === "status" &&
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
              onClick={() => handleSort("lastActivity")}
            >
              <div className="flex items-center gap-2">
                {t("common.time.lastActive")}
                {sortColumn === "lastActivity" &&
                  (sortDirection === "asc" ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  ))}
              </div>
            </TableHead>
            <TableHead
              className="cursor-pointer hover:bg-muted/80 transition-colors"
              onClick={() => handleSort("calendarCount")}
            >
              <div className="flex items-center gap-2">
                {t("admin.calendarsCount")}
                {sortColumn === "calendarCount" &&
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
            <TableHead className="w-[50px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center py-8">
                <p className="text-sm text-muted-foreground">
                  {t("common.empty.noUsersFound")}
                </p>
              </TableCell>
            </TableRow>
          ) : (
            sortedUsers.map((user) => (
              <UserTableRow
                key={user.id}
                user={user}
                onUserClick={onUserClick}
                onEditUser={onEditUser}
                onResetPassword={onResetPassword}
                onBanUser={onBanUser}
                onUnbanUser={onUnbanUser}
                onDeleteUser={onDeleteUser}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
