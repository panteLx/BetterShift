"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ColorPicker } from "@/components/ui/color-picker";
import { PRESET_COLORS } from "@/lib/constants";
import {
  useAdminCalendars,
  type AdminCalendar,
} from "@/hooks/useAdminCalendars";
import { useCanEditCalendar } from "@/hooks/useAdminAccess";

interface CalendarEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendar: AdminCalendar;
  onSuccess: () => void;
}

export function CalendarEditSheet({
  open,
  onOpenChange,
  calendar,
  onSuccess,
}: CalendarEditSheetProps) {
  const t = useTranslations();
  const { updateCalendar, isLoading } = useAdminCalendars();
  const canEdit = useCanEditCalendar();

  const [name, setName] = useState(calendar.name);
  const [color, setColor] = useState(calendar.color);
  const [guestPermission, setGuestPermission] = useState(
    calendar.guestPermission
  );

  // Reset state when calendar changes
  useEffect(() => {
    setName(calendar.name);
    setColor(calendar.color);
    setGuestPermission(calendar.guestPermission);
  }, [calendar]);

  // Track if form has changes
  const hasChanges =
    name !== calendar.name ||
    color !== calendar.color ||
    guestPermission !== calendar.guestPermission;

  if (!canEdit) {
    return null;
  }

  const handleOpenChange = (newOpen: boolean) => {
    onOpenChange(newOpen);
  };

  const handleSave = async () => {
    const updates: {
      name?: string;
      color?: string;
      guestPermission?: string;
    } = {};

    if (name !== calendar.name) updates.name = name;
    if (color !== calendar.color) updates.color = color;
    if (guestPermission !== calendar.guestPermission)
      updates.guestPermission = guestPermission;

    const success = await updateCalendar(calendar.id, updates);
    if (success) {
      onSuccess();
      handleOpenChange(false);
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={handleOpenChange}
      title={t("admin.calendars.editCalendar")}
      description={t("admin.calendars.editCalendarDescription")}
      showSaveButton
      onSave={handleSave}
      isSaving={isLoading}
      saveDisabled={!hasChanges || !name.trim()}
      hasUnsavedChanges={hasChanges}
      maxWidth="md"
    >
      <div className="space-y-6">
        {/* Calendar Name */}
        <div className="space-y-2">
          <Label htmlFor="name">
            {t("common.labels.name")}{" "}
            <span className="text-destructive">*</span>
          </Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("admin.calendars.namePlaceholder")}
          />
        </div>

        {/* Calendar Color */}
        <ColorPicker
          color={color}
          onChange={setColor}
          label={t("form.colorLabel")}
          presetColors={PRESET_COLORS}
        />

        {/* Guest Permission */}
        <div className="space-y-2">
          <Label htmlFor="guestPermission">
            {t("admin.calendars.guestPermission")}
          </Label>
          <Select
            value={guestPermission}
            onValueChange={(value) =>
              setGuestPermission(value as "none" | "read" | "write")
            }
          >
            <SelectTrigger id="guestPermission">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">
                {t("common.labels.permissions.none")}
              </SelectItem>
              <SelectItem value="read">
                {t("common.labels.permissions.read")}
              </SelectItem>
              <SelectItem value="write">
                {t("common.labels.permissions.write")}
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {t("admin.calendars.guestPermissionHint")}
          </p>
        </div>

        {/* Current Owner */}
        <div className="space-y-2">
          <Label>{t("admin.calendars.currentOwner")}</Label>
          <div className="p-3 rounded-lg border bg-muted/20">
            {calendar.ownerId ? (
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium">{calendar.owner!.name}</p>
                <p className="text-xs text-muted-foreground">
                  {calendar.owner!.email}
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("admin.calendars.noOwner")}
              </p>
            )}
          </div>
        </div>
      </div>
    </BaseSheet>
  );
}
