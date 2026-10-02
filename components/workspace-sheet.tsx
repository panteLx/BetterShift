"use client";

import { useTranslations } from "next-intl";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { WorkspaceMembersPanel } from "@/components/admin/workspace-members-panel";
import { useWorkspace } from "@/hooks/useWorkspace";

interface WorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Read-only member list; invites and member management live in the dashboard. */
export function WorkspaceSheet({ open, onOpenChange }: WorkspaceSheetProps) {
  const t = useTranslations();
  const { data: workspace } = useWorkspace();

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("workspaces.membersTab")}
      description={workspace ? `${workspace.name} · ${workspace.slug}` : undefined}
      width="md"
      bare
    >
      <PanelBody className="min-h-[260px]">
        <WorkspaceMembersPanel enabled={open} readOnly />
      </PanelBody>
      {workspace?.role === "owner" && (
        <PanelFooter className="flex-col items-stretch">
          <p className="text-[12.5px] text-fg-tertiary">{t("workspaces.ownerCannotLeave")}</p>
        </PanelFooter>
      )}
    </PanelDialog>
  );
}
