"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { AdminAnnouncement, AnnouncementPayload } from "@/hooks/useAdminAnnouncements";

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

function initialFormFor(announcement: AdminAnnouncement | null): AnnouncementPayload {
  if (!announcement) return EMPTY;
  return {
    title: announcement.title,
    body: announcement.body,
    tone: announcement.tone,
    showOnAuth: announcement.showOnAuth,
    showOnDashboard: announcement.showOnDashboard,
    enabled: announcement.enabled,
    startsAt: announcement.startsAt,
    endsAt: announcement.endsAt,
  };
}

/**
 * Owns the announcement create/edit form's state and save-time validation.
 * The owning sheet is remounted by its parent (via `key`) whenever the
 * create/edit target changes, so the initial state below only has to run
 * once per mount — no reset-on-open effect needed here.
 */
export function useAnnouncementForm(announcement: AdminAnnouncement | null) {
  const t = useTranslations();
  const [form, setForm] = useState<AnnouncementPayload>(() => initialFormFor(announcement));
  const [error, setError] = useState<string | null>(null);

  const patch = (next: Partial<AnnouncementPayload>) =>
    setForm((current) => ({ ...current, ...next }));

  /** Sanitizes and validates on save; returns the payload to submit, or null (with `error` set). */
  const validate = (): AnnouncementPayload | null => {
    if (!form.title.trim()) {
      setError(t("admin.announcements.errorTitleRequired"));
      return null;
    }
    if (!form.showOnAuth && !form.showOnDashboard) {
      setError(t("admin.announcements.errorNoPlacement"));
      return null;
    }
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      setError(t("admin.announcements.errorWindow"));
      return null;
    }
    setError(null);
    return { ...form, title: form.title.trim() };
  };

  return { form, patch, error, validate };
}
