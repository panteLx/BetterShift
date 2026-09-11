"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  Download,
  Layers,
  Palette,
  RefreshCw,
  SlidersHorizontal,
  TriangleAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { ColorSwatches, DangerZone, Field, inputClass } from "@/components/form-kit";
import { ExportPanel } from "@/components/export-dialog";
import { CalendarViewPanel, ViewSettingsState } from "@/components/view-settings-sheet";
import { PresetsPanel } from "@/components/preset-manage-sheet";
import { ExternalSyncPanel } from "@/components/external-sync-manage-sheet";
import { SyncNotificationsPanel } from "@/components/sync-notification-dialog";
import { SharingPanel } from "@/components/calendar-share-management-sheet";
import { isUsableToken } from "@/components/calendar-token-list";
import { useCalendars } from "@/hooks/useCalendars";
import { useCalendarPermission } from "@/hooks/useCalendarPermission";
import { usePresets } from "@/hooks/usePresets";
import { useShifts } from "@/hooks/useShifts";
import { useExternalSync } from "@/hooks/useExternalSync";
import { useCalendarTokens } from "@/hooks/useCalendarTokens";
import { useAuthFeatures } from "@/hooks/useAuthFeatures";
import { cn } from "@/lib/utils";
import { useGuardedAction, useReportDirty } from "@/hooks/useDirtyState";

export type SettingsSection =
  | "general"
  | "presets"
  | "external"
  | "sharing"
  | "export"
  | "view"
  | "notifications";

export interface SettingsItem {
  id: SettingsSection;
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Short value on the phone row */
  meta?: string | number;
  metaTone?: "danger";
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string | null;
  viewSettings: ViewSettingsState;
  onDeleteCalendar: () => void;
  onSyncComplete: () => void;
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

  useReportDirty(dirty, onDirtyChange);

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

/** The calendar's settings sections the current user may open, in display order. */
export function useCalendarSettings(calendarId: string | null) {
  const t = useTranslations();
  const { calendars } = useCalendars();
  const calendar = calendars.find((c) => c.id === calendarId);
  const permission = useCalendarPermission(calendarId);
  const { isAuthEnabled } = useAuthFeatures();
  const { presets } = usePresets(calendarId ?? undefined);
  const { externalSyncs, hasSyncErrors } = useExternalSync(
    permission.canManage ? calendarId : null
  );
  const { tokens } = useCalendarTokens(permission.canShare ? calendarId : null);

  const items: SettingsItem[] = [];
  if (!calendar) return { calendar, items };
  if (permission.canManage)
    items.push({
      id: "general",
      icon: Palette,
      title: t("settings.general"),
      description: t("settings.generalHint"),
    });
  if (permission.canEdit)
    items.push({
      id: "presets",
      icon: Layers,
      title: t("settings.presets"),
      description: t("settings.presetsHint", { count: presets.length }),
      meta: presets.length,
    });
  if (permission.canManage)
    items.push({
      id: "external",
      icon: RefreshCw,
      title: t("settings.external"),
      description: t("settings.externalHint", { count: externalSyncs.length }),
      meta: externalSyncs.length,
    });
  if (isAuthEnabled && permission.canShare)
    items.push({
      id: "sharing",
      icon: Users,
      title: t("settings.sharing"),
      description: t("settings.sharingHint", { count: tokens.filter(isUsableToken).length }),
    });
  items.push(
    {
      id: "export",
      icon: Download,
      title: t("settings.export"),
      description: t("settings.exportHint"),
    },
    {
      id: "view",
      icon: SlidersHorizontal,
      title: t("settings.view"),
      description: t("settings.viewHint"),
      meta: calendar.viewSettings ? t("settings.viewOn") : t("settings.viewOff"),
    },
    {
      id: "notifications",
      icon: Bell,
      title: t("settings.notifications"),
      description: hasSyncErrors ? t("settings.notificationsError") : t("settings.notificationsHint"),
      meta: hasSyncErrors ? t("common.error") : undefined,
      metaTone: hasSyncErrors ? "danger" : undefined,
    }
  );
  return { calendar, items };
}

export interface CalendarSettingsPanelProps {
  section: SettingsSection;
  calendarId: string;
  viewSettings: ViewSettingsState;
  /** Closes without asking, e.g. after saving */
  onClose: () => void;
  /** Closes, asking first when there are unsaved changes */
  onCancel: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDeleteCalendar: () => void;
  onSyncComplete: () => void;
}

/** One calendar settings section, shared by the desktop dialog and the phone menu. */
export function CalendarSettingsPanel({
  section,
  calendarId,
  viewSettings,
  onClose,
  onCancel,
  onDirtyChange,
  onDeleteCalendar,
  onSyncComplete,
}: CalendarSettingsPanelProps) {
  switch (section) {
    case "general":
      return (
        <GeneralPanel
          key={calendarId}
          calendarId={calendarId}
          onClose={onClose}
          onCancel={onCancel}
          onDeleteCalendar={onDeleteCalendar}
          onDirtyChange={onDirtyChange}
        />
      );
    case "presets":
      return <PresetsPanel calendarId={calendarId} onClose={onClose} onDirtyChange={onDirtyChange} />;
    case "external":
      return (
        <ExternalSyncPanel
          calendarId={calendarId}
          onClose={onClose}
          onSyncComplete={onSyncComplete}
          onDirtyChange={onDirtyChange}
        />
      );
    case "sharing":
      return <SharingPanel calendarId={calendarId} onClose={onCancel} onDirtyChange={onDirtyChange} />;
    case "export":
      return <ExportPanel calendarId={calendarId} onClose={onClose} />;
    case "view":
      return (
        <CalendarViewPanel
          key={calendarId}
          calendarId={calendarId}
          personal={viewSettings.personal}
          onClose={onClose}
          onCancel={onCancel}
          onDirtyChange={onDirtyChange}
        />
      );
    case "notifications":
      return <SyncNotificationsPanel calendarId={calendarId} onClose={onClose} />;
  }
}

/** Desktop calendar settings; phones reach the same sections through the phone menu. */
export function SettingsDialog({
  open,
  onOpenChange,
  calendarId,
  viewSettings,
  onDeleteCalendar,
  onSyncComplete,
}: SettingsDialogProps) {
  const t = useTranslations();
  const { calendar, items } = useCalendarSettings(calendarId);
  const [section, setSection] = useState<SettingsSection | null>(null);
  const [dirty, setDirty] = useState(false);

  const close = () => {
    setDirty(false);
    onOpenChange(false);
  };
  // Panels with unsaved input report it; leaving them asks first
  const { guarded, confirmProps } = useGuardedAction(dirty, () => setDirty(false));
  const openSection = (id: SettingsSection) =>
    guarded(() => {
      setDirty(false);
      setSection(id);
    });
  const requestClose = (next: boolean) => {
    if (next) onOpenChange(true);
    else guarded(close);
  };

  const active = items.some((i) => i.id === section) ? section : items[0]?.id;

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
            {items.map((item) => {
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
            {active && calendarId && (
              <CalendarSettingsPanel
                section={active}
                calendarId={calendarId}
                viewSettings={viewSettings}
                onClose={close}
                onCancel={() => requestClose(false)}
                onDirtyChange={setDirty}
                onDeleteCalendar={onDeleteCalendar}
                onSyncComplete={onSyncComplete}
              />
            )}
          </div>
        </div>
      </PanelDialog>
      <ConfirmationDialog {...confirmProps} />
    </>
  );
}
