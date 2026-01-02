"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { format } from "date-fns";
import {
  Edit,
  Send,
  Trash2,
  Calendar,
  StickyNote,
  Bookmark,
  Share2,
  CloudDownload,
  Link,
} from "lucide-react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  useAdminCalendars,
  type CalendarDetails,
} from "@/hooks/useAdminCalendars";
import {
  useCanEditCalendar,
  useCanDeleteCalendar,
  useCanTransferCalendar,
} from "@/hooks/useAdminAccess";
import { getDateLocale } from "@/lib/locales";

interface CalendarDetailsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  onEdit: () => void;
  onTransfer: () => void;
  onDelete: () => void;
}

export function CalendarDetailsSheet({
  open,
  onOpenChange,
  calendarId,
  onEdit,
  onTransfer,
  onDelete,
}: CalendarDetailsSheetProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const { fetchCalendarDetails, isLoading } = useAdminCalendars();
  const [calendarDetails, setCalendarDetails] =
    useState<CalendarDetails | null>(null);

  const canEdit = useCanEditCalendar();
  const canDelete = useCanDeleteCalendar();
  const canTransfer = useCanTransferCalendar();

  useEffect(() => {
    if (!open) return;

    const loadDetails = async () => {
      const details = await fetchCalendarDetails(calendarId);
      if (details) {
        setCalendarDetails(details);
      }
    };

    loadDetails();
  }, [open, calendarId, fetchCalendarDetails]);

  const isOrphaned = !calendarDetails?.ownerId || !calendarDetails?.owner;

  const getOwnerInitials = () => {
    if (!calendarDetails?.owner) return "?";
    const name = calendarDetails.owner.name;
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getUserInitials = (name: string, email: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    return email.slice(0, 2).toUpperCase();
  };

  const getGuestPermissionBadge = () => {
    if (!calendarDetails) return null;

    const permission = calendarDetails.guestPermission;
    if (permission === "none") {
      return (
        <Badge variant="secondary" className="text-xs">
          {t("common.labels.permissions.none")}
        </Badge>
      );
    } else if (permission === "read") {
      return (
        <Badge variant="outline" className="text-xs">
          {t("common.labels.permissions.read")}
        </Badge>
      );
    } else {
      return (
        <Badge variant="default" className="text-xs">
          {t("common.labels.permissions.write")}
        </Badge>
      );
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.calendars.calendarDetails")}
      description={t("admin.calendars.calendarDetailsDescription")}
      maxWidth="lg"
    >
      {isLoading && !calendarDetails ? (
        <div className="text-center py-12 text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : calendarDetails ? (
        <div className="space-y-6">
          {/* Calendar Info & Owner Cards */}
          <div className="flex items-stretch gap-4">
            {/* Calendar Name Card */}
            <div className="flex-1 p-4 rounded-lg border bg-muted/30">
              <h3 className="text-lg font-semibold mb-2 truncate">
                {calendarDetails.name}
              </h3>
              <div className="flex flex-wrap gap-2 mb-3">
                {isOrphaned && (
                  <Badge
                    variant="outline"
                    className="bg-red-500/10 text-red-500 border-red-500/20"
                  >
                    {t("admin.calendars.orphaned")}
                  </Badge>
                )}
                {getGuestPermissionBadge()}
              </div>
              <div className="space-y-1 text-xs text-muted-foreground">
                <p>
                  {t("common.stats.created")}{" "}
                  {format(calendarDetails.createdAt, "PP", {
                    locale: dateLocale,
                  })}
                </p>
                <p>
                  {t("admin.calendars.updated")}{" "}
                  {format(calendarDetails.updatedAt, "PP", {
                    locale: dateLocale,
                  })}
                </p>
              </div>
            </div>

            {/* Separator */}
            <div className="w-px bg-border self-stretch" />

            {/* Owner Info Card */}
            <div className="flex-1 p-4 rounded-lg border bg-muted/30">
              <h4 className="text-sm font-medium mb-3">
                {t("admin.calendars.owner")}
              </h4>
              {isOrphaned ? (
                <div className="flex items-center justify-center h-20">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {t("admin.calendars.noOwner")}
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {calendarDetails.owner?.image && (
                      <AvatarImage src={calendarDetails.owner.image} />
                    )}
                    <AvatarFallback className="text-sm">
                      {getOwnerInitials()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {calendarDetails.owner?.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {calendarDetails.owner?.email}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Statistics */}
          <div>
            <h4 className="text-sm font-medium mb-3">
              {t("common.stats.statistics")}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("common.labels.shifts")}
                  </span>
                </div>
                <p className="text-xl font-semibold">
                  {calendarDetails.shiftsCount}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 mb-1">
                  <StickyNote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("common.labels.notes")}
                  </span>
                </div>
                <p className="text-xl font-semibold">
                  {calendarDetails.notesCount}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 mb-1">
                  <Bookmark className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("common.labels.presets")}
                  </span>
                </div>
                <p className="text-xl font-semibold">
                  {calendarDetails.presetsCount}
                </p>
              </div>
              <div className="p-3 rounded-lg border bg-muted/20">
                <div className="flex items-center gap-2 mb-1">
                  <Share2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {t("common.labels.shares")}
                  </span>
                </div>
                <p className="text-xl font-semibold">
                  {calendarDetails.sharesCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {calendarDetails.shares.length}{" "}
                  {t("admin.calendars.userShares")},{" "}
                  {calendarDetails.shareTokens?.length || 0}{" "}
                  {t("admin.calendars.tokenShares")}
                </p>
              </div>
            </div>
          </div>

          {/* User Shares List */}
          {calendarDetails.shares.length > 0 && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                  <Share2 className="h-4 w-4" />
                  {t("admin.calendars.userSharesList")} (
                  {calendarDetails.shares.length})
                </h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {calendarDetails.shares.map((share) => (
                    <div
                      key={share.userId}
                      className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                    >
                      <Avatar className="h-8 w-8">
                        {share.userImage && (
                          <AvatarImage src={share.userImage} />
                        )}
                        <AvatarFallback className="text-xs">
                          {getUserInitials(share.userName, share.userEmail)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {share.userName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {share.userEmail}
                        </p>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {t(`common.labels.permissions.${share.permission}`)}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Share Tokens */}
          {calendarDetails.shareTokens &&
            calendarDetails.shareTokens.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <Link className="h-4 w-4" />
                    {t("admin.calendars.tokenSharesList")} (
                    {calendarDetails.shareTokens.length})
                  </h4>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {calendarDetails.shareTokens.map((token) => (
                      <div
                        key={token.id}
                        className="flex items-center gap-3 p-2 rounded-lg border bg-muted/20"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {token.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {t("common.stats.created")}{" "}
                            {format(token.createdAt, "PP", {
                              locale: dateLocale,
                            })}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {t(`common.labels.permissions.${token.permission}`)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          {/* External Syncs */}
          {calendarDetails.externalSyncs &&
            calendarDetails.externalSyncs.length > 0 && (
              <>
                {(calendarDetails.shares.length > 0 ||
                  (calendarDetails.shareTokens &&
                    calendarDetails.shareTokens.length > 0)) && <Separator />}
                <div>
                  <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                    <CloudDownload className="h-4 w-4" />
                    {t("admin.calendars.externalSyncs")} (
                    {calendarDetails.externalSyncs.length})
                  </h4>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {calendarDetails.externalSyncs.map((sync) => (
                      <div
                        key={sync.id}
                        className="p-2 rounded-lg border bg-muted/20"
                      >
                        <p className="text-sm font-medium truncate">
                          {sync.name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {sync.url}
                        </p>
                        {sync.lastSyncedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {t("admin.calendars.lastSynced")}{" "}
                            {format(sync.lastSyncedAt, "PP", {
                              locale: dateLocale,
                            })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

          {/* Quick Actions */}
          {(canEdit || canTransfer || canDelete) && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-3">
                  {t("admin.calendars.quickActions")}
                </h4>
                <div className="flex flex-col sm:flex-row gap-2">
                  {canEdit && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onEdit}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      {t("admin.calendars.editCalendar")}
                    </Button>
                  )}
                  {canTransfer && (
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={onTransfer}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      {t("admin.calendars.transferOwnership")}
                    </Button>
                  )}
                  {canDelete && (
                    <Button
                      variant="outline"
                      className="flex-1 text-destructive hover:text-destructive"
                      onClick={onDelete}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("admin.calendars.deleteCalendar")}
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      ) : null}
    </BaseSheet>
  );
}
