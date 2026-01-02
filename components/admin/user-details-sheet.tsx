"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import {
  Edit,
  Key,
  Ban,
  ShieldOff,
  Trash2,
  Calendar,
  Share2,
  Monitor,
} from "lucide-react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAdminUsers, type UserDetails } from "@/hooks/useAdminUsers";
import {
  useCanEditUser,
  useCanBanUser,
  useCanDeleteUser,
  useCanResetPassword,
} from "@/hooks/useAdminAccess";
import { getDateLocale } from "@/lib/locales";

interface UserDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  onEdit: () => void;
  onResetPassword: () => void;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
}

export function UserDetailsSheet({
  open,
  onOpenChange,
  userId,
  onEdit,
  onResetPassword,
  onBan,
  onUnban,
  onDelete,
}: UserDetailsSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const { fetchUserDetails, isLoading } = useAdminUsers();
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);

  const canEdit = useCanEditUser(userDetails);
  const canBan = useCanBanUser(userDetails);
  const canDelete = useCanDeleteUser(userDetails);
  const canResetPassword = useCanResetPassword(userDetails);

  useEffect(() => {
    if (!open) return;

    const loadDetails = async () => {
      const details = await fetchUserDetails(userId);
      if (details) {
        setUserDetails(details);
      }
    };

    loadDetails();
  }, [open, userId, fetchUserDetails]);

  const getUserInitials = () => {
    if (!userDetails) return "?";
    if (userDetails.name) {
      return userDetails.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (userDetails.email) {
      return userDetails.email.slice(0, 2).toUpperCase();
    }
    return "?";
  };

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "superadmin":
        return "bg-red-500/10 text-red-500 border-red-500/20";
      case "admin":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      default:
        return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.userDetails")}
      description={t("admin.userDetailsDescription")}
      maxWidth="lg"
    >
      {isLoading && !userDetails ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : userDetails ? (
        <div className="space-y-6">
          {/* User Info Card */}
          <div className="flex items-start gap-4 p-4 rounded-lg border bg-muted/30">
            <Avatar className="h-16 w-16">
              {userDetails.image && <AvatarImage src={userDetails.image} />}
              <AvatarFallback className="text-lg">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-semibold truncate">
                  {userDetails.name}
                </h3>
                <span
                  className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${getRoleBadgeClass(
                    userDetails.role || "user"
                  )}`}
                >
                  {t(`common.roles.${userDetails.role}`)}
                </span>
                {userDetails.banned && (
                  <Badge variant="destructive">{t("admin.banned")}</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {userDetails.email}
              </p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                <span>
                  {t("admin.joined")}{" "}
                  {format(userDetails.createdAt, "PP", {
                    locale: dateLocale,
                  })}
                </span>
                {userDetails.lastActivity && (
                  <span>
                    {t("common.time.lastActive")}{" "}
                    {formatDistanceToNow(userDetails.lastActivity, {
                      addSuffix: true,
                      locale: dateLocale,
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Ban Information */}
          {userDetails.banned && (
            <div className="p-4 rounded-lg border bg-destructive/5 border-destructive/20">
              <h4 className="text-sm font-semibold text-destructive mb-2">
                {t("admin.banned")}
              </h4>
              {userDetails.banReason && (
                <p className="text-sm mb-2">{userDetails.banReason}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {userDetails.banExpires
                  ? t("admin.bannedUntil", {
                      date: format(userDetails.banExpires, "PPP", {
                        locale: dateLocale,
                      }),
                    })
                  : t("admin.bannedPermanently")}
              </p>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                {t("admin.editUser")}
              </Button>
            )}
            {canResetPassword && (
              <Button size="sm" variant="outline" onClick={onResetPassword}>
                <Key className="h-4 w-4 mr-2" />
                {t("admin.resetPassword")}
              </Button>
            )}
            {canBan && !userDetails.banned && (
              <Button size="sm" variant="outline" onClick={onBan}>
                <Ban className="h-4 w-4 mr-2" />
                {t("admin.banUser")}
              </Button>
            )}
            {canBan && userDetails.banned && (
              <Button size="sm" variant="outline" onClick={onUnban}>
                <ShieldOff className="h-4 w-4 mr-2" />
                {t("admin.unbanUser")}
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="destructive" onClick={onDelete}>
                <Trash2 className="h-4 w-4 mr-2" />
                {t("admin.deleteUser")}
              </Button>
            )}
          </div>

          <Separator />

          {/* Statistics */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              {t("common.stats.statistics")}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Calendar className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {userDetails.ownedCalendars.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("admin.ownedCalendars")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Share2 className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {userDetails.sharedCalendars.length}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("common.labels.sharedCalendars")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
                <Monitor className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {userDetails.sessionsCount}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t("common.auth.activeSessions")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Owned Calendars */}
          {userDetails.ownedCalendars.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">
                  {t("admin.ownedCalendars")} (
                  {userDetails.ownedCalendars.length})
                </h4>
                <div className="space-y-2">
                  {userDetails.ownedCalendars.map((calendar) => (
                    <div
                      key={calendar.id}
                      className="flex items-center gap-3 p-3 rounded-lg border bg-muted/20"
                    >
                      <div
                        className="h-4 w-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: calendar.color }}
                      />
                      <span className="text-sm truncate">{calendar.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Shared Calendars */}
          {userDetails.sharedCalendars.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">
                  {t("common.labels.sharedCalendars")} (
                  {userDetails.sharedCalendars.length})
                </h4>
                <div className="space-y-2">
                  {userDetails.sharedCalendars.map((share) => (
                    <div
                      key={share.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
                    >
                      <span className="text-sm truncate">{share.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {t(`common.labels.permissions.${share.permission}`)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Connected Accounts */}
          {userDetails.accounts.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">
                  {t("common.auth.connectedAccounts")} (
                  {userDetails.accounts.length})
                </h4>
                <div className="space-y-2">
                  {userDetails.accounts.map((account) => (
                    <div
                      key={account.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20"
                    >
                      <span className="text-sm font-medium capitalize">
                        {account.providerId}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {format(account.createdAt, "PP", {
                          locale: dateLocale,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          {t("admin.userNotFound")}
        </div>
      )}
    </BaseSheet>
  );
}
