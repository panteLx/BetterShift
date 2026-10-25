"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Plus, UserMinus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { DetailSection } from "@/components/admin/admin-kit";
import { Field, ListRow, Pill, RowIconButton, inputClass } from "@/components/form-kit";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import {
  WorkspaceApiError,
  useAdminAddUserToWorkspace,
  useAdminRemoveUserFromWorkspace,
  useAdminUserWorkspaces,
  type MyWorkspace,
} from "@/hooks/useWorkspaces";
import { handleRateLimitError } from "@/lib/rate-limit-client";

function roleLabel(t: ReturnType<typeof useTranslations>, role: string) {
  if (role === "owner") return t("workspaces.roleOwner");
  if (role === "admin") return t("workspaces.roleAdmin");
  return t("workspaces.roleMember");
}

/** Maps the admin workspace-membership API's error codes to a toast message. */
function errorMessage(t: ReturnType<typeof useTranslations>, code: string | null): string {
  if (code === "workspace_not_found") return t("adminUsers.workspaceNotFound");
  if (code === "already_member") return t("adminUsers.alreadyMember");
  if (code === "owner") return t("adminUsers.cannotRemoveOwner");
  return t("workspaces.actionError");
}

/** A user's workspace memberships (multi-tenant only), with add-by-slug and remove actions. */
export function UserWorkspacesSection({ userId }: { userId: string }) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data, isLoading } = useAdminUserWorkspaces(userId, config.auth.multiTenant);
  const addToWorkspace = useAdminAddUserToWorkspace(userId);
  const removeFromWorkspace = useAdminRemoveUserFromWorkspace(userId);

  const [slug, setSlug] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [removing, setRemoving] = useState<MyWorkspace | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);

  if (!config.auth.multiTenant) return null;

  const handleError = async (error: unknown) => {
    if (error instanceof WorkspaceApiError) {
      if (error.rateLimitResponse) {
        await handleRateLimitError(error.rateLimitResponse, t);
        return;
      }
      toast.error(errorMessage(t, error.code));
      return;
    }
    toast.error(t("workspaces.actionError"));
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = slug.trim().toLowerCase();
    if (!trimmed) return;
    addToWorkspace.mutate(
      { slug: trimmed, role },
      {
        onSuccess: () => {
          toast.success(t("adminUsers.workspaceAdded"));
          setSlug("");
          setRole("member");
        },
        onError: handleError,
      }
    );
  };

  const confirmRemove = () => {
    if (!removing) return;
    removeFromWorkspace.mutate(removing.id, {
      onSuccess: () => toast.success(t("adminUsers.workspaceRemoved")),
      onError: handleError,
    });
  };

  return (
    <DetailSection label={t("adminUsers.workspaces")}>
      {isLoading || !data ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="size-5 animate-spin text-fg-tertiary" />
        </div>
      ) : data.workspaces.length === 0 ? (
        <p className="py-2 text-[13px] text-fg-tertiary">{t("adminUsers.workspacesEmpty")}</p>
      ) : (
        data.workspaces.map((workspace) => (
          <ListRow key={workspace.id} className="py-2.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-semibold text-fg-strong">{workspace.name}</div>
              <div className="truncate text-[12px] text-fg-tertiary">{workspace.slug}</div>
            </div>
            <Pill tone={workspace.role === "owner" ? "violet" : "neutral"}>{roleLabel(t, workspace.role)}</Pill>
            {workspace.role !== "owner" && (
              <RowIconButton
                icon={UserMinus}
                tone="danger"
                label={t("workspaces.removeMember")}
                onClick={() => {
                  setRemoving(workspace);
                  setRemoveOpen(true);
                }}
              />
            )}
          </ListRow>
        ))
      )}

      <form onSubmit={handleAdd} className="flex flex-col gap-3 pt-1">
        <Field label={t("adminUsers.workspaceSlug")} htmlFor="user-workspace-slug">
          <Input
            id="user-workspace-slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            maxLength={32}
            className={inputClass}
          />
        </Field>
        {/* Own row: at the panel's real (narrower than viewport) width, three inline controls squeeze the slug input to a few pixels. */}
        <div className="flex items-center gap-3">
          <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
            <SelectTrigger className="h-10 min-w-0 flex-1 rounded-[9px]" aria-label={t("adminUsers.addToWorkspace")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="member">{t("workspaces.roleMember")}</SelectItem>
              <SelectItem value="admin">{t("workspaces.roleAdmin")}</SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="submit"
            disabled={addToWorkspace.isPending || !slug.trim()}
            className="h-10 shrink-0 gap-2 font-semibold"
          >
            {addToWorkspace.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("adminUsers.addToWorkspace")}
          </Button>
        </div>
      </form>

      <ConfirmationDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={confirmRemove}
        title={t("workspaces.removeMemberConfirmTitle", { name: removing?.name ?? "" })}
        description={t("workspaces.removeMemberConfirmDescription")}
        confirmText={t("workspaces.removeMember")}
        confirmVariant="destructive"
      />
    </DetailSection>
  );
}
