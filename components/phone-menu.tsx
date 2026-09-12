"use client";

import { ReactNode, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  ChevronRight,
  Compass,
  FileText,
  Languages,
  Loader2,
  LogIn,
  LogOut,
  ScrollText,
  Shield,
  SlidersHorizontal,
  SunMoon,
  User,
  type LucideIcon,
} from "lucide-react";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog } from "@/components/panel-dialog";
import { AppearancePicker, useThemeOptions } from "@/components/appearance-picker";
import { PersonalViewPanel, ViewSettingsState } from "@/components/view-settings-sheet";
import {
  CalendarSettingsPanel,
  SettingsItem,
  SettingsSection,
  useCalendarSettings,
} from "@/components/settings-dialog";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { CalendarDiscoverySheet } from "@/components/calendar-discovery-sheet";
import { setLocaleCookie } from "@/components/app-preferences-menu-items";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { useIsAdmin } from "@/hooks/useAdminAccess";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { useViewSettings } from "@/hooks/useViewSettings";
import { useSignOut } from "@/hooks/useSignOut";
import { locales } from "@/lib/locales";
import { CalendarWithCount } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useGuardedAction } from "@/hooks/useDirtyState";

type MenuSection = SettingsSection | "myView" | "appearance" | "language";

/** What the calendar page hands in: the selected calendar and the page's view state. */
export interface PhoneMenuCalendarContext {
  calendarId: string | null;
  viewSettings: ViewSettingsState;
  onDeleteCalendar: () => void;
  onSyncComplete: () => void;
}

interface PhoneMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Calendar page only; elsewhere the sheet shows just the personal and account groups */
  context?: PhoneMenuCalendarContext;
}

interface CalendarGroup extends Omit<PhoneMenuCalendarContext, "calendarId"> {
  calendarId: string;
  calendar: CalendarWithCount;
  items: SettingsItem[];
}

/** Phones: calendar settings, personal preferences and account in one sheet behind the avatar. */
export function PhoneMenu({ context, ...props }: PhoneMenuProps) {
  if (context?.calendarId) {
    return <CalendarPhoneMenu {...props} context={context} calendarId={context.calendarId} />;
  }
  return <PhoneMenuSheet {...props} viewSettings={context?.viewSettings} />;
}

// Calendar hooks live here so pages without a calendar never fetch calendar data
function CalendarPhoneMenu({
  context,
  calendarId,
  ...props
}: Omit<PhoneMenuProps, "context"> & { context: PhoneMenuCalendarContext; calendarId: string }) {
  const { calendar, items } = useCalendarSettings(calendarId);
  return (
    <PhoneMenuSheet
      {...props}
      viewSettings={context.viewSettings}
      calendarGroup={calendar ? { ...context, calendarId, calendar, items } : undefined}
    />
  );
}

function LanguagePanel() {
  const t = useTranslations();
  const current = useLocale();
  return (
    <PanelBody>
      <div className="flex flex-col gap-2">
        {locales.map((locale) => (
          <button
            key={locale}
            type="button"
            onClick={() => locale !== current && setLocaleCookie(locale)}
            className={cn(
              "flex items-center justify-between rounded-[10px] border-[1.5px] px-3 py-3 text-left text-[14px] font-semibold",
              locale === current
                ? "border-brand bg-surface-today text-brand-ink"
                : "border-line bg-surface-card text-fg-strong"
            )}
          >
            {t(`language.${locale}`)}
            <span className="font-mono text-[12px] uppercase text-fg-tertiary">{locale}</span>
          </button>
        ))}
      </div>
    </PanelBody>
  );
}

/** Pages without the calendar page's view state load it only when the section opens. */
function StandalonePersonalViewPanel() {
  const settings = useViewSettings();
  if (settings.loading) {
    return (
      <PanelBody>
        <div className="flex justify-center py-10 text-fg-tertiary">
          <Loader2 className="size-5 animate-spin" />
        </div>
      </PanelBody>
    );
  }
  return <PersonalViewPanel settings={settings} />;
}

