"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Ban, Copy, Link2, Loader2, LogOut, Plus, UserMinus } from "lucide-react";
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
import { PanelBody, PanelDialog, PanelFooter } from "@/components/panel-dialog";
import { SegmentedControl } from "@/components/segmented-control";
import { Field, InfoNote, ListRow, Pill, RowIconButton, SectionLabel, inputClass } from "@/components/form-kit";
import { PersonRow } from "@/components/person-row";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  WorkspaceApiError,
  useCreateJoinLink,
  useJoinLinks,
  useLeaveWorkspace,
  useRemoveMember,
  useRevokeJoinLink,
  useWorkspaceMembers,
  type CreateJoinLinkInput,
  type JoinLinkDto,
  type WorkspaceMemberDto,
} from "@/hooks/useWorkspaces";
import { handleRateLimitError } from "@/lib/rate-limit-client";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

interface WorkspaceSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type WorkspaceTab = "members" | "links";

const EXPIRY_OPTIONS = ["never", "1", "7", "30"] as const;
const MAX_USES_OPTIONS = ["unlimited", "1", "5", "10", "25", "50", "100"] as const;
type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];
type MaxUsesOption = (typeof MAX_USES_OPTIONS)[number];

function useActionErrorHandler() {
  const t = useTranslations();
  return async (error: unknown) => {
    if (error instanceof WorkspaceApiError && error.rateLimitResponse) {
      await handleRateLimitError(error.rateLimitResponse, t);
      return;
    }
    toast.error(t("workspaces.actionError"));
  };
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // The Clipboard API needs a secure context; fall back to the legacy copy command.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function useJoinLinkUrl() {
  const config = usePublicConfig();
  // Links point at the portal, where joining happens, not at the workspace host.
  return (link: JoinLinkDto) => `${config.auth.url.replace(/\/$/, "")}/join/${link.token}`;
}

function useJoinLinkForm() {
  const [name, setName] = useState("");
  const [expiry, setExpiry] = useState<ExpiryOption>("7");
  const [maxUses, setMaxUses] = useState<MaxUsesOption>("unlimited");

  const toInput = (): CreateJoinLinkInput => ({
    name: name.trim() || null,
    expiresInDays: expiry === "never" ? null : (Number(expiry) as 1 | 7 | 30),
    maxUses: maxUses === "unlimited" ? null : Number(maxUses),
  });
  const reset = () => {
    setName("");
    setExpiry("7");
    setMaxUses("unlimited");
  };

  return { name, setName, expiry, setExpiry, maxUses, setMaxUses, toInput, reset };
}

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
        <MembersTab open={open} isManager={isManager} workspaceName={workspace?.name ?? ""} />
      ) : (
        <LinksTab open={open && isManager} />
      )}
    </PanelDialog>
  );
}

function roleLabel(t: ReturnType<typeof useTranslations>, role: string) {
  if (role === "owner") return t("workspaces.roleOwner");
  if (role === "admin") return t("workspaces.roleAdmin");
  return t("workspaces.roleMember");
}

