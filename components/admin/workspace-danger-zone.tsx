"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DangerZone } from "@/components/form-kit";
import { ConfirmNameDeleteDialog } from "@/components/admin/confirm-name-delete-dialog";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useDeleteWorkspace, useWorkspaceStats } from "@/hooks/useWorkspaces";

export function WorkspaceDangerZone({ slug }: { slug: string }) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data: stats } = useWorkspaceStats(true);
  const deleteWorkspace = useDeleteWorkspace();
  const handleError = useActionErrorHandler();
  const [open, setOpen] = useState(false);

  const handleDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync(slug);
    } catch (error) {
      await handleError(error);
      return;
    }
    window.location.assign(config.auth.url);
  };

  return (
    <>
      <DangerZone
        icon={Trash2}
        title={t("adminWorkspace.deleteTitle")}
        description={t("adminWorkspace.deleteDescription")}
        action={
          <Button variant="destructive" className="h-9 font-semibold" onClick={() => setOpen(true)}>
            {t("adminWorkspace.deleteButton")}
          </Button>
        }
      />
      <ConfirmNameDeleteDialog
        open={open}
        onOpenChange={setOpen}
        name={slug}
        idPrefix="workspace-delete"
        title={t("adminWorkspace.deleteTitle")}
        description={t("adminWorkspace.deleteConfirmDescription", { slug })}
        warning={t("adminWorkspace.deleteWarning", { members: stats?.members ?? 0, calendars: stats?.calendars ?? 0 })}
        understoodLabel={t("adminWorkspace.deleteUnderstood")}
        confirmationLabel={t("adminWorkspace.deleteConfirmation", { slug })}
        confirmationHint={t("adminWorkspace.deleteConfirmationHint")}
        confirmLabel={t("adminWorkspace.deleteConfirm")}
        onConfirm={handleDelete}
      />
    </>
  );
}
