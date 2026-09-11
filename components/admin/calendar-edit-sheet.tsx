"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ColorSwatches, Field, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { useAdminCalendarActions, type AdminCalendar } from "@/hooks/useAdminCalendars";
import { useCanEditCalendar } from "@/hooks/useAdminAccess";

interface CalendarEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: AdminCalendar;
  onSuccess: () => void;
}

export function CalendarEditSheet({ open, onOpenChange, calendar, onSuccess }: CalendarEditSheetProps) {
  const t = useTranslations();
  const { updateCalendar, isUpdating } = useAdminCalendarActions();
  const canEdit = useCanEditCalendar();

  // Resets when the parent remounts this component via its key
  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);
  const [guestPermission, setGuestPermission] = useState(calendar.guestPermission);

  const hasChanges =
    name !== calendar.name ||
    color !== calendar.color ||
    guestPermission !== calendar.guestPermission;

  if (!canEdit) {
    return null;
  }

  const handleSave = async () => {
    const updates: Parameters<typeof updateCalendar>[1] = {};

    if (name !== calendar.name) updates.name = name;
    if (color !== calendar.color) updates.color = color;
    if (guestPermission !== calendar.guestPermission) updates.guestPermission = guestPermission;

    const success = await updateCalendar(calendar.id, updates);
    if (success) {
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <AdminFormPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.calendars.editCalendar")}
      subtitle={calendar.name}
      onSave={handleSave}
      isSaving={isUpdating}
      saveDisabled={!hasChanges || !name.trim()}
      hasUnsavedChanges={hasChanges}
    >
      <Field label={t("common.labels.name")} htmlFor="admin-calendar-name">
        <Input
          id="admin-calendar-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.calendars.namePlaceholder")}
          className={inputClass}
        />
      </Field>

      <Field label={t("form.colorLabel")}>
        <ColorSwatches value={color} onChange={setColor} allowCustom />
      </Field>

      <Field
        label={t("admin.calendars.guestPermission")}
        htmlFor="admin-calendar-guest"
        hint={t("admin.calendars.guestPermissionHint")}
      >
        <Select
          value={guestPermission}
          onValueChange={(value) => setGuestPermission(value as AdminCalendar["guestPermission"])}
        >
          <SelectTrigger
            id="admin-calendar-guest"
            className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">{t("common.labels.permissions.none")}</SelectItem>
            <SelectItem value="read">{t("common.labels.permissions.read")}</SelectItem>
            <SelectItem value="write">{t("common.labels.permissions.write")}</SelectItem>
          </SelectContent>
        </Select>
      </Field>

      <Field label={t("admin.calendars.currentOwner")}>
        <div className="rounded-[9px] border border-line bg-surface-panel px-[13px] py-[11px]">
          {calendar.ownerId && calendar.owner ? (
            <>
              <div className="truncate text-[13.5px] font-semibold text-fg-strong">
                {calendar.owner.name}
              </div>
              <div className="mt-0.5 truncate text-[12px] text-fg-tertiary">{calendar.owner.email}</div>
            </>
          ) : (
            <div className="text-[13px] text-fg-tertiary">{t("admin.calendars.noOwner")}</div>
          )}
        </div>
      </Field>
    </AdminFormPanel>
  );
}
