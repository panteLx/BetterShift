"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { AnnouncementTable } from "@/components/admin/announcement-table";
import { AnnouncementEditSheet } from "@/components/admin/announcement-edit-sheet";
import { ConfirmNameDeleteDialog } from "@/components/admin/confirm-name-delete-dialog";
import {
  useAdminAnnouncements,
  useAdminAnnouncementActions,
  type AdminAnnouncement,
} from "@/hooks/useAdminAnnouncements";

export default function AdminAnnouncementsPage() {
  const t = useTranslations();
  const { announcements, isLoading } = useAdminAnnouncements();
  const { createAnnouncement, updateAnnouncement, deleteAnnouncement, isSaving } =
    useAdminAnnouncementActions();
  // null means create mode; the sheet's `open` prop lives separately below so
  // closing never has to clear this — that would tie it to the same state
  // that flips `open` false, see `sheetKey` below.
  const [editing, setEditing] = useState<AdminAnnouncement | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // Bumped only when opening for create/edit, never when closing: used solely as
  // the sheet's `key` so every open gets a fresh form (even reopening the same
  // target), while every close path leaves the key — and the exit animation —
  // undisturbed.
  const [sheetKey, setSheetKey] = useState(0);
  const [deleting, setDeleting] = useState<AdminAnnouncement | null>(null);

  const openCreate = () => {
    setEditing(null);
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  };

  const openEdit = (announcement: AdminAnnouncement) => {
    setEditing(announcement);
    setSheetKey((key) => key + 1);
    setSheetOpen(true);
  };

  if (isLoading) return <FullscreenLoader />;

  return (
    <div className="flex flex-col gap-4">
      <AdminPageHeader
        title={t("admin.announcements.title")}
        subtitle={t("admin.announcements.description")}
        actions={
          <Button
            variant="outline"
            onClick={openCreate}
            className="h-[38px] gap-2 rounded-[9px] font-semibold"
          >
            <Plus className="size-4" />
            {t("admin.announcements.create")}
          </Button>
        }
        mobileActions={
          <button
            type="button"
            onClick={openCreate}
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
          onEdit={openEdit}
          onDelete={(announcement) => setDeleting(announcement)}
        />
      )}

      <AnnouncementEditSheet
        key={sheetKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        announcement={editing}
        isSaving={isSaving}
        onSubmit={async (payload) => {
          if (editing) {
            await updateAnnouncement({ id: editing.id, ...payload });
          } else {
            await createAnnouncement(payload);
          }
        }}
      />

      {deleting && (
        <ConfirmNameDeleteDialog
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          name={deleting.title}
          idPrefix="announcement-delete"
          title={t("admin.announcements.deleteTitle")}
          description={t("admin.announcements.deleteDescription")}
          warning={t("admin.announcements.deleteWarning")}
          understoodLabel={t("admin.announcements.deleteUnderstood")}
          confirmationLabel={t("admin.announcements.deleteConfirmationLabel")}
          confirmationHint={t("admin.announcements.deleteConfirmationHint", {
            name: deleting.title,
          })}
          confirmLabel={t("admin.announcements.deleteConfirm")}
          onConfirm={async () => {
            try {
              await deleteAnnouncement(deleting.id);
              setDeleting(null);
            } catch {
              // Already toasted by the mutation's onError; keep the dialog open so the user can retry.
            }
          }}
        />
      )}
    </div>
  );
}
