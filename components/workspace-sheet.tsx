"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import { WorkspaceMembersPanel } from "@/components/admin/workspace-members-panel";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeaveWorkspace, useWorkspaceMembers } from "@/hooks/useWorkspaces";
import { isManagerRole } from "@/lib/workspace-access";

interface WorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only member list and leave; invites and member management live in the dashboard. */
export function WorkspaceSheet({ open, onOpenChange }: WorkspaceSheetProps) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data: workspace } = useWorkspace();
  const { data } = useWorkspaceMembers(open);
  const leaveWorkspace = useLeaveWorkspace();
  const handleError = useActionErrorHandler();
  const [leaveOpen, setLeaveOpen] = useState(false);

  const confirmLeave = async () => {
    try {
      await leaveWorkspace.mutateAsync();
      window.location.assign(config.auth.url);
    } catch (error) {
      await handleError(error);
    }
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("workspaces.menuEntry")}
      description={workspace ? `${workspace.name} · ${workspace.slug}` : undefined}
      width="md"
      bare
    >
      <PanelBody className="min-h-[260px]">
        <WorkspaceMembersPanel enabled={open} readOnly />
      </PanelBody>
      {(data || isManagerRole(workspace?.role)) && (
        <PanelFooter className="flex-col items-stretch">
          {isManagerRole(workspace?.role) && (
            <Button asChild className="h-10 w-full gap-2 font-semibold">
              <Link href="/admin" onClick={() => onOpenChange(false)}>
                <Settings2 className="size-4" />
                {t("workspaces.manageWorkspace")}
              </Link>
            </Button>
          )}
          {data &&
            (data.currentRole === "owner" ? (
              <p className="text-[12.5px] text-fg-tertiary">{t("workspaces.ownerCannotLeave")}</p>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => setLeaveOpen(true)}
                disabled={leaveWorkspace.isPending}
                className="h-10 w-full gap-2 font-semibold text-danger hover:text-danger"
              >
                <LogOut className="size-4" />
                {t("workspaces.leave")}
              </Button>
            ))}
        </PanelFooter>
      )}

      <ConfirmationDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onConfirm={confirmLeave}
        title={t("workspaces.leaveConfirmTitle", { workspace: workspace?.name ?? "" })}
        description={t("workspaces.leaveConfirmDescription")}
        confirmText={t("workspaces.leave")}
        confirmVariant="destructive"
      />
    </PanelDialog>
  );
}
