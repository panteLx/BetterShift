"use client";

import { useTranslations } from "next-intl";
import { ChevronRight, Ellipsis, Eye, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AdminMobileCard,
  AdminTableCard,
  AdminTableHead,
  AdminTableRow,
  Count,
} from "@/components/admin/admin-kit";
import { RowActionButton } from "@/components/admin/admin-table-controls";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";
import type { AdminWorkspaceRow } from "@/hooks/useAdminWorkspaces";

interface WorkspaceTableProps {
  workspaces: AdminWorkspaceRow[];
  onWorkspaceClick: (workspace: AdminWorkspaceRow) => void;
  onDeleteWorkspace: (workspace: AdminWorkspaceRow) => void;
  emptyMessage: string;
}

const TEMPLATE = "minmax(0,1.6fr) minmax(0,1.6fr) 100px 100px 102px";

/** lib/workspace.ts is server-only; the default workspace's id is "default" and it cannot be deleted. */
export const isDefaultWorkspace = (workspace: Pick<AdminWorkspaceRow, "id">) => workspace.id === "default";

function OwnerCell({ owner }: { owner: AdminWorkspaceRow["owner"] }) {
  if (!owner) return <span className="text-[12.5px] text-fg-faint">—</span>;
  return (
    <div className="min-w-0">
      <div className="truncate text-[13px] font-semibold text-fg-strong">{owner.name}</div>
      <div className="truncate text-[12px] text-fg-tertiary">{owner.email}</div>
    </div>
  );
}

function WorkspaceRow({
  workspace,
  onWorkspaceClick,
  onDeleteWorkspace,
}: { workspace: AdminWorkspaceRow } & Pick<WorkspaceTableProps, "onWorkspaceClick" | "onDeleteWorkspace">) {
  const t = useTranslations();
  const canDelete = useIsSuperAdmin() && !isDefaultWorkspace(workspace);

  return (
    <AdminTableRow template={TEMPLATE} onClick={() => onWorkspaceClick(workspace)}>
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold text-fg-strong">{workspace.name}</div>
        <div className="truncate font-mono text-[12px] text-fg-tertiary">{workspace.slug}</div>
      </div>
      <OwnerCell owner={workspace.owner} />
      <Count value={workspace.memberCount} />
      <Count value={workspace.calendarCount} />
      {/* Stop clicks and Enter/Space from also opening the details panel */}
      <div
        className="flex items-center justify-end"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <RowActionButton icon={Ellipsis} label={t("adminUsers.moreActions")} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48">
            <DropdownMenuItem onClick={() => onWorkspaceClick(workspace)}>
              <Eye />
              {t("common.viewDetails")}
            </DropdownMenuItem>
            {canDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onDeleteWorkspace(workspace)} className="text-danger focus:text-danger">
                  <Trash2 />
                  {t("admin.workspaces.delete")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </AdminTableRow>
  );
}

function WorkspaceCard({ workspace, onClick }: { workspace: AdminWorkspaceRow; onClick: () => void }) {
  const t = useTranslations();
  return (
    <AdminMobileCard onClick={onClick}>
      <div className="flex items-start gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold text-fg-strong">{workspace.name}</div>
          <div className="truncate font-mono text-[12px] text-fg-tertiary">{workspace.slug}</div>
          <div className="mt-2">
            <OwnerCell owner={workspace.owner} />
          </div>
          <div className="mt-2 font-mono text-[11.5px] text-fg-faint">
            {t("admin.workspaces.counts", { members: workspace.memberCount, calendars: workspace.calendarCount })}
          </div>
        </div>
        <ChevronRight className="mt-[3px] size-[17px] shrink-0 text-fg-faint" />
      </div>
    </AdminMobileCard>
  );
}

export function WorkspaceTable({ workspaces, onWorkspaceClick, onDeleteWorkspace, emptyMessage }: WorkspaceTableProps) {
  const t = useTranslations();
  const empty = <p className="px-4 py-10 text-center text-[13px] text-fg-tertiary">{emptyMessage}</p>;

  return (
    <div>
      <AdminTableCard className="hidden lg:block">
        <AdminTableHead
          template={TEMPLATE}
          columns={[
            t("admin.workspaces.columnName"),
            t("admin.workspaces.columnOwner"),
            t("admin.workspaces.columnMembers"),
            t("admin.workspaces.columnCalendars"),
            <span key="actions" className="block text-right">
              {t("adminUsers.actions")}
            </span>,
          ]}
        />
        {workspaces.length === 0
          ? empty
          : workspaces.map((workspace) => (
              <WorkspaceRow
                key={workspace.id}
                workspace={workspace}
                onWorkspaceClick={onWorkspaceClick}
                onDeleteWorkspace={onDeleteWorkspace}
              />
            ))}
      </AdminTableCard>

      <div className="flex flex-col gap-[9px] lg:hidden">
        {workspaces.length === 0 ? (
          <div className="rounded-[11px] border border-line">{empty}</div>
        ) : (
          workspaces.map((workspace) => (
            <WorkspaceCard key={workspace.id} workspace={workspace} onClick={() => onWorkspaceClick(workspace)} />
          ))
        )}
      </div>
    </div>
  );
}
