"use client";

import { ReactNode, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  ChevronRight,
  Compass,
  Download,
  FileText,
  Languages,
  Layers,
  Link2,
  LogOut,
  Palette,
  RefreshCw,
  ScrollText,
  SlidersHorizontal,
  SunMoon,
  TriangleAlert,
  User,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { ColorSwatches, DangerZone, Field, inputClass } from "@/components/form-kit";
import { AppearancePicker } from "@/components/appearance-picker";
import { ExportPanel } from "@/components/export-dialog";
import { ViewPanel, ViewSettingsState } from "@/components/view-settings-sheet";
import { PresetsPanel } from "@/components/preset-manage-sheet";
import { ExternalSyncPanel } from "@/components/external-sync-manage-sheet";
import { SyncNotificationsPanel } from "@/components/sync-notification-dialog";
import { SharingPanel } from "@/components/calendar-share-management-sheet";
import { AccessLinksPanel } from "@/components/calendar-token-list";
import { ChangelogDialog } from "@/components/changelog-dialog";
import { CalendarDiscoverySheet } from "@/components/calendar-discovery-sheet";
import { setLocaleCookie } from "@/components/app-preferences-menu-items";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { usePresets } from "@/hooks/usePresets";
import { useShifts } from "@/hooks/useShifts";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useCalendarTokens } from "@/hooks/useCalendarTokens";
import { useAuth } from "@/hooks/useAuth";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { DESKTOP_QUERY, useMediaQuery } from "@/hooks/useMediaQuery";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { signOut } from "@/lib/auth/client";
import { locales } from "@/lib/locales";
import { cn } from "@/lib/utils";

export type SettingsSection =
  | "general"
  | "presets"
  | "external"
  | "sharing"
  | "links"
  | "export"
  | "view"
  | "notifications"
  | "appearance"
  | "language";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  initialSection?: SettingsSection;
  viewSettings: ViewSettingsState;
  onDeleteCalendar: () => void;
  onSyncComplete: () => void;
}

interface SectionItem {
  id: SettingsSection;
  icon: LucideIcon;
  title: string;
  description?: string;
  value?: ReactNode;
}

