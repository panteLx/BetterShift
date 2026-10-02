"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Crown, ExternalLink, Loader2, Plus, Trash2, UserMinus } from "lucide-react";
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
import { DangerZone, Field, Pill, RowIconButton, inputClass } from "@/components/form-kit";
import { PersonRow } from "@/components/person-row";
import { AdminDetailPanel } from "@/components/admin/admin-detail-panel";
import { ConfirmNameDeleteDialog } from "@/components/admin/confirm-name-delete-dialog";
import { DetailSection } from "@/components/admin/admin-kit";
import { isDefaultWorkspace } from "@/components/admin/workspace-table";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";
import {
  useAdminDeleteWorkspace,
  useAdminAddWorkspaceMember,
  useAdminChangeWorkspaceSlug,
  useAdminRemoveWorkspaceMember,
  useAdminRenameWorkspace,
  useAdminTransferWorkspace,
  useAdminWorkspaceMembers,
  type AdminWorkspaceRow,
} from "@/hooks/useAdminWorkspaces";
import {
  WorkspaceApiError,
  useSlugAvailability,
  useWorkspaceHref,
  type WorkspaceMemberDto,
} from "@/hooks/useWorkspaces";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { isValidSlugFormat } from "@/lib/workspace-slugs";
import { handleRateLimitError } from "@/lib/rate-limit-client";

const KNOWN_ERRORS = [
  "forbidden",
  "default",
  "not_found",
  "workspace_not_found",
  "user_not_found",
  "already_member",
  "owner",
  "self",
  "not_member",
  "invalid_name",
  "invalid_email",
  "has_owner",
  "slug_immutable",
  "invalid",
  "reserved",
  "taken",
  "confirmation_mismatch",
  "busy",
] as const;

/** Toasts the admin workspace API's error `code`, or a generic message. */
function useErrorHandler() {
  const t = useTranslations();
  return async (error: unknown) => {
    if (error instanceof WorkspaceApiError) {
      if (error.rateLimitResponse) {
        await handleRateLimitError(error.rateLimitResponse, t);
        return;
      }
      if (error.code && (KNOWN_ERRORS as readonly string[]).includes(error.code)) {
        toast.error(t(`admin.workspaces.errors.${error.code as (typeof KNOWN_ERRORS)[number]}`));
        return;
      }
    }
    toast.error(t("workspaces.actionError"));
  };
}

const ROLE_TONE = { owner: "warning", admin: "violet", member: "neutral" } as const;

function roleOf(member: WorkspaceMemberDto): keyof typeof ROLE_TONE {
  return member.role === "owner" || member.role === "admin" ? member.role : "member";
}

