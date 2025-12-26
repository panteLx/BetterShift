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
import { Plus, Bell, Copy, Settings, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
  const { isGuest } = useAuth();

  // Filter calendars: guests only see calendars with read or write permission
  const visibleCalendars = isGuest
    ? calendars.filter(
        (c) => c.guestPermission === "read" || c.guestPermission === "write"
      )
    : calendars;

  const selectedCalendar = visibleCalendars.find((c) => c.id === selectedId);
  const canCompare = visibleCalendars.length >= 2;

  // Check if selected calendar is read-only for guest
  const isReadOnly = isGuest && selectedCalendar?.guestPermission === "read";

  // Desktop: Compact icon-based layout
  if (variant === "desktop") {
    return (
      <div className="flex gap-2 items-center">
        <Select value={selectedId} onValueChange={onSelect}>
          <SelectTrigger className="flex-1 h-9 sm:h-10 text-sm">
            {selectedCalendar ? (
              <div className="flex items-center gap-2 flex-1">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: selectedCalendar.color }}
                />
                <span className="truncate">{selectedCalendar.name}</span>
                {isReadOnly && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{t("guest.readOnlyAccess")}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            ) : (
              <SelectValue placeholder={t("calendar.title")} />
            )}
          </SelectTrigger>
          <SelectContent>
            {visibleCalendars.map((calendar) => {
              const isCalendarReadOnly =
                isGuest && calendar.guestPermission === "read";

              return (
                <SelectItem key={calendar.id} value={calendar.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: calendar.color }}
                    />
                    <span className="flex-1">{calendar.name}</span>
                    {isCalendarReadOnly && (
                      <Lock className="h-3 w-3 text-muted-foreground ml-2" />
                    )}
                  </div>
                </SelectItem>
              );
            })}
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
        {onSettings && selectedId && !isGuest && (
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
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: selectedCalendar.color }}
              />
              <span className="truncate">{selectedCalendar.name}</span>
              {isReadOnly && (
                <Lock className="h-3 w-3 text-muted-foreground ml-auto" />
              )}
            </div>
          ) : (
            <SelectValue placeholder={t("calendar.title")} />
          )}
        </SelectTrigger>
        <SelectContent>
          {visibleCalendars.map((calendar) => {
            const isCalendarReadOnly =
              isGuest && calendar.guestPermission === "read";

            return (
              <SelectItem key={calendar.id} value={calendar.id}>
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: calendar.color }}
                  />
                  <span className="flex-1">{calendar.name}</span>
                  {isCalendarReadOnly && (
                    <Lock className="h-3 w-3 text-muted-foreground ml-2" />
                  )}
                </div>
              </SelectItem>
            );
          })}
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
          {onSettings && !isGuest && (
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