function MenuGroup({
  label,
  caption,
  children,
}: {
  label: ReactNode;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 px-1">
        <div className="eyebrow flex min-w-0 items-center gap-2">{label}</div>
        {caption && <p className="mt-0.5 text-[12px] text-fg-tertiary">{caption}</p>}
      </div>
      <div className="divide-y divide-line-subtle overflow-hidden rounded-[12px] border border-line bg-surface-card">
        {children}
      </div>
    </section>
  );
}

function MenuRow({
  icon: Icon,
  title,
  meta,
  mono = false,
  metaTone,
  danger = false,
  onClick,
}: {
  icon: LucideIcon;
  title: string;
  meta?: ReactNode;
  mono?: boolean;
  metaTone?: "danger";
  /** Destructive action: danger colour, no chevron */
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-11 w-full items-center gap-3 px-3.5 py-3 text-left"
    >
      <Icon className={cn("size-[18px] shrink-0", danger ? "text-danger" : "text-fg-secondary")} />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[14.5px]",
          danger ? "font-medium text-danger" : "text-fg-strong"
        )}
      >
        {title}
      </span>
      {meta !== undefined && meta !== null && (
        <span
          className={cn(
            "shrink-0",
            mono ? "font-mono text-[12.5px]" : "text-[13px]",
            metaTone === "danger" ? "font-semibold text-danger" : "text-fg-tertiary"
          )}
        >
          {meta}
        </span>
      )}
      {!danger && <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />}
    </button>
  );
}

function AppVersion() {
  return useVersionInfo()?.version ?? null;
}

