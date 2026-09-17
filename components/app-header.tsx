"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { addMonths, addWeeks, getISOWeek } from "date-fns";
import {
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Settings,
  TriangleAlert,
  X,
} from "lucide-react";
import { CalendarWithCount } from "@/lib/types";
import { CalendarSwitcher } from "@/components/calendar-switcher";
import { GuestMenu, UserMenu } from "@/components/user-menu";
import { InfoDialog } from "@/components/info-dialog";
import { ViewModeSwitcher } from "@/components/view-mode-switcher";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import { CalendarViewMode } from "@/hooks/useCalendarViewMode";
import { formatPeriodCaption, PeriodStep } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  calendars: CalendarWithCount[];
  selectedCalendar: string | undefined;
  currentDate: Date;
  hasSyncErrors?: boolean;
  /** Gated on the manageExternalSync capability — hidden for anyone without it */
  canManageSync?: boolean;
  onDateChange: (date: Date) => void;
  onSelectCalendar: (id: string) => void;
  onCreateCalendar: () => void;
  onSettings: () => void;
  onSyncNotifications: () => void;
  onCompare?: () => void;
  onViewSettings?: () => void;
  /** Absent in contexts without view modes; the switcher is then not rendered */
  viewMode?: CalendarViewMode;
  onViewModeChange?: (mode: CalendarViewMode) => void;
}

export function stepDate(date: Date, step: PeriodStep, direction: 1 | -1): Date {
  return step === "week" ? addWeeks(date, direction) : addMonths(date, direction);
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

/** The phone month arrows: one bordered group, used by both workspaces. */
export function MonthArrows({
  currentDate,
  onDateChange,
  step = "month",
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  step?: PeriodStep;
}) {
  const t = useTranslations();
  const stepClass =
    "flex size-9 items-center justify-center text-fg-secondary transition-colors hover:bg-surface-panel";

  return (
    <div className="flex overflow-hidden rounded-[9px] border border-line">
      <button
        type="button"
        className={stepClass}
        onClick={() => onDateChange(stepDate(currentDate, step, -1))}
        aria-label={step === "week" ? t("calendarView.previousWeek") : t("calendarView.previousMonth")}
      >
        <ChevronLeft className="size-[18px]" />
      </button>
      <span className="w-px bg-line" />
      <button
        type="button"
        className={stepClass}
        onClick={() => onDateChange(stepDate(currentDate, step, 1))}
        aria-label={step === "week" ? t("calendarView.nextWeek") : t("calendarView.nextMonth")}
      >
        <ChevronRight className="size-[18px]" />
      </button>
    </div>
  );
}

/** The "new version available" pill (compact) or full-width banner (mobile), shared with auth-header. */
export function UpdatePill({
  version,
  variant = "pill",
  onShowChangelog,
  onDismiss,
  className,
}: {
  version: string;
  variant?: "pill" | "banner";
  onShowChangelog: () => void;
  onDismiss: () => void;
  className?: string;
}) {
  const t = useTranslations();
  const isBanner = variant === "banner";

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full bg-brand-soft text-[12.5px] font-semibold text-brand-ink",
        isBanner
          ? "w-full gap-2 rounded-none border-t border-line py-2 pl-4 pr-2"
          : "h-8 pl-3 pr-1",
        className
      )}
    >
      <button
        type="button"
        onClick={onShowChangelog}
        className={cn(
          "flex items-center gap-2 transition-colors hover:opacity-80",
          isBanner && "flex-1 text-left"
        )}
      >
        <span className="size-1.5 rounded-full bg-brand-dot" />
        {t("update.newVersion", { version })}
      </button>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("update.dismiss")}
        className={cn(
          "flex items-center justify-center rounded-full transition-colors hover:bg-brand-soft/70",
          isBanner ? "size-7 shrink-0" : "size-6"
        )}
      >
        <X className={isBanner ? "size-4" : "size-3.5"} />
      </button>
    </div>
  );
}

