"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, format, subMonths } from "date-fns";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings,
} from "lucide-react";
import { CalendarWithCount } from "@/lib/types";
import { CalendarSwitcher } from "@/components/calendar-switcher";
import { GuestMenu, UserMenu } from "@/components/user-menu";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  calendars: CalendarWithCount[];
  selectedCalendar: string | undefined;
  currentDate: Date;
  hasSyncErrors?: boolean;
  onDateChange: (date: Date) => void;
  onSelectCalendar: (id: string) => void;
  onCreateCalendar: () => void;
  onSettings: () => void;
  onSyncNotifications: () => void;
  onCompare?: () => void;
  onViewSettings?: () => void;
}

export function HeaderIconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "relative flex size-9 shrink-0 items-center justify-center rounded-lg border border-line text-fg-secondary transition-colors hover:bg-surface-panel lg:size-8",
        className
      )}
    >
      {children}
    </button>
  );
}

export function MonthStepper({
  currentDate,
  onDateChange,
  className,
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  className?: string;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const stepClass =
    "flex size-[30px] items-center justify-center rounded-[7px] border border-line text-fg-secondary transition-colors hover:bg-surface-panel";

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <button
        type="button"
        className={stepClass}
        onClick={() => onDateChange(subMonths(currentDate, 1))}
        aria-label={t("calendarView.previousMonth")}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-[150px] text-center text-[15px] font-semibold text-fg-strong">
        {format(currentDate, "LLLL yyyy", { locale: getDateLocale(locale) })}
      </span>
      <button
        type="button"
        className={stepClass}
        onClick={() => onDateChange(addMonths(currentDate, 1))}
        aria-label={t("calendarView.nextMonth")}
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}

export function AppHeader({
  calendars,
  selectedCalendar,
  currentDate,
  hasSyncErrors = false,
  onDateChange,
  onSelectCalendar,
  onCreateCalendar,
  onSettings,
  onSyncNotifications,
  onCompare,
  onViewSettings,
}: AppHeaderProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { isGuest } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const { versionInfo } = useVersionUpdateCheck();
  const selected = calendars.find((c) => c.id === selectedCalendar);
  const { canManage } = useCalendarPermission(selected);
  const [showChangelog, setShowChangelog] = useState(false);

  const signedIn = isAuthEnabled && !isGuest;
  const showUpdate = versionInfo?.hasUpdate && !versionInfo.isDev;

  const actions = (
    <>
      {selectedCalendar && (
        <HeaderIconButton
          label={
            hasSyncErrors
              ? t("syncNotifications.hasErrors")
              : t("syncNotifications.title")
          }
          onClick={onSyncNotifications}
          className="hidden lg:flex"
        >
          <Bell className="size-4" />
          {hasSyncErrors && (
            <span className="absolute -right-[3px] -top-[3px] size-2 rounded-full border-[1.5px] border-background bg-destructive" />
          )}
        </HeaderIconButton>
      )}
      {selectedCalendar && canManage && (
        <HeaderIconButton
          label={t("calendar.settings", { name: selected?.name ?? "" })}
          onClick={onSettings}
        >
          <Settings className="size-4" />
        </HeaderIconButton>
      )}
      {signedIn ? (
        <UserMenu onOpenViewSettings={onViewSettings} />
      ) : (
        <GuestMenu showLogin={isAuthEnabled} onOpenViewSettings={onViewSettings} />
      )}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-background">
        {/* Desktop */}
        <div className="hidden h-14 items-center gap-3 px-[18px] lg:flex">
          <Link
            href="/"
            aria-label={t("app.title")}
            className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-brand"
          >
            <CalendarDays className="size-[15px] text-white" />
          </Link>
          <CalendarSwitcher
            calendars={calendars}
            selectedId={selectedCalendar}
            onSelect={onSelectCalendar}
            onCreateNew={onCreateCalendar}
            onCompare={onCompare}
          />
          <div className="h-6 w-px bg-line" />
          <MonthStepper currentDate={currentDate} onDateChange={onDateChange} />
          <div className="flex-1" />
          {showUpdate && (
            <button
              type="button"
              onClick={() => setShowChangelog(true)}
              className="flex h-8 items-center gap-2 rounded-full bg-brand-soft px-3 text-[12.5px] font-semibold text-brand-ink transition-colors hover:bg-brand-soft/70"
            >
              <span className="size-1.5 rounded-full bg-brand-dot" />
              {t("update.newVersion", {
                version: versionInfo?.latestVersion || "",
              })}
            </button>
          )}
          {actions}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 lg:hidden">
          <div className="min-w-0 flex-1">
            <CalendarSwitcher
              size="mobile"
              calendars={calendars}
              selectedId={selectedCalendar}
              onSelect={onSelectCalendar}
              onCreateNew={onCreateCalendar}
              onCompare={onCompare}
            />
          </div>
          {selectedCalendar && hasSyncErrors && (
            <HeaderIconButton
              label={t("syncNotifications.hasErrors")}
              onClick={onSyncNotifications}
            >
              <Bell className="size-4" />
              <span className="absolute -right-[3px] -top-[3px] size-2 rounded-full border-[1.5px] border-background bg-destructive" />
            </HeaderIconButton>
          )}
          {actions}
        </div>
        {showUpdate && (
          <button
            type="button"
            onClick={() => setShowChangelog(true)}
            className="flex w-full items-center gap-2 border-t border-line bg-brand-soft px-4 py-2 text-left text-[12.5px] font-semibold text-brand-ink lg:hidden"
          >
            <span className="size-1.5 rounded-full bg-brand-dot" />
            {t("update.newVersion", { version: versionInfo?.latestVersion || "" })}
          </button>
        )}
      </header>

      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        locale={locale}
      />
    </>
  );
}
