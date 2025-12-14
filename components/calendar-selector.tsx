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
import { Plus, CalendarCog, Cloud, Bell } from "lucide-react";
import { getCachedPassword } from "@/lib/password-cache";

interface CalendarSelectorProps {
  calendars: CalendarWithCount[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onManagePassword?: () => void;
  onExternalSync?: () => void;
  onSyncNotifications?: () => void;
  hasSyncErrors?: boolean;
  variant?: "desktop" | "mobile";
}

export function CalendarSelector({
  calendars,
  selectedId,
  onSelect,
  onCreateNew,
  onManagePassword,
  onExternalSync,
  onSyncNotifications,
  hasSyncErrors = false,
  variant = "desktop",
}: CalendarSelectorProps) {
  const t = useTranslations();

  const selectedCalendar = calendars.find((c) => c.id === selectedId);
  // Hide external sync buttons if calendar requires password AND no valid password is cached
  const requiresPassword = !!selectedCalendar?.passwordHash;
  const hasPassword = selectedId ? !!getCachedPassword(selectedId) : false;
  const shouldHideSyncButtons = requiresPassword && !hasPassword;

  // Desktop: Compact icon-based layout
  if (variant === "desktop") {
    return (
      <div className="flex gap-2 items-center">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="flex-1 h-9 sm:h-10 text-sm">
            <SelectValue placeholder={t("calendar.title")} />
          </SelectTrigger>
          <SelectContent>
            {calendars.map((calendar) => (
              <SelectItem key={calendar.id} value={calendar.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  {calendar.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {onManagePassword && selectedId && (
          <Button
            onClick={onManagePassword}
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10"
            title={t("calendar.settings", {
              name: selectedCalendar?.name || "",
            })}
          >
            <CalendarCog className="h-4 w-4" />
          </Button>
        )}
        {onExternalSync && selectedId && !shouldHideSyncButtons && (
          <Button
            onClick={onExternalSync}
            size="icon"
            variant="outline"
            className="h-9 w-9 sm:h-10 sm:w-10"
            title={t("externalSync.manageTitle")}
          >
            <Cloud className="h-4 w-4" />
          </Button>
        )}
        {onSyncNotifications && selectedId && !shouldHideSyncButtons && (
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
        <Button
          onClick={onCreateNew}
          size="icon"
          variant="outline"
          className="h-9 w-9 sm:h-10 sm:w-10"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  // Mobile: Full-width dropdown with buttons in grid below
  return (
    <div className="flex flex-col gap-3">
      {/* Calendar Dropdown - Full Width */}
      <Select value={selectedId} onValueChange={onSelect}>
        <SelectTrigger className="h-10 text-sm">
          <SelectValue placeholder={t("calendar.title")} />
        </SelectTrigger>
        <SelectContent>
          {calendars.map((calendar) => (
            <SelectItem key={calendar.id} value={calendar.id}>
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: calendar.color }}
                />
                {calendar.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Action Buttons - Even distribution */}
      {selectedId && (
        <div className="grid grid-cols-3 gap-2">
          {onManagePassword && (
            <Button
              onClick={onManagePassword}
              size="sm"
              variant="outline"
              className="h-9"
              title={t("calendar.settings", {
                name: selectedCalendar?.name || "",
              })}
            >
              <CalendarCog className="h-4 w-4" />
            </Button>
          )}
          {onExternalSync && !shouldHideSyncButtons && (
            <Button
              onClick={onExternalSync}
              size="sm"
              variant="outline"
              className="h-9"
              title={t("externalSync.manageTitle")}
            >
              <Cloud className="h-4 w-4" />
            </Button>
          )}
          {onSyncNotifications && !shouldHideSyncButtons && (
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
        </div>
      )}

      {/* Create New Button - Full Width */}
      <Button onClick={onCreateNew} size="sm" variant="outline" className="h-9">
        <Plus className="h-4 w-4 mr-2" />
        {t("common.create")}
      </Button>
    </div>
  );
}
