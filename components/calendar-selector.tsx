"use client";

import { useTranslations } from "next-intl";
import { CalendarWithCount } from "@/lib/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Bell,
  Copy,
  Settings,
  Lock,
  User,
  Users,
  Globe,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";

interface CalendarSelectorProps {
  calendars: CalendarWithCount[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onSettings?: () => void;
  onSyncNotifications?: () => void;
  onCompare?: () => void;
  hasSyncErrors?: boolean;
  variant?: "desktop" | "mobile";
}

export function CalendarSelector({
  calendars,
  selectedId,
  onSelect,
  onCreateNew,
  onSettings,
  onSyncNotifications,
  onCompare,
  hasSyncErrors = false,
  variant = "desktop",
}: CalendarSelectorProps) {
  const t = useTranslations();
  const { isGuest, user } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();

  // Filter calendars: guests only see calendars with read or write permission
  const visibleCalendars = isGuest
    ? calendars.filter(
        (c) =>
          c.guestPermission === "read" ||
          c.guestPermission === "write" ||
          c.tokenPermission === "read" ||
          c.tokenPermission === "write"
      )
    : calendars;

  const selectedCalendar = visibleCalendars.find((c) => c.id === selectedId);
  const canCompare = visibleCalendars.length >= 2;

  // Group calendars by ownership
  const ownCalendars = visibleCalendars.filter(
    (c) => isAuthEnabled && user && !isGuest && c.ownerId === user.id
  );
  const sharedCalendars = visibleCalendars.filter(
    (c) =>
      isAuthEnabled &&
      user &&
      !isGuest &&
      c.ownerId !== user.id &&
      c.sharePermission // Only calendars with explicit share permission, not tokens
  );
  const tokenCalendars =
    isAuthEnabled && !isGuest
      ? visibleCalendars.filter(
          (c) =>
            c.tokenPermission &&
            !c.sharePermission &&
            (!user || c.ownerId !== user?.id)
        )
      : [];
  // Public calendars: Calendars with guestPermission that authenticated users have subscribed to
  // Exclude calendars already shown in other groups (own, shared, token)
  const publicCalendars =
    isAuthEnabled && user && !isGuest
      ? visibleCalendars.filter(
          (c) =>
            c.guestPermission &&
            !c.sharePermission &&
            !c.tokenPermission &&
            c.ownerId !== user.id
        )
      : [];
  // For guests or when auth is disabled, show all visible calendars without grouping
  // Guests see all their accessible calendars in one list (no separation by token/guest permission)
  const guestAccessibleCalendars =
    !isAuthEnabled || isGuest ? visibleCalendars : [];

  // Check if selected calendar is read-only
  // Owner is never read-only, even if guestPermission is "read"
  // Guests (no user) or non-owners see read-only based on permissions
  // Priority: owner > sharePermission > tokenPermission > guestPermission
  const isReadOnly =
    selectedCalendar &&
    (!user || selectedCalendar.ownerId !== user.id) &&
    (selectedCalendar.sharePermission === "read" ||
      (!selectedCalendar.sharePermission &&
        selectedCalendar.tokenPermission === "read") ||
      (!selectedCalendar.sharePermission &&
        !selectedCalendar.tokenPermission &&
        selectedCalendar.guestPermission === "read"));

  // Check if user can manage settings (owner or admin)
  const { canManage } = useCalendarPermission(selectedCalendar);

  // Helper function to render calendar icon
  const getCalendarIcon = (calendar: CalendarWithCount) => {
    if (!isAuthEnabled) {
      return null;
    }
    if (!user) {
      return <Globe className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }
    // Check for admin/owner permission
    if (
      calendar.sharePermission === "admin" ||
      calendar.sharePermission === "owner"
    ) {
      return (
        <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500" />
      );
    }
    if (calendar.ownerId === user.id) {
      return <User className="h-3.5 w-3.5 text-muted-foreground/60" />;
    }
    return <Users className="h-3.5 w-3.5 text-muted-foreground/60" />;
  };

  // Helper function to render calendar item
  const renderCalendarItem = (calendar: CalendarWithCount) => {
    // Check for admin/owner first
    const isAdmin =
      isAuthEnabled &&
      (calendar.sharePermission === "admin" ||
        calendar.sharePermission === "owner");

    // Check if calendar is read-only
    // Owner is never read-only, even if guestPermission is "read"
    // Guests (no user) or non-owners see read-only based on permissions
    // Priority: owner > sharePermission > tokenPermission > guestPermission
    const isCalendarReadOnly =
      isAuthEnabled &&
      (!user || calendar.ownerId !== user.id) &&
      (calendar.sharePermission === "read" ||
        (!calendar.sharePermission && calendar.tokenPermission === "read") ||
        (!calendar.sharePermission &&
          !calendar.tokenPermission &&
          calendar.guestPermission === "read"));

    const icon = isAdmin ? (
      <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500 flex-shrink-0" />
    ) : isCalendarReadOnly ? (
      <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
    ) : (
      getCalendarIcon(calendar)
    );

    return (
      <SelectItem key={calendar.id} value={calendar.id}>
        <div className="flex items-center gap-2.5 w-full">
          {icon}
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: calendar.color }}
          />
          <span className="flex-1 truncate">{calendar.name}</span>
        </div>
      </SelectItem>
    );
  };

  // Desktop: Compact icon-based layout
  if (variant === "desktop") {
    return (
      <div className="flex gap-2 items-center">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="flex-1 h-9 sm:h-10 text-sm">
            {selectedCalendar ? (
              <div className="flex items-center gap-2 flex-1">
                {isAuthEnabled &&
                  (selectedCalendar.sharePermission === "admin" ||
                  selectedCalendar.sharePermission === "owner" ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500 flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("common.labels.permissions.admin")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : isReadOnly ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{t("common.labels.permissions.read")}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    getCalendarIcon(selectedCalendar)
                  ))}
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCalendar.color }}
                />
                <span className="truncate">{selectedCalendar.name}</span>
              </div>
            ) : (
              <SelectValue placeholder={t("calendar.title")} />
            )}
          </SelectTrigger>
          <SelectContent>
            {/* Own Calendars */}
            {isAuthEnabled && ownCalendars.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3 w-3" />
                  {t("calendar.myCalendars", { default: "Meine Kalender" })}
                </div>
                {ownCalendars.map(renderCalendarItem)}
              </>
            )}

            {/* Shared Calendars */}
            {isAuthEnabled && sharedCalendars.length > 0 && (
              <>
                {ownCalendars.length > 0 && <Separator className="my-1" />}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Users className="h-3 w-3" />
                  {t("calendar.sharedCalendars", {
                    default: "Geteilte Kalender",
                  })}
                </div>
                {sharedCalendars.map(renderCalendarItem)}
              </>
            )}

            {/* Token-accessible Calendars */}
            {tokenCalendars.length > 0 && (
              <>
                {(ownCalendars.length > 0 || sharedCalendars.length > 0) && (
                  <Separator className="my-1" />
                )}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  {t("calendar.tokenCalendars", {
                    default: "Via Zugangslink",
                  })}
                </div>
                {tokenCalendars.map(renderCalendarItem)}
              </>
            )}

            {/* Public Calendars (guestPermission subscribed by authenticated users) */}
            {publicCalendars.length > 0 && (
              <>
                {(ownCalendars.length > 0 ||
                  sharedCalendars.length > 0 ||
                  tokenCalendars.length > 0) && <Separator className="my-1" />}
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3" />
                  {t("calendar.publicCalendars", {
                    default: "Öffentliche Kalender",
                  })}
                </div>
                {publicCalendars.map(renderCalendarItem)}
              </>
            )}

            {/* Guest Accessible Calendars (when auth disabled or user is guest) */}
            {(!isAuthEnabled || isGuest) &&
              guestAccessibleCalendars.length > 0 && (
                <>{guestAccessibleCalendars.map(renderCalendarItem)}</>
              )}

            {!isGuest && (
              <>
                <Separator className="my-1" />
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreateNew();
                  }}
                  className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t("calendar.create")}
                </div>
              </>
            )}
          </SelectContent>
        </Select>
        {onSettings && selectedId && canManage && (
          <Button
            onClick={onSettings}
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10"
            title={t("calendar.settings", {
              name: selectedCalendar?.name || "",
            })}
          >
            <Settings className="h-4 w-4" />
          </Button>
        )}
        {onSyncNotifications && selectedId && (
          <Button
            onClick={onSyncNotifications}
            size="icon"
            variant="outline"
            className={`h-9 w-9 sm:h-10 sm:w-10 relative ${
              hasSyncErrors
                ? "text-red-600 hover:text-red-600 border-red-300 hover:border-red-400"
                : ""
            }`}
            title={
              hasSyncErrors
                ? t("syncNotifications.hasErrors")
                : t("syncNotifications.title")
            }
          >
            <Bell className="h-4 w-4" />
            {hasSyncErrors && (
              <span className="absolute -top-1 -right-1 h-3 w-3 bg-red-600 rounded-full border-2 border-background animate-pulse" />
            )}
          </Button>
        )}
        {onCompare && canCompare && (
          <Button
            onClick={onCompare}
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10"
            title={t("calendar.compare")}
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  // Mobile: Full-width dropdown with buttons in grid below
  return (
    <div className="flex flex-col gap-3">
      {/* Calendar Dropdown - Full Width */}
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="w-full h-10 text-sm">
          {selectedCalendar ? (
            <div className="flex items-center gap-2 flex-1">
              {isAuthEnabled &&
                (selectedCalendar.sharePermission === "admin" ||
                selectedCalendar.sharePermission === "owner" ? (
                  <ShieldCheck className="h-3.5 w-3.5 text-blue-600 dark:text-blue-500 flex-shrink-0" />
                ) : isReadOnly ? (
                  <Lock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-500 flex-shrink-0" />
                ) : (
                  getCalendarIcon(selectedCalendar)
                ))}
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedCalendar.color }}
              />
              <span className="truncate">{selectedCalendar.name}</span>
            </div>
          ) : (
            <SelectValue placeholder={t("calendar.title")} />
          )}
        </SelectTrigger>
        <SelectContent>
          {/* Own Calendars */}
          {isAuthEnabled && ownCalendars.length > 0 && (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <User className="h-3 w-3" />
                {t("calendar.myCalendars", { default: "Meine Kalender" })}
              </div>
              {ownCalendars.map(renderCalendarItem)}
            </>
          )}

          {/* Shared Calendars */}
          {isAuthEnabled && sharedCalendars.length > 0 && (
            <>
              {ownCalendars.length > 0 && <Separator className="my-1" />}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Users className="h-3 w-3" />
                {t("calendar.sharedCalendars", {
                  default: "Geteilte Kalender",
                })}
              </div>
              {sharedCalendars.map(renderCalendarItem)}
            </>
          )}

          {/* Token-accessible Calendars */}
          {tokenCalendars.length > 0 && (
            <>
              {(ownCalendars.length > 0 || sharedCalendars.length > 0) && (
                <Separator className="my-1" />
              )}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                {t("calendar.tokenCalendars", {
                  default: "Via Zugangslink",
                })}
              </div>
              {tokenCalendars.map(renderCalendarItem)}
            </>
          )}

          {/* Public Calendars (guestPermission subscribed by authenticated users) */}
          {publicCalendars.length > 0 && (
            <>
              {(ownCalendars.length > 0 ||
                sharedCalendars.length > 0 ||
                tokenCalendars.length > 0) && <Separator className="my-1" />}
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Globe className="h-3 w-3" />
                {t("calendar.publicCalendars", {
                  default: "Öffentliche Kalender",
                })}
              </div>
              {publicCalendars.map(renderCalendarItem)}
            </>
          )}

          {/* Guest Accessible Calendars (when auth disabled or user is guest) */}
          {(!isAuthEnabled || isGuest) &&
            guestAccessibleCalendars.length > 0 && (
              <>{guestAccessibleCalendars.map(renderCalendarItem)}</>
            )}

          {!isGuest && (
            <>
              <Separator className="my-1" />
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onCreateNew();
                }}
                className="relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("calendar.create")}
              </div>
            </>
          )}
        </SelectContent>
      </Select>

      {/* Action Buttons - Even distribution */}
      {selectedId && (
        <div className="grid grid-cols-3 gap-2">
          {onSettings && canManage && (
            <Button
              onClick={onSettings}
              size="sm"
              variant="outline"
              className="h-9"
              title={t("calendar.settings", {
                name: selectedCalendar?.name || "",
              })}
            >
              <Settings className="h-4 w-4" />
            </Button>
          )}
          {onSyncNotifications && (
            <Button
              onClick={onSyncNotifications}
              size="sm"
              variant="outline"
              className={`h-9 relative ${
                hasSyncErrors
                  ? "text-red-600 hover:text-red-600 border-red-300 hover:border-red-400"
                  : ""
              }`}
              title={
                hasSyncErrors
                  ? t("syncNotifications.hasErrors")
                  : t("syncNotifications.title")
              }
            >
              <Bell className="h-4 w-4" />
              {hasSyncErrors && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-600 rounded-full border-2 border-background animate-pulse" />
              )}
            </Button>
          )}
          {onCompare && canCompare && (
            <Button
              onClick={onCompare}
              size="sm"
              variant="outline"
              className="h-9"
            >
              <Copy className="h-4 w-4 mr-2" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