function GeneralPanel({
  calendarId,
  onClose,
  onCancel,
  onDeleteCalendar,
  onDirtyChange,
}: {
  calendarId: string;
  onClose: () => void;
  onCancel: () => void;
  onDeleteCalendar: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = useTranslations();
  const { calendars, updateCalendar } = useCalendars();
  const { canDelete } = useCalendarPermission(calendarId);
  const { shifts } = useShifts(calendarId);
  const calendar = calendars.find((c) => c.id === calendarId);
  const [name, setName] = useState(calendar?.name ?? "");
  const [color, setColor] = useState(calendar?.color ?? "");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const dirty = !!calendar && (name !== calendar.name || color !== calendar.color);

  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const save = async () => {
    if (!calendar) return;
    setSaving(true);
    try {
      await updateCalendar(calendarId, {
        name: name !== calendar.name ? name.trim() : undefined,
        color: color !== calendar.color ? color : undefined,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PanelBody>
        <div className="flex flex-col gap-5">
          <Field label={t("common.labels.name")} htmlFor="calendar-name">
            <Input
              id="calendar-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("form.colorLabel")}>
            <ColorSwatches value={color} onChange={setColor} allowCustom />
          </Field>
          {canDelete && (
            <div className="border-t border-line pt-5">
              <DangerZone
                icon={TriangleAlert}
                title={t("calendar.deleteCalendar")}
                description={t("settings.deleteImpact", { count: shifts.length })}
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 border-danger-line bg-surface-card font-semibold text-danger hover:bg-danger-soft hover:text-danger"
                    onClick={() => setConfirmDelete(true)}
                  >
                    {t("common.delete")}
                  </Button>
                }
              />
            </div>
          )}
        </div>
      </PanelBody>
      <PanelFooter>
        <p className="hidden min-w-0 flex-1 text-[13px] text-fg-secondary lg:block">
          {t("settings.appliesToAll")}
        </p>
        <Button variant="outline" className="h-10 flex-1 font-semibold lg:flex-none lg:px-4" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button
          className="h-10 flex-1 font-semibold lg:flex-none lg:px-4"
          disabled={!dirty || !name.trim() || saving}
          onClick={save}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </PanelFooter>
      <ConfirmationDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("calendar.deleteCalendar")}
        description={t("calendar.deleteWarning")}
        confirmText={t("common.delete")}
        confirmVariant="destructive"
        onConfirm={() => {
          setConfirmDelete(false);
          onDeleteCalendar();
          onClose();
        }}
      />
    </>
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

export function SettingsDialog({
  open,
  onOpenChange,
  calendarId,
  initialSection,
  viewSettings,
  onDeleteCalendar,
  onSyncComplete,
}: SettingsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { theme } = useTheme();
  const desktop = useMediaQuery(DESKTOP_QUERY, true);
  const { calendars } = useCalendars();
  const calendar = calendars.find((c) => c.id === calendarId);
  const permission = useCalendarPermission(calendarId);
  const { presets } = usePresets(calendarId ?? undefined);
  const { externalSyncs, hasSyncErrors } = useExternalSync(
    permission.canManage ? calendarId : null
  );
  const { tokens } = useCalendarTokens(permission.canShare ? calendarId : null);
  const { user, isGuest } = useAuth();
  const { isAuthEnabled } = useAuthFeatures();
  const versionInfo = useVersionInfo();
  const [section, setSection] = useState<SettingsSection | null>(initialSection ?? null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [discoveryOpen, setDiscoveryOpen] = useState(false);

  const [dirty, setDirty] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const close = () => {
    setDirty(false);
    onOpenChange(false);
  };
  // Panels with unsaved input report it; leaving them asks first
  const guarded = (action: () => void) => {
    if (dirty) setPendingAction(() => action);
    else action();
  };
  const openSection = (id: SettingsSection | null) =>
    guarded(() => {
      setDirty(false);
      setSection(id);
    });
  const requestClose = (next: boolean) => {
    if (next) onOpenChange(true);
    else guarded(close);
  };
  const signedIn = isAuthEnabled && !!user && !isGuest;

  const calendarItems: SectionItem[] = calendar
    ? [
        ...(permission.canManage
          ? [
              {
                id: "general" as const,
                icon: Palette,
                title: t("settings.general"),
                description: t("settings.generalHint"),
              },
            ]
          : []),
        ...(permission.canEdit
          ? [
              {
                id: "presets" as const,
                icon: Layers,
                title: t("settings.presets"),
                description: t("settings.presetsHint", { count: presets.length }),
                value: presets.length,
              },
            ]
          : []),
        ...(permission.canManage
          ? [
              {
                id: "external" as const,
                icon: RefreshCw,
                title: t("settings.external"),
                description: t("settings.externalHint", { count: externalSyncs.length }),
                value: externalSyncs.length,
              },
            ]
          : []),
        ...(isAuthEnabled && permission.canShare
          ? [
              {
                id: "sharing" as const,
                icon: Users,
                title: t("settings.sharing"),
                description: t("settings.sharingHint"),
              },
              {
                id: "links" as const,
                icon: Link2,
                title: t("settings.links"),
                description: t("settings.linksHint", { count: tokens.length }),
                value: tokens.length,
              },
            ]
          : []),
        {
          id: "export" as const,
          icon: Download,
          title: t("settings.export"),
          description: t("settings.exportHint"),
          value: "ICS · PDF",
        },
      ]
    : [];

  const viewItems: SectionItem[] = [
    {
      id: "view",
      icon: SlidersHorizontal,
      title: t("settings.view"),
      description: t("settings.viewHint"),
    },
  ];
  const notificationItems: SectionItem[] = calendar
    ? [
        {
          id: "notifications",
          icon: Bell,
          title: t("settings.notifications"),
          description: hasSyncErrors ? t("settings.notificationsError") : t("settings.notificationsHint"),
          value: hasSyncErrors ? t("settings.notificationsError") : undefined,
        },
      ]
    : [];
  const appItems: SectionItem[] = [
    {
      id: "language",
      icon: Languages,
      title: t("appMenu.language"),
      value: t(`language.${locale}`),
    },
    {
      id: "appearance",
      icon: SunMoon,
      title: t("appearance.title"),
      value:
        theme === "light"
          ? t("appearance.light.title")
          : theme === "dark"
            ? t("appearance.dark.title")
            : t("appearance.system.title"),
    },
  ];

  const sidebarItems = [...calendarItems, ...viewItems, ...notificationItems];
  const active = section ?? (desktop ? sidebarItems[0]?.id : null);
  const activeItem = [...sidebarItems, ...appItems].find((i) => i.id === active);

  const renderPanel = (id: SettingsSection) => {
    if (id === "view") return <ViewPanel settings={viewSettings} />;
    if (id === "appearance")
      return (
        <PanelBody>
          <AppearancePicker />
        </PanelBody>
      );
    if (id === "language") return <LanguagePanel />;
    if (!calendarId) return null;
    switch (id) {
      case "general":
        return (
          <GeneralPanel
            key={calendarId}
            calendarId={calendarId}
            onClose={close}
            onCancel={() => requestClose(false)}
            onDeleteCalendar={onDeleteCalendar}
            onDirtyChange={setDirty}
          />
        );
      case "presets":
        return <PresetsPanel calendarId={calendarId} onClose={close} onDirtyChange={setDirty} />;
      case "external":
        return (
          <ExternalSyncPanel
            calendarId={calendarId}
            onClose={close}
            onSyncComplete={onSyncComplete}
            onDirtyChange={setDirty}
          />
        );
      case "sharing":
        return <SharingPanel calendarId={calendarId} onClose={close} />;
      case "links":
        return <AccessLinksPanel calendarId={calendarId} onClose={close} />;
      case "export":
        return <ExportPanel calendarId={calendarId} onClose={close} />;
      case "notifications":
        return <SyncNotificationsPanel calendarId={calendarId} onClose={close} />;
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(t("auth.logoutSuccess"));
          },
        },
      });
      router.replace("/login");
    } catch {
      toast.error(t("common.error"));
    }
  };

  const extras = (
    <>
      <ChangelogDialog open={changelogOpen} onOpenChange={setChangelogOpen} locale={locale} />
      <CalendarDiscoverySheet open={discoveryOpen} onOpenChange={setDiscoveryOpen} />
      <ConfirmationDialog
        open={!!pendingAction}
        onOpenChange={(next) => !next && setPendingAction(null)}
        onConfirm={() => {
          const action = pendingAction;
          setPendingAction(null);
          setDirty(false);
          action?.();
        }}
      />
    </>
  );

  if (desktop) {
    return (
      <>
        <PanelDialog
          bare
          open={open}
          onOpenChange={requestClose}
          width="xl"
          fixedHeight="min(640px, calc(100dvh - 48px))"
          title={
            <span className="flex items-center gap-2.5">
              {calendar && (
                <span className="size-2.5 rounded-full" style={{ backgroundColor: calendar.color }} />
              )}
              {calendar?.name ?? t("settings.title")}
            </span>
          }
          description={t("settings.description")}
        >
          <div className="flex min-h-0 flex-1">
            <nav className="flex w-[278px] shrink-0 flex-col gap-1 overflow-y-auto border-r border-line bg-surface-panel p-2.5">
              {sidebarItems.map((item) => {
                const selected = item.id === active;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSection(item.id)}
                    aria-current={selected ? "page" : undefined}
                    className={cn(
                      "flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      selected
                        ? "bg-brand-soft shadow-[inset_2px_0_0_var(--brand)]"
                        : "hover:bg-surface-sunken"
                    )}
                  >
                    <item.icon
                      className={cn("mt-0.5 size-4 shrink-0", selected ? "text-brand-ink" : "text-fg-secondary")}
                    />
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[13.5px] font-semibold",
                          selected ? "text-brand-ink" : "text-fg-body"
                        )}
                      >
                        {item.title}
                      </span>
                      {item.description && (
                        <span
                          className={cn(
                            "block text-[12px]",
                            selected ? "text-brand-ink/80" : "text-fg-tertiary"
                          )}
                        >
                          {item.description}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </nav>
            <div key={active} className="flex min-w-0 flex-1 flex-col">
              {active && renderPanel(active)}
            </div>
          </div>
        </PanelDialog>
        {extras}
      </>
    );
  }

  // Phones: a grouped list first, each entry opens its section as a second level
  const renderRow = (item: SectionItem, onClick?: () => void, key: string = item.id) => (
    <button
      key={key}
      type="button"
      onClick={onClick ?? (() => openSection(item.id))}
      className="flex w-full items-center gap-3 px-3.5 py-3 text-left"
    >
      <item.icon className="size-[18px] shrink-0 text-fg-secondary" />
      <span className="min-w-0 flex-1 truncate text-[14.5px] text-fg-strong">{item.title}</span>
      {item.value !== undefined && (
        <span className="shrink-0 font-mono text-[12.5px] text-fg-tertiary">{item.value}</span>
      )}
      <ChevronRight className="size-4 shrink-0 text-fg-tertiary" />
    </button>
  );
  const renderGroup = (label: string, children: ReactNode) => (
    <section key={label}>
      <div className="eyebrow mb-2 px-1">{label}</div>
      <div className="divide-y divide-line-subtle overflow-hidden rounded-[12px] border border-line bg-surface-card">
        {children}
      </div>
    </section>
  );

  const accountRows: { icon: LucideIcon; title: string; onClick: () => void }[] = signedIn
    ? [
        { icon: User, title: t("auth.profile"), onClick: () => router.push("/profile") },
        { icon: FileText, title: t("activityLog.title"), onClick: () => router.push("/profile/activity") },
        { icon: Compass, title: t("calendar.browseCalendars"), onClick: () => setDiscoveryOpen(true) },
        { icon: LogOut, title: t("auth.logout"), onClick: handleSignOut },
      ]
    : [];

  return (
    <>
      <PanelDialog
        bare
        open={open}
        onOpenChange={(next) => {
          if (next) return onOpenChange(true);
          guarded(() => {
            close();
            setSection(initialSection ?? null);
          });
        }}
        headerLeading={
          section ? (
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
        title={activeItem && section ? activeItem.title : t("settings.title")}
        description={section ? activeItem?.description : calendar?.name}
      >
        {section ? (
          <div key={section} className="flex min-h-0 flex-1 flex-col">
            {renderPanel(section)}
          </div>
        ) : (
          <PanelBody className="bg-surface-panel px-4">
            <div className="flex flex-col gap-5">
              {calendarItems.length > 0 &&
                renderGroup(
                  t("settings.groupCalendar"),
                  calendarItems.map((item) => renderRow(item))
                )}
              {renderGroup(
                t("settings.groupView"),
                viewItems.map((item) => renderRow(item))
              )}
              {notificationItems.length > 0 &&
                renderGroup(
                  t("settings.groupNotifications"),
                  notificationItems.map((item) => renderRow(item))
                )}
              {accountRows.length > 0 &&
                renderGroup(
                  t("settings.groupAccount"),
                  accountRows.map((row) =>
                    renderRow({ id: "view", icon: row.icon, title: row.title }, row.onClick, row.title)
                  )
                )}
              {renderGroup(t("settings.groupApp"), [
                ...appItems.map((item) => renderRow(item)),
                renderRow(
                  {
                    id: "view",
                    icon: ScrollText,
                    title: t("changelog.title"),
                    value: versionInfo?.version,
                  },
                  () => setChangelogOpen(true),
                  "changelog"
                ),
              ])}
            </div>
          </PanelBody>
        )}
      </PanelDialog>
      {extras}
    </>
  );
}