/** Deleting needs the slug typed back; superadmin-only, so callers hide the entry points otherwise. */
export function WorkspaceDeleteDialog({
  workspace,
  open,
  onOpenChange,
}: {
  workspace: AdminWorkspaceRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations();
  const deleteWorkspace = useAdminDeleteWorkspace();
  const handleError = useErrorHandler();

  const handleDelete = async () => {
    try {
      await deleteWorkspace.mutateAsync({ id: workspace.id, confirmSlug: workspace.slug });
      toast.success(t("admin.workspaces.deleted"));
    } catch (error) {
      await handleError(error);
    }
  };

  return (
    <ConfirmNameDeleteDialog
      open={open}
      onOpenChange={onOpenChange}
      name={workspace.slug}
      idPrefix="admin-workspace-delete"
      title={t("admin.workspaces.deleteTitle")}
      description={t("admin.workspaces.deleteConfirmDescription", { slug: workspace.slug })}
      warning={t("admin.workspaces.deleteWarning", {
        members: workspace.memberCount,
        calendars: workspace.calendarCount,
      })}
      understoodLabel={t("admin.workspaces.deleteUnderstood")}
      confirmationLabel={t("admin.workspaces.deleteConfirmation", { slug: workspace.slug })}
      confirmationHint={t("admin.workspaces.deleteConfirmationHint")}
      confirmLabel={t("admin.workspaces.deleteConfirm")}
      onConfirm={handleDelete}
    />
  );
}

const SLUG_DEBOUNCE_MS = 400;

/** Ownerless workspace (the default one after enabling MULTI_TENANT): pick a member or enter an email. */
function OwnerAssignSection({ workspace, members }: { workspace: AdminWorkspaceRow; members: WorkspaceMemberDto[] }) {
  const t = useTranslations();
  const handleError = useErrorHandler();
  const transfer = useAdminTransferWorkspace();
  const [memberId, setMemberId] = useState("");
  const [email, setEmail] = useState("");
  const trimmed = email.trim();
  const canSubmit = (!!memberId || !!trimmed) && !transfer.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    transfer.mutate(
      { id: workspace.id, ...(trimmed ? { email: trimmed } : { userId: memberId }) },
      {
        onSuccess: () => {
          toast.success(t("admin.workspaces.ownerAssigned"));
          setEmail("");
          setMemberId("");
        },
        onError: handleError,
      }
    );
  };

  return (
    <DetailSection label={t("admin.workspaces.ownerSection")}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-[11px] border border-warning-line bg-warning-surface p-3">
        <p className="text-[13px] text-warning-title">{t("admin.workspaces.ownerSectionHint")}</p>
        {members.length > 0 && (
          <Field label={t("admin.workspaces.ownerPickMember")} htmlFor="admin-workspace-owner-member">
            <Select
              value={memberId}
              onValueChange={(v) => {
                setMemberId(v);
                setEmail("");
              }}
            >
              <SelectTrigger id="admin-workspace-owner-member" className="h-10 min-w-0 rounded-[9px]">
                <SelectValue placeholder={t("admin.workspaces.ownerPickPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        <Field label={t("admin.workspaces.ownerByEmail")} htmlFor="admin-workspace-owner-email">
          <Input
            id="admin-workspace-owner-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (e.target.value) setMemberId("");
            }}
            className={inputClass}
          />
        </Field>
        <Button type="submit" disabled={!canSubmit} className="h-10 gap-2 self-start font-semibold">
          {transfer.isPending ? <Loader2 className="size-4 animate-spin" /> : <Crown className="size-4" />}
          {t("admin.workspaces.ownerSetButton")}
        </Button>
      </form>
    </DetailSection>
  );
}

/** The default workspace is the only one whose address can change. */
function AddressSection({ workspace }: { workspace: AdminWorkspaceRow }) {
  const t = useTranslations();
  const handleError = useErrorHandler();
  const href = useWorkspaceHref();
  const { tenantBaseDomain } = usePublicConfig();
  const changeSlug = useAdminChangeWorkspaceSlug();
  const [slug, setSlug] = useState(workspace.slug);
  const [debounced, setDebounced] = useState(slug);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(slug), SLUG_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [slug]);

  const changed = slug !== workspace.slug;
  const debouncedValid = isValidSlugFormat(debounced);
  const availability = useSlugAvailability(debounced, changed && debouncedValid);
  const settled = debounced === slug;
  const status = changed && settled && debouncedValid ? availability.data?.status : undefined;
  const hint = (() => {
    if (!changed || !slug || !settled) return null;
    if (!debouncedValid || status === "invalid") return { ok: false, text: t("workspaces.slugInvalid") };
    if (status === "available") return { ok: true, text: t("workspaces.slugAvailable") };
    if (status === "taken") return { ok: false, text: t("workspaces.slugTaken") };
    if (status === "reserved") return { ok: false, text: t("workspaces.slugReserved") };
    return null;
  })();
  const canSave = changed && isValidSlugFormat(slug) && status !== "taken" && status !== "reserved" && !changeSlug.isPending;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave) return;
    changeSlug.mutate(
      { id: workspace.id, slug },
      { onSuccess: () => toast.success(t("admin.workspaces.addressChanged")), onError: handleError }
    );
  };

  return (
    <DetailSection label={t("admin.workspaces.addressSection")}>
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <a
          href={href(workspace.slug)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 self-start break-all font-mono text-[12.5px] text-brand-ink hover:underline"
        >
          {href(workspace.slug).replace(/\/$/, "")}
          <ExternalLink className="size-3.5 shrink-0" />
        </a>
        <Field label={t("workspaces.address")} htmlFor="admin-workspace-slug" hint={t("workspaces.slugHint")}>
          <div className="flex items-stretch gap-2">
            <Input
              id="admin-workspace-slug"
              autoComplete="off"
              spellCheck={false}
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
              maxLength={32}
              className={`${inputClass} font-mono`}
            />
            {tenantBaseDomain && (
              <span className="flex items-center font-mono text-[12.5px] text-fg-tertiary">.{tenantBaseDomain}</span>
            )}
          </div>
        </Field>
        {hint && <p className={hint.ok ? "text-[12.5px] text-success" : "text-[12.5px] text-danger"}>{hint.text}</p>}
        <p className="text-[12.5px] text-fg-tertiary">{t("admin.workspaces.addressWarning", { slug: slug || "…", domain: tenantBaseDomain ?? "" })}</p>
        <Button type="submit" disabled={!canSave} className="h-10 self-start font-semibold">
          {changeSlug.isPending ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
        </Button>
      </form>
    </DetailSection>
  );
}

interface WorkspaceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspace: AdminWorkspaceRow;
  onDelete: () => void;
}