function MembersTab({
  open,
  isManager,
  workspaceName,
}: {
  open: boolean;
  isManager: boolean;
  workspaceName: string;
}) {
  const t = useTranslations();
  const config = usePublicConfig();
  const { data, isLoading } = useWorkspaceMembers(open);
  const removeMember = useRemoveMember();
  const leaveWorkspace = useLeaveWorkspace();
  const handleError = useActionErrorHandler();
  // Kept after closing so the dialog title doesn't change during the close animation
  const [removing, setRemoving] = useState<WorkspaceMemberDto | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  const confirmRemove = () => {
    if (!removing) return;
    removeMember.mutate(removing.userId, {
      onSuccess: () => toast.success(t("workspaces.removeMemberSuccess")),
      onError: handleError,
    });
  };

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
        {isLoading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="size-6 animate-spin text-fg-tertiary" />
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {data.members.map((member) => {
              const isSelf = member.userId === data.currentUserId;
              const canRemove = isManager && member.role !== "owner" && !isSelf;
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
                      <Pill tone={member.role === "owner" ? "violet" : "neutral"}>
                        {roleLabel(t, member.role)}
                      </Pill>
                      {canRemove && (
                        <RowIconButton
                          icon={UserMinus}
                          tone="danger"
                          label={t("workspaces.removeMember")}
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
        )}
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
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        onConfirm={confirmRemove}
        title={t("workspaces.removeMemberConfirmTitle", { name: removing?.name || removing?.email || "" })}
        description={t("workspaces.removeMemberConfirmDescription")}
        confirmText={t("workspaces.removeMember")}
        confirmVariant="destructive"
      />
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

function LinksTab({ open }: { open: boolean }) {
  const t = useTranslations();
  const { data, isLoading } = useJoinLinks(open);
  const createLink = useCreateJoinLink();
  const handleError = useActionErrorHandler();
  const linkUrl = useJoinLinkUrl();
  const form = useJoinLinkForm();

  const copyLink = async (link: JoinLinkDto) => {
    if (await copyToClipboard(linkUrl(link))) toast.success(t("workspaces.linkCopied"));
    else toast.error(t("workspaces.actionError"));
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    createLink.mutate(form.toInput(), {
      onSuccess: async ({ link }) => {
        form.reset();
        await copyLink(link);
      },
      onError: handleError,
    });
  };

  return (
    <PanelBody className="min-h-[260px]">
      <div className="flex flex-col gap-5">
        <InfoNote icon={Link2}>{t("workspaces.linksHint")}</InfoNote>

        <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
          <Field label={t("workspaces.linkName")} htmlFor="join-link-name">
            <Input
              id="join-link-name"
              value={form.name}
              maxLength={64}
              onChange={(e) => form.setName(e.target.value)}
              className={inputClass}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("workspaces.linkExpiry")}>
              <Select value={form.expiry} onValueChange={(v) => form.setExpiry(v as ExpiryOption)}>
                <SelectTrigger className="h-10 w-full rounded-[9px]" aria-label={t("workspaces.linkExpiry")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "never"
                        ? t("workspaces.linkExpiryNever")
                        : t("workspaces.linkExpiryDays", { days: Number(option) })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("workspaces.linkMaxUses")}>
              <Select value={form.maxUses} onValueChange={(v) => form.setMaxUses(v as MaxUsesOption)}>
                <SelectTrigger className="h-10 w-full rounded-[9px]" aria-label={t("workspaces.linkMaxUses")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MAX_USES_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option === "unlimited" ? t("workspaces.linkMaxUsesUnlimited") : option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Button type="submit" disabled={createLink.isPending} className="h-10 gap-2 font-semibold">
            {createLink.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            {t("workspaces.linkCreate")}
          </Button>
        </form>

        <section>
          <SectionLabel>{t("workspaces.linksTab")}</SectionLabel>
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-5 animate-spin text-fg-tertiary" />
            </div>
          ) : data.links.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-fg-tertiary">{t("workspaces.linksEmpty")}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {data.links.map((link) => (
                <JoinLinkRow key={link.id} link={link} onCopy={() => copyLink(link)} onError={handleError} />
              ))}
            </div>
          )}
        </section>
      </div>
    </PanelBody>
  );
}

function JoinLinkRow({
  link,
  onCopy,
  onError,
}: {
  link: JoinLinkDto;
  onCopy: () => void;
  onError: (error: unknown) => Promise<void>;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const revokeLink = useRevokeJoinLink();
  const active = link.status === "active";

  let status;
  if (link.status === "active") status = <Pill tone="success">{t("workspaces.linkStatusActive")}</Pill>;
  else if (link.status === "revoked") status = <Pill tone="danger">{t("workspaces.linkStatusRevoked")}</Pill>;
  else if (link.status === "expired") status = <Pill>{t("workspaces.linkStatusExpired")}</Pill>;
  else status = <Pill>{t("workspaces.linkStatusExhausted")}</Pill>;

  const usage =
    link.maxUses === null
      ? t("workspaces.linkUsageUnlimited", { used: link.usageCount })
      : t("workspaces.linkUsage", { used: link.usageCount, max: link.maxUses });

  return (
    <ListRow>
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn("truncate text-[14px] font-semibold", active ? "text-fg-strong" : "text-fg-secondary")}>
            {link.name || "—"}
          </span>
          {status}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-2 text-[12px] text-fg-tertiary">
          <span>{usage}</span>
          {link.expiresAt && (
            <span>
              {t("workspaces.linkExpires", {
                date: format(new Date(link.expiresAt), "PPP", { locale: getDateLocale(locale) }),
              })}
            </span>
          )}
        </div>
      </div>
      {active && (
        <div className="flex shrink-0 items-center gap-0.5">
          <RowIconButton icon={Copy} label={t("workspaces.linkCopy")} onClick={onCopy} />
          <RowIconButton
            icon={Ban}
            tone="danger"
            label={t("workspaces.linkRevoke")}
            disabled={revokeLink.isPending}
            onClick={() => revokeLink.mutate(link.id, { onError })}
          />
        </div>
      )}
    </ListRow>
  );
}
