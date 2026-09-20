"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { Pill, RowIconButton } from "@/components/form-kit";
// Client-safe module: lib/announcements.ts pulls in lib/db and cannot be
// imported (as a value) from client components.
import { getAnnouncementStatus, type AnnouncementStatus, type AnnouncementTone } from "@/lib/announcement-status";
import type { AdminAnnouncement } from "@/hooks/useAdminAnnouncements";

// Capitalised suffixes for the admin.announcements.status*/tone* keys. Kept
// separate from the t() call site so the i18n scanner still sees the static
// prefix + interpolation shape (its documented `admin.role${role}` idiom)
// instead of an opaque variable it can't resolve.
const STATUS_SUFFIX: Record<AnnouncementStatus, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  off: "Off",
};

const TONE_SUFFIX: Record<AnnouncementTone, string> = {
  info: "Info",
  warning: "Warning",
  danger: "Danger",
};

function toDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

export function AnnouncementTable({
  announcements,
  onEdit,
  onDelete,
}: {
  announcements: AdminAnnouncement[];
  onEdit: (announcement: AdminAnnouncement) => void;
  onDelete: (announcement: AdminAnnouncement) => void;
}) {
  const t = useTranslations();
  const format = useFormatter();

  return (
    <div className="flex flex-col gap-2">
      {announcements.map((announcement) => {
        const status = getAnnouncementStatus({
          enabled: announcement.enabled,
          startsAt: toDate(announcement.startsAt),
          endsAt: toDate(announcement.endsAt),
        });

        return (
          <div
            key={announcement.id}
            className="flex items-start gap-3 rounded-[11px] border border-line bg-surface-card px-3 py-2.5"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-[14px] font-semibold text-fg-strong">
                  {announcement.title}
                </span>
                <Pill>{t(`admin.announcements.status${STATUS_SUFFIX[status]}`)}</Pill>
                <Pill>{t(`admin.announcements.tone${TONE_SUFFIX[announcement.tone]}`)}</Pill>
              </div>
              {announcement.body && (
                <p className="mt-0.5 line-clamp-2 text-[12.5px] text-fg-secondary">
                  {announcement.body}
                </p>
              )}
              <p className="mt-1 text-[12px] text-fg-tertiary">
                {[
                  announcement.showOnAuth ? t("admin.announcements.showOnAuth") : null,
                  announcement.showOnDashboard ? t("admin.announcements.showOnDashboard") : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
                {" · "}
                {t("admin.announcements.createdBy", {
                  name: announcement.createdByName ?? t("admin.announcements.unknownAuthor"),
                })}
                {" · "}
                {format.dateTime(new Date(announcement.createdAt), {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <RowIconButton
                icon={Pencil}
                label={t("admin.announcements.edit")}
                onClick={() => onEdit(announcement)}
              />
              <RowIconButton
                icon={Trash2}
                label={t("admin.announcements.delete")}
                onClick={() => onDelete(announcement)}
                tone="danger"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
