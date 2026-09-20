"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { BaseSheet } from "@/components/ui/base-sheet";
import { ChoiceChips, Field, ToggleRow, inputClass, textareaClass } from "@/components/form-kit";
import {
  BODY_MAX_LENGTH,
  TITLE_MAX_LENGTH,
  type AnnouncementTone,
} from "@/lib/announcement-status";
import type { AdminAnnouncement, AnnouncementPayload } from "@/hooks/useAdminAnnouncements";

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" in local time, not an ISO string. */
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const EMPTY: AnnouncementPayload = {
  title: "",
  body: null,
  tone: "info",
  showOnAuth: true,
  showOnDashboard: true,
  enabled: true,
  startsAt: null,
  endsAt: null,
};

export function AnnouncementEditSheet({
  open,
  onOpenChange,
  announcement,
  onSubmit,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: AdminAnnouncement | null;
  onSubmit: (payload: AnnouncementPayload) => Promise<void>;
  isSaving: boolean;
}) {
  const t = useTranslations();
  const [form, setForm] = useState<AnnouncementPayload>(EMPTY);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // Syncing from the `announcement` prop (an external source) when the sheet opens, not from render state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError(null);
    setForm(
      announcement
        ? {
            title: announcement.title,
            body: announcement.body,
            tone: announcement.tone,
            showOnAuth: announcement.showOnAuth,
            showOnDashboard: announcement.showOnDashboard,
            enabled: announcement.enabled,
            startsAt: announcement.startsAt,
            endsAt: announcement.endsAt,
          }
        : EMPTY
    );
  }, [open, announcement]);

  const patch = (next: Partial<AnnouncementPayload>) =>
    setForm((current) => ({ ...current, ...next }));

  const handleSave = async () => {
    if (!form.title.trim()) {
      setError(t("admin.announcements.errorTitleRequired"));
      return;
    }
    if (!form.showOnAuth && !form.showOnDashboard) {
      setError(t("admin.announcements.errorNoPlacement"));
      return;
    }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError(t("admin.announcements.errorWindow"));
      return;
    }
    setError(null);
    await onSubmit({ ...form, title: form.title.trim() });
    onOpenChange(false);
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={
        announcement
          ? t("admin.announcements.editTitle")
          : t("admin.announcements.createTitle")
      }
      description={t("admin.announcements.formDescription")}
      showSaveButton
      onSave={handleSave}
      isSaving={isSaving}
      saveDisabled={!form.title.trim()}
    >
      <div className="flex flex-col gap-4">
        <Field label={t("admin.announcements.fieldTitle")}>
          <Input
            value={form.title}
            maxLength={TITLE_MAX_LENGTH}
            onChange={(event) => patch({ title: event.target.value })}
            placeholder={t("admin.announcements.fieldTitlePlaceholder")}
            className={inputClass}
          />
        </Field>

        <Field label={t("admin.announcements.fieldBody")}>
          <Textarea
            value={form.body ?? ""}
            maxLength={BODY_MAX_LENGTH}
            rows={4}
            onChange={(event) => patch({ body: event.target.value || null })}
            placeholder={t("admin.announcements.fieldBodyPlaceholder")}
            className={textareaClass}
          />
        </Field>

        <Field label={t("admin.announcements.fieldTone")}>
          <ChoiceChips<AnnouncementTone>
            value={form.tone}
            onChange={(tone) => patch({ tone })}
            options={[
              { value: "info", label: t("admin.announcements.toneInfo") },
              { value: "warning", label: t("admin.announcements.toneWarning") },
              { value: "danger", label: t("admin.announcements.toneDanger") },
            ]}
          />
        </Field>

        <ToggleRow
          id="announcement-show-auth"
          title={t("admin.announcements.showOnAuth")}
          description={t("admin.announcements.showOnAuthHint")}
          checked={form.showOnAuth}
          onCheckedChange={(showOnAuth) => patch({ showOnAuth })}
        />
        <ToggleRow
          id="announcement-show-dashboard"
          title={t("admin.announcements.showOnDashboard")}
          description={t("admin.announcements.showOnDashboardHint")}
          checked={form.showOnDashboard}
          onCheckedChange={(showOnDashboard) => patch({ showOnDashboard })}
        />
        <ToggleRow
          id="announcement-enabled"
          title={t("admin.announcements.enabled")}
          description={t("admin.announcements.enabledHint")}
          checked={form.enabled}
          onCheckedChange={(enabled) => patch({ enabled })}
        />

        <Field label={t("admin.announcements.startsAt")} hint={t("admin.announcements.windowHint")}>
          <Input
            type="datetime-local"
            value={toLocalInput(form.startsAt)}
            onChange={(event) => patch({ startsAt: fromLocalInput(event.target.value) })}
            className={inputClass}
          />
        </Field>
        <Field label={t("admin.announcements.endsAt")}>
          <Input
            type="datetime-local"
            value={toLocalInput(form.endsAt)}
            onChange={(event) => patch({ endsAt: fromLocalInput(event.target.value) })}
            className={inputClass}
          />
        </Field>

        {error && <p className="text-[12px] text-danger">{error}</p>}
      </div>
    </BaseSheet>
  );
}
