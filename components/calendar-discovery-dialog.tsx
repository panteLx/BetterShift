"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import {
  useCalendarSubscriptions,
  type AvailableCalendar,
  type DismissedCalendar,
} from "@/hooks/useCalendarSubscriptions";
import { Users, Search, Eye, Edit, EyeOff, Loader2, Check } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type CalendarDiscoveryDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CalendarDiscoveryDialog({
  open,
  onOpenChange,
}: CalendarDiscoveryDialogProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    availableCalendars,
    dismissedCalendars,
    loading,
    subscribe,
    dismiss,
  } = useCalendarSubscriptions();

  // Merge available and dismissed calendars
  // Filter out dismissed calendar IDs from available to prevent duplicates
  const dismissedIds = new Set(dismissedCalendars.map((cal) => cal.id));

  const allCalendars = [
    ...availableCalendars
      .filter((cal) => !dismissedIds.has(cal.id)) // Don't show dismissed calendars in available
      .map((cal) => ({ ...cal, isDismissed: false })),
    ...dismissedCalendars.map((cal) => ({
      id: cal.id,
      name: cal.name,
      color: cal.color,
      guestPermission: cal.permission,
      owner: cal.owner,
      isSubscribed: false, // Dismissed calendars are not subscribed
      source: cal.source,
      isDismissed: true,
    })),
  ];

  const filteredCalendars = allCalendars.filter((cal) =>
    cal.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleToggleSubscription = async (
    calendar: AvailableCalendar,
    currentlySubscribed: boolean
  ) => {
    if (currentlySubscribed) {
      await dismiss(calendar.id, calendar.name);
    } else {
      await subscribe(calendar.id, calendar.name);
    }
  };

  const renderCalendarCard = (
    calendar: AvailableCalendar & { isDismissed: boolean }
  ) => {
    const isReadOnly = calendar.guestPermission === "read";

    return (
      <div
        key={calendar.id}
        className={`flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all p-4 ${
          calendar.isDismissed ? "opacity-60" : ""
        }`}
        style={{ borderLeftColor: calendar.color, borderLeftWidth: 4 }}
      >
        <div className="flex items-start sm:items-center gap-3 flex-1 min-w-0">
          {/* Calendar info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 mb-1">
              <div className="font-semibold flex items-center gap-2">
                <div
                  className="w-1 h-4 rounded-full"
                  style={{ backgroundColor: calendar.color }}
                />
                <span className="truncate">{calendar.name}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5 sm:ml-1">
                {isReadOnly ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Eye className="h-3 w-3" />
                    <span>{t("guest.guestPermissionRead")}</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="default"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Edit className="h-3 w-3" />
                    <span>{t("guest.guestPermissionWrite")}</span>
                  </Badge>
                )}
                {calendar.isSubscribed && !calendar.isDismissed && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Check className="h-3 w-3" />
                    <span>{t("calendar.subscribed")}</span>
                  </Badge>
                )}
                {calendar.isDismissed && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-xs"
                  >
                    <EyeOff className="h-3 w-3" />
                    <span>{t("calendar.hidden")}</span>
                  </Badge>
                )}
              </div>
            </div>
            {calendar.owner && (
              <p className="text-sm text-muted-foreground truncate">
                {calendar.owner.name}
              </p>
            )}
          </div>
        </div>

        {/* Toggle switch */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center justify-end sm:justify-start gap-2 sm:pl-0">
                <span className="text-sm text-muted-foreground sm:hidden">
                  {calendar.isSubscribed
                    ? t("calendar.subscribed")
                    : t("calendar.subscribe")}
                </span>
                <Switch
                  checked={calendar.isSubscribed}
                  onCheckedChange={() =>
                    handleToggleSubscription(calendar, calendar.isSubscribed)
                  }
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              {calendar.isSubscribed
                ? t("calendar.unsubscribeTooltip")
                : t("calendar.subscribeTooltip")}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            <Users className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{t("calendar.browseCalendars")}</span>
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("calendar.browseCalendarsDescription")}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0 p-6 space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-y-auto space-y-3">
              {filteredCalendars.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    {searchQuery
                      ? t("common.noResults")
                      : t("calendar.noPublicCalendars")}
                  </p>
                </div>
              ) : (
                filteredCalendars.map((calendar) =>
                  renderCalendarCard(calendar)
                )
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