export function MonthStepper({
  currentDate,
  onDateChange,
  className,
  step = "month",
}: {
  currentDate: Date;
  onDateChange: (date: Date) => void;
  className?: string;
  step?: PeriodStep;
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
        onClick={() => onDateChange(stepDate(currentDate, step, -1))}
        aria-label={step === "week" ? t("calendarView.previousWeek") : t("calendarView.previousMonth")}
      >
        <ChevronLeft className="size-4" />
      </button>
      <span
        className={cn(
          "text-center text-[15px] font-semibold text-fg-strong",
          step === "week" ? "min-w-[232px]" : "min-w-[150px]"
        )}
      >
        {formatPeriodCaption(currentDate, step, locale)}
        {step === "week" && (
          <span className="ml-2 font-mono text-[12px] font-medium text-fg-tertiary">
            {t("calendarView.calendarWeek", { week: getISOWeek(currentDate) })}
          </span>
        )}
      </span>
      <button
        type="button"
        className={stepClass}
        onClick={() => onDateChange(stepDate(currentDate, step, 1))}
        aria-label={step === "week" ? t("calendarView.nextWeek") : t("calendarView.nextMonth")}
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
  canManageSync = false,
  onDateChange,
  onSelectCalendar,
  onCreateCalendar,
  onSettings,
  onSyncNotifications,
  onCompare,
  onViewSettings,
  viewMode,
  onViewModeChange,
}: AppHeaderProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { isGuest } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const { versionInfo, showUpdate, dismissUpdate } = useVersionUpdateCheck();
  const [showChangelog, setShowChangelog] = useState(false);

  const signedIn = isAuthEnabled && !isGuest;

  const brand = (
    <Link
      href="/"
      aria-label={t("app.title")}
      className="flex size-[26px] shrink-0 items-center justify-center rounded-[7px] bg-brand"
    >
      <CalendarDays className="size-[15px] text-white" />
    </Link>
  );

  const actions = (
    <>
      {selectedCalendar && canManageSync && (
        <HeaderIconButton
          label={
            hasSyncErrors
              ? t("syncNotifications.hasErrors")
              : t("syncNotifications.title")
          }
          onClick={onSyncNotifications}
          className={
            hasSyncErrors
              ? "border-danger-line bg-danger-soft text-danger hover:bg-danger-soft"
              : undefined
          }
        >
          {hasSyncErrors ? (
            <TriangleAlert className="size-[17px]" />
          ) : (
            <Bell className="size-4" />
          )}
          {hasSyncErrors && (
            <span className="absolute -right-1 -top-1 flex size-[15px] items-center justify-center rounded-full border-2 border-background bg-danger text-[10px] font-bold leading-none text-background">
              !
            </span>
          )}
        </HeaderIconButton>
      )}
      {selectedCalendar && (
        <HeaderIconButton
          label={t("settings.title")}
          onClick={onSettings}
          className="hidden lg:flex"
        >
          <Settings className="size-4" />
        </HeaderIconButton>
      )}
      {/* On phones the menu button is the gear and opens the settings sheet with the calendar group */}
      {signedIn ? (
        <UserMenu onOpenViewSettings={onViewSettings} onOpenPhoneMenu={onSettings} />
      ) : (
        <GuestMenu
          showLogin={isAuthEnabled}
          // The guest banner right below already offers the login on phones
          loginOnPhone={false}
          onOpenViewSettings={onViewSettings}
          onOpenPhoneMenu={onSettings}
        />
      )}
    </>
  );

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-line bg-background">
        {/* Desktop */}
        <div className="hidden h-14 items-center gap-3 px-[18px] lg:flex">
          {brand}
          <CalendarSwitcher
            calendars={calendars}
            selectedId={selectedCalendar}
            onSelect={onSelectCalendar}
            onCreateNew={onCreateCalendar}
            onCompare={onCompare}
          />
          <div className="h-6 w-px bg-line" />
          <MonthStepper
            currentDate={currentDate}
            onDateChange={onDateChange}
            step={viewMode === "week" ? "week" : "month"}
          />
          {viewMode && onViewModeChange && (
            <ViewModeSwitcher value={viewMode} onChange={onViewModeChange} variant="text" />
          )}
          <div className="flex-1" />
          {showUpdate && (
            <UpdatePill
              version={versionInfo?.latestVersion || ""}
              onShowChangelog={() => setShowChangelog(true)}
              onDismiss={dismissUpdate}
            />
          )}
          {actions}
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2.5 px-4 py-2.5 lg:hidden">
          {brand}
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
          {actions}
        </div>
        {showUpdate && (
          <UpdatePill
            version={versionInfo?.latestVersion || ""}
            variant="banner"
            onShowChangelog={() => setShowChangelog(true)}
            onDismiss={dismissUpdate}
            className="lg:hidden"
          />
        )}
      </header>

      <InfoDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        locale={locale}
        defaultTab="changelog"
      />
    </>
  );
}
