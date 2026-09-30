"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Loader2, UserMinus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { Pill, RowIconButton } from "@/components/form-kit";
import { PersonRow } from "@/components/person-row";
import { LoadErrorBanner } from "@/components/admin/load-error-banner";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import {
  useChangeMemberRole,
  useRemoveMember,
  useWorkspaceMembers,
  type WorkspaceMemberDto,
} from "@/hooks/useWorkspaces";
import { canChangeRole, canRemoveMember, isWorkspaceRole, type WorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getDateLocale } from "@/lib/locales";

const ROLE_TONE = { owner: "warning", admin: "violet", member: "neutral" } as const;

/** Member list with role and remove actions, each shown only when the viewer's role allows it. */
export function WorkspaceMembersPanel({ enabled = true }: { enabled?: boolean }) {
  const t = useTranslations();
  const locale = useLocale();
  const { data, isError, refetch } = useWorkspaceMembers(enabled);
  const removeMember = useRemoveMember();
  const changeRole = useChangeMemberRole();
  const handleError = useActionErrorHandler();
  // Kept after closing so the dialog title doesn't change during the close animation
  const [removing, setRemoving] = useState<WorkspaceMemberDto | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(removing.userId, {
      onSuccess: () => toast.success(t("workspaces.removeMemberSuccess")),
      onError: handleError,
    });
  };

  if (isError && !data) {
    return <LoadErrorBanner item={t("workspaces.membersTab")} onRetry={() => void refetch()} />;
  }
  if (!data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-fg-tertiary" />
      </div>
    );
  }

  const actor: WorkspaceRole | null = isWorkspaceRole(data.currentRole) ? data.currentRole : null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {data.members.map((member) => {
          const isSelf = member.userId === data.currentUserId;
          const role: WorkspaceRole = isWorkspaceRole(member.role) ? member.role : "member";
          const showRoleSelect = !isSelf && canChangeRole(actor, role, "admin");
          const showRemove = !isSelf && canRemoveMember(actor, role);
          return (
            <PersonRow
              key={member.userId}
              user={member}
              highlight={isSelf}
              suffix={
                isSelf && (
                  <Pill tone="brand" className="ml-1.5 align-middle">
                    {t("workspaces.you")}
                  </Pill>
                )
              }
              action={
                <div className="flex shrink-0 items-center gap-1.5">
                  <div className="hidden text-right text-[12px] text-fg-tertiary sm:block">
                    {format(new Date(member.joinedAt), "PP", { locale: getDateLocale(locale) })}
                  </div>
                  {showRoleSelect ? (
                    <Select
                      value={role}
                      onValueChange={(next) =>
                        changeRole.mutate({ userId: member.userId, role: next as "admin" | "member" }, { onError: handleError })
                      }
                    >
                      <SelectTrigger className="h-8 w-[112px] rounded-[9px]" aria-label={t("adminWorkspace.members.changeRole")}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">{t("adminWorkspace.members.role.member")}</SelectItem>
                        <SelectItem value="admin">{t("adminWorkspace.members.role.admin")}</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Pill tone={ROLE_TONE[role]}>{t(`adminWorkspace.members.role.${role}`)}</Pill>
                  )}
                  {showRemove && (
                    <RowIconButton
                      icon={UserMinus}
                      tone="danger"
                      label={t("adminWorkspace.members.remove")}
                      onClick={() => {
                        setRemoving(member);
                        setRemoveOpen(true);
                      }}
                    />
                  )}
                </div>
              }
            />
          );
        })}
      </div>

      <ConfirmationDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={confirmRemove}
        title={t("workspaces.removeMemberConfirmTitle", { name: removing?.name || removing?.email || "" })}
        description={t("workspaces.removeMemberConfirmDescription")}
        confirmText={t("adminWorkspace.members.remove")}
        confirmVariant="destructive"
      />
    </>
  );
}
