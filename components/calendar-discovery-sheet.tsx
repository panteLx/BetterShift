"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EyeOff, Globe, Loader2, Search, UserPlus, type LucideIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PanelBody, PanelDialog } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { ListRow, Pill, inputClass } from "@/components/form-kit";
import {
  useCalendarSubscriptions,
  type AvailableCalendar,
  type DismissedCalendar,
} from "@/hooks/useCalendarSubscriptions";
import { cn } from "@/lib/utils";

type CalendarDiscoverySheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type DiscoveryTab = "shared" | "public" | "hidden";

export function CalendarDiscoverySheet({
  open,
  onOpenChange,
}: CalendarDiscoverySheetProps) {
  const t = useTranslations();
  const [searchQuery, setSearchQuery] = useState("");
  const [tab, setTab] = useState<DiscoveryTab>("shared");
  const {
    availableCalendars,
    dismissedCalendars,
    loading,
    subscribe,
    dismiss,
  } = useCalendarSubscriptions();

  const sharedCalendars = availableCalendars.filter((cal) => cal.source === "shared");
  const publicCalendars = availableCalendars.filter((cal) => cal.source === "guest");

  const matchesSearch = (cal: { name: string }) =>
    cal.name.toLowerCase().includes(searchQuery.toLowerCase());

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

  const permissionPill = (permission: string | undefined) => {
    if (permission === "owner" || permission === "admin") {
      return (
        <Pill tone="brand">
          {permission === "owner"
            ? t("sharingSheet.owner")
            : t("common.labels.permissions.admin")}
        </Pill>
      );
    }
    if (permission === "write") {
      return <Pill tone="warning">{t("sharingSheet.permWrite")}</Pill>;
    }
    return <Pill>{t("sharingSheet.permRead")}</Pill>;
  };

  const renderRow = ({
    calendar,
    pills,
    action,
    muted,
  }: {
    calendar: AvailableCalendar | DismissedCalendar;
    pills: React.ReactNode;
    action: React.ReactNode;
    muted?: boolean;
  }) => (
    <ListRow key={calendar.id}>
      <span
        className={cn("shift-rail size-2.5 shrink-0 rounded-full", muted && "opacity-50")}
        style={{ "--shift": calendar.color } as React.CSSProperties}
      />
      <div className="min-w-0 flex-1">
        <div
          className={cn(
            "truncate text-[14px] font-semibold",
            muted ? "text-fg-secondary" : "text-fg-strong"
          )}
        >
          {calendar.name}
        </div>
        <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
          {pills}
          {calendar.owner && (
            <span className="truncate text-[12px] text-fg-tertiary">
              {calendar.owner.name}
            </span>
          )}
        </div>
      </div>
      {action}
    </ListRow>
  );

  // Shared calendars carry the share permission, public ones the guest permission
  const renderAvailable = (calendar: AvailableCalendar) =>
    renderRow({
      calendar,
      pills: permissionPill(
        calendar.source === "shared" && calendar.permission
          ? calendar.permission
          : calendar.guestPermission
      ),
      action: (
        <Button
          size="sm"
          variant={calendar.isSubscribed ? "outline" : "default"}
          title={
            calendar.isSubscribed
              ? t("calendar.unsubscribeTooltip")
              : t("calendar.subscribeTooltip")
          }
          onClick={() => handleToggleSubscription(calendar, calendar.isSubscribed)}
          className="h-8 shrink-0 rounded-lg px-3 text-[12.5px] font-semibold"
        >
          {calendar.isSubscribed ? t("discovery.unsubscribe") : t("calendar.subscribe")}
        </Button>
      ),
    });

  const renderDismissed = (calendar: DismissedCalendar) =>
    renderRow({
      calendar,
      muted: true,
      pills: (
        <>
          {calendar.source === "shared" ? (
            <Pill>{t("share.sharedWithYou")}</Pill>
          ) : (
            <Pill>{t("calendar.publicBadge")}</Pill>
          )}
          {permissionPill(calendar.permission)}
        </>
      ),
      action: (
        <Button
          size="sm"
          variant="outline"
          title={t("calendar.subscribeTooltip")}
          onClick={() => handleShowAgain(calendar)}
          className="h-8 shrink-0 rounded-lg px-3 text-[12.5px] font-semibold"
        >
          {t("calendar.showAgain")}
        </Button>
      ),
    });

  const emptyState = (Icon: LucideIcon, message: string) => (
    <div className="flex flex-col items-center justify-center gap-2.5 py-12 text-center">
      <Icon className="size-6 text-fg-faint" />
      <p className="text-[13px] text-fg-tertiary">
        {searchQuery ? t("common.noResults") : message}
      </p>
    </div>
  );

  const count = (n: number) =>
    n > 0 ? <span className="font-mono text-[11.5px] font-medium text-fg-tertiary">{n}</span> : null;

  const visibleShared = sharedCalendars.filter(matchesSearch);
  const visiblePublic = publicCalendars.filter(matchesSearch);
  const visibleDismissed = dismissedCalendars.filter(matchesSearch);

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("calendar.browseCalendars")}
      description={t("calendar.browseCalendarsDescription")}
      width="md"
      bare
    >
      <div className="flex shrink-0 flex-col gap-3 border-b border-line px-[22px] py-3.5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-tertiary" />
          <Input
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t("common.search")}
            className={cn(inputClass, "pl-9")}
          />
        </div>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          label={t("calendar.browseCalendars")}
          options={[
            { value: "shared", label: t("calendar.sharedTab"), badge: count(sharedCalendars.length) },
            { value: "public", label: t("calendar.publicTab"), badge: count(publicCalendars.length) },
            { value: "hidden", label: t("calendar.hiddenTab"), badge: count(dismissedCalendars.length) },
          ]}
        />
      </div>
      <PanelBody className="min-h-[260px]">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-fg-tertiary" />
          </div>
        ) : tab === "shared" ? (
          visibleShared.length === 0 ? (
            emptyState(UserPlus, t("calendar.noSharedCalendars"))
          ) : (
            <div className="flex flex-col gap-2">{visibleShared.map(renderAvailable)}</div>
          )
        ) : tab === "public" ? (
          visiblePublic.length === 0 ? (
            emptyState(Globe, t("calendar.noPublicCalendars"))
          ) : (
            <div className="flex flex-col gap-2">{visiblePublic.map(renderAvailable)}</div>
          )
        ) : visibleDismissed.length === 0 ? (
          emptyState(EyeOff, t("calendar.noHiddenCalendars"))
        ) : (
          <div className="flex flex-col gap-2">{visibleDismissed.map(renderDismissed)}</div>
        )}
      </PanelBody>
    </PanelDialog>
  );
}
