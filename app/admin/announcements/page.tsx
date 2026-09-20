"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { AnnouncementTable } from "@/components/admin/announcement-table";
import {
  useAdminAnnouncements,
  type AdminAnnouncement,
} from "@/hooks/useAdminAnnouncements";

export default function AdminAnnouncementsPage() {
  const t = useTranslations();
  const { announcements, isLoading } = useAdminAnnouncements();
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [creating, setCreating] = useState(false);

  if (isLoading) return <FullscreenLoader />;

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t("admin.announcements.title")}
        subtitle={t("admin.announcements.description")}
        actions={
          <Button
            variant="outline"
            onClick={() => setCreating(true)}
            className="h-[38px] gap-2 rounded-[9px] font-semibold"
          >
            <Plus className="size-4" />
            {t("admin.announcements.create")}
          </Button>
        }
        mobileActions={
          <button
            type="button"
            onClick={() => setCreating(true)}
            aria-label={t("admin.announcements.create")}
            className="flex size-[34px] items-center justify-center rounded-[9px] border border-line text-fg-secondary"
          >
            <Plus className="size-[17px]" />
          </button>
        }
      />

      {announcements.length === 0 ? (
        <div className="rounded-[11px] border border-line bg-surface-card px-4 py-8 text-center">
          <p className="text-[14px] font-semibold text-fg-strong">
            {t("admin.announcements.empty")}
          </p>
          <p className="mt-1 text-[12.5px] text-fg-secondary">
            {t("admin.announcements.emptyHint")}
          </p>
        </div>
      ) : (
        <AnnouncementTable
          announcements={announcements}
          onEdit={setEditing}
          onDelete={setEditing}
        />
      )}
    </div>
  );
}