export function WorkspaceDetailSheet({ open, onOpenChange, workspace, onDelete }: WorkspaceDetailSheetProps) {
  const t = useTranslations();
  const isSuperAdmin = useIsSuperAdmin();
  const handleError = useErrorHandler();
  const { data, isLoading } = useAdminWorkspaceMembers(workspace.id, open);
  const rename = useAdminRenameWorkspace();
  const transfer = useAdminTransferWorkspace();
  const addMember = useAdminAddWorkspaceMember();
  const removeMember = useAdminRemoveWorkspaceMember();

  const [name, setName] = useState(workspace.name);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  // Kept after closing so the dialog text doesn't change during the close animation
  const [removing, setRemoving] = useState<WorkspaceMemberDto | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [promoting, setPromoting] = useState<WorkspaceMemberDto | null>(null);
  const [promoteOpen, setPromoteOpen] = useState(false);

  const trimmedName = name.trim();
  const canSaveName = trimmedName !== "" && trimmedName !== workspace.name && !rename.isPending;
  const label = (m: WorkspaceMemberDto) => m.name || m.email;

  const handleRename = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSaveName) return;
    rename.mutate(
      { id: workspace.id, name: trimmedName },
      { onSuccess: () => toast.success(t("admin.workspaces.renamed")), onError: handleError }
    );
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;
    addMember.mutate(
      { id: workspace.id, email: trimmed, role },
      {
        onSuccess: () => {
          toast.success(t("admin.workspaces.memberAdded"));
          setEmail("");
          setRole("member");
        },
        onError: handleError,
      }
    );
  };

  return (
    <AdminDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={workspace.name}
      subtitle={<span className="font-mono">{workspace.slug}</span>}
    >
      <DetailSection label={t("admin.workspaces.nameSection")}>
        <form onSubmit={handleRename} className="flex items-center gap-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={64}
            aria-label={t("admin.workspaces.nameSection")}
            className={inputClass}
          />
          <Button type="submit" disabled={!canSaveName} className="h-10 shrink-0 font-semibold">
            {rename.isPending ? <Loader2 className="size-4 animate-spin" /> : t("common.save")}
          </Button>
        </form>
      </DetailSection>

      {isDefaultWorkspace(workspace) && !workspace.owner && data && (
        <OwnerAssignSection workspace={workspace} members={data.members} />
      )}

      {isDefaultWorkspace(workspace) && <AddressSection key={workspace.slug} workspace={workspace} />}

      <DetailSection label={t("admin.workspaces.membersSection", { count: workspace.memberCount })}>
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-fg-tertiary" />
          </div>
        ) : (
          data.members.map((member) => {
            const memberRole = roleOf(member);
            return (
              <PersonRow
                key={member.userId}
                user={member}
                action={
                  <div className="flex shrink-0 items-center gap-1">
                    <Pill tone={ROLE_TONE[memberRole]}>{t(`adminWorkspace.members.role.${memberRole}`)}</Pill>
                    {memberRole !== "owner" && (
                      <>
                        <RowIconButton
                          icon={Crown}
                          label={t("admin.workspaces.makeOwner")}
                          onClick={() => {
                            setPromoting(member);
                            setPromoteOpen(true);
                          }}
                        />
                        <RowIconButton
                          icon={UserMinus}
                          tone="danger"
                          label={t("adminWorkspace.members.remove")}
                          onClick={() => {
                            setRemoving(member);
                            setRemoveOpen(true);
                          }}
                        />
                      </>
                    )}
                  </div>
                }
              />
            );
          })
        )}
      </DetailSection>

      <DetailSection label={t("admin.workspaces.addMember")}>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <Field label={t("admin.workspaces.memberEmail")} htmlFor="admin-workspace-member-email">
            <Input
              id="admin-workspace-member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="flex items-center gap-3">
            <Select value={role} onValueChange={(v) => setRole(v as "member" | "admin")}>
              <SelectTrigger className="h-10 min-w-0 flex-1 rounded-[9px]" aria-label={t("adminWorkspace.members.changeRole")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">{t("adminWorkspace.members.role.member")}</SelectItem>
                <SelectItem value="admin">{t("adminWorkspace.members.role.admin")}</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={addMember.isPending || !email.trim()} className="h-10 shrink-0 gap-2 font-semibold">
              {addMember.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              {t("admin.workspaces.addMemberButton")}
            </Button>
          </div>
        </form>
      </DetailSection>

      {isSuperAdmin && !isDefaultWorkspace(workspace) && (
        <DangerZone
          icon={Trash2}
          title={t("admin.workspaces.deleteTitle")}
          description={t("admin.workspaces.deleteDescription")}
          action={
            <Button variant="destructive" className="h-9 font-semibold" onClick={onDelete}>
              {t("adminWorkspace.deleteButton")}
            </Button>
          }
        />
      )}

      <ConfirmationDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={() =>
          removing &&
          removeMember.mutate(
            { id: workspace.id, userId: removing.userId },
            { onSuccess: () => toast.success(t("workspaces.removeMemberSuccess")), onError: handleError }
          )
        }
        title={t("workspaces.removeMemberConfirmTitle", { name: removing ? label(removing) : "" })}
        description={t("workspaces.removeMemberConfirmDescription")}
        confirmText={t("adminWorkspace.members.remove")}
        confirmVariant="destructive"
      />
      <ConfirmationDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        onConfirm={() =>
          promoting &&
          transfer.mutate(
            { id: workspace.id, userId: promoting.userId },
            { onSuccess: () => toast.success(t("admin.workspaces.ownerTransferred")), onError: handleError }
          )
        }
        title={t("admin.workspaces.transferTitle", { name: promoting ? label(promoting) : "" })}
        description={workspace.owner ? t("admin.workspaces.transferDescription") : t("admin.workspaces.assignOwnerDescription")}
        confirmText={t("admin.workspaces.makeOwner")}
      />
    </AdminDetailPanel>
  );
}