function PhoneMenuSheet({
  open,
  onOpenChange,
  viewSettings,
  calendarGroup,
}: Omit<PhoneMenuProps, "context"> & {
  viewSettings?: ViewSettingsState;
  calendarGroup?: CalendarGroup;
}) {
  const t = useTranslations();
  const handleSignOut = useSignOut();
  const locale = useLocale();
  const router = useRouter();
  const { theme } = useTheme();
  const themeOptions = useThemeOptions();
  const { user, isGuest } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const isAdmin = useIsAdmin();
  const [section, setSection] = useState<MenuSection | null>(null);
  const [dirty, setDirty] = useState(false);

  const [changelogOpen, setChangelogOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  // Every open starts at the list, however the sheet was closed last time
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSection(null);
      setDirty(false);
    }
  }

  const signedIn = isAuthEnabled && !!user && !isGuest;

  const close = () => {
    setDirty(false);
    onOpenChange(false);
  };
  // Sections with unsaved input report it; leaving them asks first
  const { guarded, confirmProps } = useGuardedAction(dirty, () => setDirty(false));
  const openSection = (id: MenuSection | null) =>
    guarded(() => {
      setDirty(false);
      setSection(id);
    });
  const navigate = (href: string) => {
    close();
    router.push(href);
  };

  const calendarItem = calendarGroup?.items.find((item) => item.id === section);
  let title = t("settings.title");
  let description: string | undefined;
  let panel: ReactNode = null;
  if (section === "myView") {
    title = t("view.settingsTitle");
    description =
      isAuthEnabled && user ? t("view.settingsDescription") : t("view.settingsDescriptionLocal");
    panel = viewSettings ? (
      <PersonalViewPanel settings={viewSettings} calendarId={calendarGroup?.calendarId} />
    ) : (
      <StandalonePersonalViewPanel />
    );
  } else if (section === "appearance") {
    title = t("appearance.title");
    panel = (
      <PanelBody>
        <AppearancePicker />
      </PanelBody>
    );
  } else if (section === "language") {
    title = t("appMenu.language");
    panel = <LanguagePanel />;
  } else if (calendarGroup && calendarItem) {
    title = calendarItem.title;
    description = calendarItem.description;
    panel = (
      <CalendarSettingsPanel
        section={calendarItem.id}
        calendarId={calendarGroup.calendarId}
        viewSettings={calendarGroup.viewSettings}
        onClose={close}
        onCancel={() => guarded(close)}
        onDirtyChange={setDirty}
        onDeleteCalendar={calendarGroup.onDeleteCalendar}
        onSyncComplete={calendarGroup.onSyncComplete}
      />
    );
  }
  const inSection = panel !== null;

  const themeTitle = (themeOptions.find((o) => o.value === theme) ?? themeOptions[0]).title;
  const changelogRow = (
    <MenuRow
      icon={ScrollText}
      title={t("changelog.title")}
      meta={<AppVersion />}
      mono
      onClick={() => setChangelogOpen(true)}
    />
  );

  return (
    <>
      <PanelDialog
        bare
        open={open}
        onOpenChange={(next) => (next ? onOpenChange(true) : guarded(close))}
        headerLeading={
          inSection ? (
            <button
              type="button"
              onClick={() => openSection(null)}
              aria-label={t("common.previous")}
              className="-ml-1 flex size-[34px] shrink-0 items-center justify-center rounded-lg text-fg-secondary"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : undefined
        }
        title={title}
        description={description}
      >
        {inSection ? (
          <div key={section} className="flex min-h-0 flex-1 flex-col">
            {panel}
          </div>
        ) : (
          <PanelBody className="bg-surface-panel px-4">
            <div className="flex flex-col gap-5">
              {calendarGroup && calendarGroup.items.length > 0 && (
                <MenuGroup
                  label={
                    <>
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: calendarGroup.calendar.color }}
                      />
                      <span className="truncate">{calendarGroup.calendar.name}</span>
                    </>
                  }
                  caption={t("settings.description")}
                >
                  {calendarGroup.items.map((item) => (
                    <MenuRow
                      key={item.id}
                      icon={item.icon}
                      title={item.title}
                      meta={item.meta}
                      mono={typeof item.meta === "number"}
                      metaTone={item.metaTone}
                      onClick={() => openSection(item.id)}
                    />
                  ))}
                </MenuGroup>
              )}
              <MenuGroup label={t("settings.groupPersonal")} caption={t("settings.personalCaption")}>
                <MenuRow
                  icon={SlidersHorizontal}
                  title={t("appMenu.viewSettings")}
                  onClick={() => openSection("myView")}
                />
                <MenuRow
                  icon={SunMoon}
                  title={t("appearance.title")}
                  meta={themeTitle}
                  onClick={() => openSection("appearance")}
                />
                <MenuRow
                  icon={Languages}
                  title={t("appMenu.language")}
                  meta={t(`language.${locale}`)}
                  onClick={() => openSection("language")}
                />
              </MenuGroup>
              {signedIn ? (
                <MenuGroup
                  label={
                    <>
                      <span className="shrink-0">{t("settings.groupAccount")}</span>
                      <span aria-hidden className="shrink-0">·</span>
                      <span className="truncate font-normal normal-case tracking-normal">
                        {user.email}
                      </span>
                    </>
                  }
                >
                  <MenuRow icon={User} title={t("auth.profile")} onClick={() => navigate("/profile")} />
                  <MenuRow
                    icon={FileText}
                    title={t("activityLog.title")}
                    onClick={() => navigate("/profile?section=activity")}
                  />
                  <MenuRow
                    icon={Compass}
                    title={t("calendar.browseCalendars")}
                    onClick={() => setDiscoveryOpen(true)}
                  />
                  {isAdmin && (
                    <MenuRow icon={Shield} title={t("admin.adminPanel")} onClick={() => navigate("/admin")} />
                  )}
                  {changelogRow}
                  <MenuRow icon={LogOut} title={t("auth.logout")} danger onClick={handleSignOut} />
                </MenuGroup>
              ) : (
                <MenuGroup label={t("settings.groupApp")}>
                  {changelogRow}
                  {isAuthEnabled && (
                    <MenuRow icon={LogIn} title={t("auth.login")} onClick={() => navigate("/login")} />
                  )}
                </MenuGroup>
              )}
            </div>
          </PanelBody>
        )}
      </PanelDialog>
      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} locale={locale} />
      {signedIn && <CalendarDiscoverySheet open={discoveryOpen} onOpenChange={setDiscoveryOpen} />}
      <ConfirmationDialog {...confirmProps} />
    </>
  );
}
