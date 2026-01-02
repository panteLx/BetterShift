"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { format } from "date-fns";
import { UserPlus, MoreVertical, Trash2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { CalendarShareUserSearch } from "@/components/calendar-share-user-search";
import {
  useCalendarShares,
  type CalendarShare,
} from "@/hooks/useCalendarShares";
import { useAuth } from "@/hooks/useAuth";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

interface CalendarShareListProps {
  calendarId: string;
  canManageShares: boolean;
}

export function CalendarShareList({
  calendarId,
  canManageShares,
}: CalendarShareListProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { user: currentUser } = useAuth();
  const { isOwner } = useCalendarPermission(calendarId);
  const { shares, fetchShares, updateShare, removeShare } =
    useCalendarShares(calendarId);

  const [showAddUser, setShowAddUser] = useState(false);
  const [shareToDelete, setShareToDelete] = useState<CalendarShare | null>(
    null
  );

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  const getUserInitials = (share: CalendarShare) => {
    if (share.user.name) {
      return share.user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return share.user.email.slice(0, 2).toUpperCase();
  };

  const getPermissionBadgeClass = (permission: string) => {
    switch (permission) {
      case "owner":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "admin":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "write":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "read":
        return "bg-green-500/10 text-green-500 border-green-500/20";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const handlePermissionChange = async (
    shareId: string,
    newPermission: "admin" | "write" | "read"
  ) => {
    await updateShare(shareId, newPermission);
  };

  const handleRemoveShare = async () => {
    if (!shareToDelete) return;
    await removeShare(shareToDelete.id);
    setShareToDelete(null);
  };

  const isSelf = (share: CalendarShare) => share.userId === currentUser?.id;

  return (
    <>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">
              {t("share.userShares")} ({shares.length})
            </p>
            <p className="text-xs text-muted-foreground">
              {t("share.userSharesDescription")}
            </p>
          </div>
          {canManageShares && (
            <Button
              onClick={() => setShowAddUser(true)}
              size="sm"
              className="gap-2"
            >
              <UserPlus className="h-4 w-4" />
              {t("common.add")}
            </Button>
          )}
        </div>

        {/* Shares Table */}
        {shares.length === 0 ? (
          <div className="border rounded-lg p-8 text-center">
            <div className="flex flex-col items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("share.noShares")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("share.noSharesDescription")}
                </p>
              </div>
              {canManageShares && (
                <Button
                  onClick={() => setShowAddUser(true)}
                  size="sm"
                  className="gap-2 mt-2"
                >
                  <UserPlus className="h-4 w-4" />
                  {t("share.addUser")}
                </Button>
              )}
            </div>
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("common.labels.user")}</TableHead>
                  <TableHead>{t("common.labels.permission")}</TableHead>
                  <TableHead>{t("share.sharedBy")}</TableHead>
                  <TableHead>{t("share.sharedOn")}</TableHead>
                  {canManageShares && (
                    <TableHead className="w-[50px]"></TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {shares.map((share) => (
                  <TableRow key={share.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          {share.user.image && (
                            <AvatarImage src={share.user.image} />
                          )}
                          <AvatarFallback className="text-xs">
                            {getUserInitials(share)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">
                            {share.user.name || share.user.email}
                            {isSelf(share) && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({t("share.you")})
                              </span>
                            )}
                          </p>
                          {share.user.name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {share.user.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {canManageShares &&
                      !isSelf(share) &&
                      (isOwner || share.permission !== "admin") ? (
                        <Select
                          value={share.permission}
                          onValueChange={(value) =>
                            handlePermissionChange(
                              share.id,
                              value as "admin" | "write" | "read"
                            )
                          }
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="read">
                              {t("common.labels.permissions.read")}
                            </SelectItem>
                            <SelectItem value="write">
                              {t("common.labels.permissions.write")}
                            </SelectItem>
                            {isOwner && (
                              <SelectItem value="admin">
                                {t("common.labels.permissions.admin")}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getPermissionBadgeClass(
                            share.permission
                          )}`}
                        >
                          {t(`common.labels.permissions.${share.permission}`)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm truncate">
                        {share.sharedByUser.name || share.sharedByUser.email}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(share.createdAt), "PP", {
                          locale: getDateLocale(locale),
                        })}
                      </p>
                    </TableCell>
                    {canManageShares &&
                      (isOwner || share.permission !== "admin") && (
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => setShareToDelete(share)}
                                className="text-destructive"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                {t("share.removeAccess")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Add User Dialog */}
      <CalendarShareUserSearch
        open={showAddUser}
        onOpenChange={setShowAddUser}
        calendarId={calendarId}
        onSuccess={fetchShares}
      />

      {/* Remove Confirmation */}
      {shareToDelete && (
        <ConfirmationDialog
          open={!!shareToDelete}
          onOpenChange={(open) => !open && setShareToDelete(null)}
          onConfirm={handleRemoveShare}
          title={t("share.removeShareConfirmTitle")}
          description={t("share.removeShareConfirmDesc", {
            user: shareToDelete.user.name || shareToDelete.user.email,
          })}
          confirmVariant="destructive"
          confirmText={t("common.delete")}
          cancelText={t("common.cancel")}
        />
      )}
    </>
  );
}
