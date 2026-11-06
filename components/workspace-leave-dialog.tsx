"use client";

import { useTranslations } from "next-intl";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeaveWorkspace } from "@/hooks/useWorkspaces";

interface WorkspaceLeaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WorkspaceLeaveDialog({ open, onOpenChange }: WorkspaceLeaveDialogProps) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data: workspace } = useWorkspace();
  const leaveWorkspace = useLeaveWorkspace();
  const handleError = useActionErrorHandler();

  const confirmLeave = async () => {
    try {
      await leaveWorkspace.mutateAsync();
      window.location.assign(config.auth.url);
    } catch (error) {
      await handleError(error);
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={confirmLeave}
      title={t("workspaces.leaveConfirmTitle", { workspace: workspace?.name ?? "" })}
      description={t("workspaces.leaveConfirmDescription")}
      confirmText={t("workspaces.leave")}
      confirmVariant="destructive"
    />
  );
}
