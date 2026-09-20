"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { Pill, RowIconButton } from "@/components/form-kit";
// Client-safe module: lib/announcements.ts pulls in lib/db and cannot be
// imported (as a value) from client components.
import { getAnnouncementStatus, type AnnouncementStatus, type AnnouncementTone } from "@/lib/announcement-status";
import type { AdminAnnouncement } from "@/hooks/useAdminAnnouncements";

const STATUS_LABEL: Record<AnnouncementStatus, string> = {
  active: "admin.announcements.statusActive",
  scheduled: "admin.announcements.statusScheduled",
  expired: "admin.announcements.statusExpired",
  off: "admin.announcements.statusOff",
};

const TONE_LABEL: Record<AnnouncementTone, string> = {
  info: "admin.announcements.toneInfo",
  warning: "admin.announcements.toneWarning",
  danger: "admin.announcements.toneDanger",
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
                <Pill>{t(STATUS_LABEL[status])}</Pill>
                <Pill>{t(TONE_LABEL[announcement.tone])}</Pill>
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
