"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import { WorkspaceJoinLinksPanel } from "@/components/admin/workspace-join-links-panel";
import { WorkspaceMembersPanel } from "@/components/admin/workspace-members-panel";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useLeaveWorkspace, useWorkspaceMembers } from "@/hooks/useWorkspaces";

interface WorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WorkspaceTab = "members" | "links";

/** Members and invite links of the current workspace; the links tab is for owners and admins. */
export function WorkspaceSheet({ open, onOpenChange }: WorkspaceSheetProps) {
  const t = useTranslations();
  const { data: workspace } = useWorkspace();
  const isManager = workspace?.role === "owner" || workspace?.role === "admin";
  const [selectedTab, setSelectedTab] = useState<WorkspaceTab>("members");
  const tab = isManager ? selectedTab : "members";

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("workspaces.menuEntry")}
      description={workspace?.name}
      width="md"
      bare
    >
      {isManager && (
        <div className="shrink-0 border-b border-line px-[22px] py-3.5">
          <SegmentedControl
            value={tab}
            onChange={setSelectedTab}
            label={t("workspaces.menuEntry")}
            options={[
              { value: "members", label: t("workspaces.membersTab") },
              { value: "links", label: t("workspaces.linksTab") },
            ]}
          />
        </div>
      )}
      {tab === "members" ? (
        <MembersTab open={open} workspaceName={workspace?.name ?? ""} />
      ) : (
        <PanelBody className="min-h-[260px]">
          <WorkspaceJoinLinksPanel enabled={open && isManager} />
        </PanelBody>
      )}
    </PanelDialog>
  );
}

function MembersTab({ open, workspaceName }: { open: boolean; workspaceName: string }) {
  const t = useTranslations();
  const config = usePublicConfig();
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
    <>
      <PanelBody className="min-h-[260px]">
        <WorkspaceMembersPanel enabled={open} />
      </PanelBody>
      {data && (
        <PanelFooter>
          {data.currentRole === "owner" ? (
            <p className="text-[12.5px] text-fg-tertiary">{t("workspaces.ownerCannotLeave")}</p>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setLeaveOpen(true)}
              disabled={leaveWorkspace.isPending}
              className="h-10 flex-1 gap-2 font-semibold text-danger hover:text-danger"
            >
              <LogOut className="size-4" />
              {t("workspaces.leave")}
            </Button>
          )}
        </PanelFooter>
      )}

      <ConfirmationDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        onConfirm={confirmLeave}
        title={t("workspaces.leaveConfirmTitle", { workspace: workspaceName })}
        description={t("workspaces.leaveConfirmDescription")}
        confirmText={t("workspaces.leave")}
        confirmVariant="destructive"
      />
    </>
  );
}
