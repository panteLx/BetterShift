"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { toast } from "sonner";
import { Ban, Copy, Link2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedControl } from "@/components/segmented-control";
import { Field, InfoNote, ListRow, Pill, RowIconButton, SectionLabel, inputClass } from "@/components/form-kit";
import { LoadErrorBanner } from "@/components/admin/load-error-banner";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import {
  useCreateJoinLink,
  useJoinLinks,
  useRevokeJoinLink,
  useWorkspaceMembers,
  type CreateJoinLinkInput,
  type JoinLinkDto,
} from "@/hooks/useWorkspaces";
import { canCreateJoinLink, canRevokeJoinLink, isWorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

const EXPIRY_OPTIONS = ["never", "1", "7", "30"] as const;
const MAX_USES_OPTIONS = ["unlimited", "1", "5", "10", "25", "50", "100"] as const;
type ExpiryOption = (typeof EXPIRY_OPTIONS)[number];
type MaxUsesOption = (typeof MAX_USES_OPTIONS)[number];
type LinkRole = "member" | "admin";

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
  const [role, setRole] = useState<LinkRole>("member");

  const toInput = (): CreateJoinLinkInput => ({
    name: name.trim() || null,
    expiresInDays: expiry === "never" ? null : (Number(expiry) as 1 | 7 | 30),
    maxUses: maxUses === "unlimited" ? null : Number(maxUses),
    role,
  });
  const reset = () => {
    setName("");
    setExpiry("7");
    setMaxUses("unlimited");
    setRole("member");
  };

  return { name, setName, expiry, setExpiry, maxUses, setMaxUses, role, setRole, toInput, reset };
}

/** Create form and list of invite links; the admin role option and revoke follow the viewer's role. */
export function WorkspaceJoinLinksPanel({ enabled = true }: { enabled?: boolean }) {
  const t = useTranslations();
  const { data, isError, refetch } = useJoinLinks(enabled);
  const { data: members } = useWorkspaceMembers(enabled);
  const createLink = useCreateJoinLink();
  const handleError = useActionErrorHandler();
  const linkUrl = useJoinLinkUrl();
  const form = useJoinLinkForm();
  const actor = isWorkspaceRole(members?.currentRole) ? members.currentRole : null;

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
        {canCreateJoinLink(actor, "admin") && (
          <Field label={t("adminWorkspace.links.role")}>
            <SegmentedControl
              value={form.role}
              onChange={form.setRole}
              label={t("adminWorkspace.links.role")}
              options={[
                { value: "member", label: t("adminWorkspace.links.roleMember") },
                { value: "admin", label: t("adminWorkspace.links.roleAdmin") },
              ]}
            />
          </Field>
        )}
        <Button type="submit" disabled={createLink.isPending} className="h-10 gap-2 font-semibold">
          {createLink.isPending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          {t("adminWorkspace.links.create")}
        </Button>
      </form>

      <section>
        <SectionLabel>{t("adminWorkspace.links.title")}</SectionLabel>
        {isError && !data ? (
          <LoadErrorBanner item={t("adminWorkspace.links.title")} onRetry={() => void refetch()} />
        ) : !data ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-5 animate-spin text-fg-tertiary" />
          </div>
        ) : data.links.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-fg-tertiary">{t("workspaces.linksEmpty")}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {data.links.map((link) => (
              <JoinLinkRow
                key={link.id}
                link={link}
                canRevoke={canRevokeJoinLink(actor, link.role)}
                onCopy={() => copyLink(link)}
                onError={handleError}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function JoinLinkRow({
  link,
  canRevoke,
  onCopy,
  onError,
}: {
  link: JoinLinkDto;
  canRevoke: boolean;
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
          <Pill tone={link.role === "admin" ? "violet" : "neutral"}>
            {link.role === "admin" ? t("adminWorkspace.links.roleAdmin") : t("adminWorkspace.links.roleMember")}
          </Pill>
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
          {canRevoke && (
            <RowIconButton
              icon={Ban}
              tone="danger"
              label={t("workspaces.linkRevoke")}
              disabled={revokeLink.isPending}
              onClick={() => revokeLink.mutate(link.id, { onError })}
            />
          )}
        </div>
      )}
    </ListRow>
  );
}
