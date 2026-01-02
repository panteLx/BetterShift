"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCalendarSubscriptions,
  type AvailableCalendar,
  type DismissedCalendar,
} from "@/hooks/useCalendarSubscriptions";
import {
  Users,
  Search,
  Eye,
  Edit,
  EyeOff,
  Loader2,
  UserPlus,
  Globe,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

type CalendarDiscoverySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CalendarDiscoverySheet({
  open,
  onOpenChange,
}: CalendarDiscoverySheetProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    availableCalendars,
    dismissedCalendars,
    loading,
    subscribe,
    dismiss,
  } = useCalendarSubscriptions();

  // Separate calendars by source
  const sharedCalendars = availableCalendars.filter(
    (cal) => cal.source === "shared"
  );
  const publicCalendars = availableCalendars.filter(
    (cal) => cal.source === "guest"
  );

  // Filter search in all tabs
  const filterBySearch = (calendars: AvailableCalendar[]) =>
    calendars.filter((cal) =>
      cal.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

  // Filter dismissed calendars by search
  const filteredDismissed = dismissedCalendars.filter((cal) =>
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

  const handleShowAgain = async (calendar: DismissedCalendar) => {
    await subscribe(calendar.id, calendar.name);
  };

  const renderCalendarCard = (calendar: AvailableCalendar) => {
    // Use permission for shared calendars (owner/admin/write/read), guestPermission for public calendars
    const actualPermission =
      calendar.source === "shared" && calendar.permission
        ? calendar.permission
        : calendar.guestPermission;
    const isReadOnly = actualPermission === "read";
    const isAdmin =
      actualPermission === "admin" || actualPermission === "owner";

    return (
      <div
        key={calendar.id}
        className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all p-4"
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
              <div className="flex flex-wrap items-center gap-1.5">
                {isAdmin ? (
                  <Badge
                    variant="default"
                    className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700"
                  >
                    <Users className="h-3 w-3" />
                    <span>{t("common.labels.permissions.admin")}</span>
                  </Badge>
                ) : isReadOnly ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Eye className="h-3 w-3" />
                    <span>{t("common.labels.permissions.read")}</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="default"
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700"
                  >
                    <Edit className="h-3 w-3" />
                    <span>{t("common.labels.permissions.write")}</span>
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

  const renderDismissedCard = (calendar: DismissedCalendar) => {
    const isReadOnly = calendar.permission === "read";
    const isAdmin =
      calendar.permission === "admin" || calendar.permission === "owner";

    return (
      <div
        key={calendar.id}
        className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-all p-4 opacity-60"
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
              <div className="flex flex-wrap items-center gap-1.5">
                {calendar.source === "shared" && (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <UserPlus className="h-3 w-3" />
                    <span>{t("share.sharedWithYou")}</span>
                  </Badge>
                )}
                {calendar.source === "guest" && (
                  <Badge
                    variant="outline"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Globe className="h-3 w-3" />
                    <span>{t("calendar.publicBadge")}</span>
                  </Badge>
                )}
                {isAdmin ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Users className="h-3 w-3" />
                    <span>{t("common.labels.permissions.admin")}</span>
                  </Badge>
                ) : isReadOnly ? (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Eye className="h-3 w-3" />
                    <span>{t("common.labels.permissions.read")}</span>
                  </Badge>
                ) : (
                  <Badge
                    variant="secondary"
                    className="flex items-center gap-1 text-xs"
                  >
                    <Edit className="h-3 w-3" />
                    <span>{t("common.labels.permissions.write")}</span>
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
                  {t("calendar.showAgain")}
                </span>
                <Switch
                  checked={false}
                  onCheckedChange={() => handleShowAgain(calendar)}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>{t("calendar.subscribeTooltip")}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-2xl flex flex-col p-0 gap-0"
      >
        <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text flex items-center gap-2">
            <Users className="h-5 w-5 flex-shrink-0" />
            <span className="truncate">{t("calendar.browseCalendars")}</span>
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            {t("calendar.browseCalendarsDescription")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col flex-1 min-h-0 p-6 space-y-4 overflow-y-auto">
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
            <Tabs
              defaultValue="shared"
              className="flex-1 min-h-0 flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="shared" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  {t("calendar.sharedTab")}
                  {sharedCalendars.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {sharedCalendars.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="public" className="gap-2">
                  <Globe className="h-4 w-4" />
                  {t("calendar.publicTab")}
                  {publicCalendars.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {publicCalendars.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="hidden" className="gap-2">
                  <EyeOff className="h-4 w-4" />
                  {t("calendar.hiddenTab")}
                  {dismissedCalendars.length > 0 && (
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {dismissedCalendars.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent
                value="shared"
                className="flex-1 min-h-0 overflow-y-auto space-y-3 mt-4"
              >
                {filterBySearch(sharedCalendars).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <UserPlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? t("common.noResults")
                        : t("calendar.noSharedCalendars")}
                    </p>
                  </div>
                ) : (
                  filterBySearch(sharedCalendars).map((calendar) =>
                    renderCalendarCard(calendar)
                  )
                )}
              </TabsContent>

              <TabsContent
                value="public"
                className="flex-1 min-h-0 overflow-y-auto space-y-3 mt-4"
              >
                {filterBySearch(publicCalendars).length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Globe className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? t("common.noResults")
                        : t("calendar.noPublicCalendars")}
                    </p>
                  </div>
                ) : (
                  filterBySearch(publicCalendars).map((calendar) =>
                    renderCalendarCard(calendar)
                  )
                )}
              </TabsContent>

              <TabsContent
                value="hidden"
                className="flex-1 min-h-0 overflow-y-auto space-y-3 mt-4"
              >
                {filteredDismissed.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <EyeOff className="h-12 w-12 text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      {searchQuery
                        ? t("common.noResults")
                        : t("calendar.noHiddenCalendars")}
                    </p>
                  </div>
                ) : (
                  filteredDismissed.map((calendar) =>
                    renderDismissedCard(calendar)
                  )
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>

        <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="h-11 border-border/50 hover:bg-muted/50"
          >
            {t("common.cancel")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
