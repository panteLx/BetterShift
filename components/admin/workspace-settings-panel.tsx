"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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
import { Field, ToggleRow, inputClass } from "@/components/form-kit";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { LoadErrorBanner } from "@/components/admin/load-error-banner";
import { WorkspaceDangerZone } from "@/components/admin/workspace-danger-zone";
import { useActionErrorHandler } from "@/components/admin/workspace-action-errors";
import {
  useTransferOwnership,
  useUpdateWorkspaceSettings,
  useWorkspaceMembers,
  useWorkspaceSettings,
  type WorkspaceSettingsDto,
} from "@/hooks/useWorkspaces";

const SECTION =
  "flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-line lg:bg-surface-card";
const SECTION_HEAD = "lg:border-b lg:border-line lg:px-4 lg:py-[13px]";
const SECTION_BODY =
  "flex flex-col gap-4 rounded-[11px] border border-line bg-surface-card p-3 lg:rounded-none lg:border-0 lg:p-4";

function SectionHead({ title, description }: { title: string; description?: string }) {
  return (
    <div className={SECTION_HEAD}>
      <h2 className="eyebrow lg:hidden">{title}</h2>
      <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">{title}</span>
      {description && <p className="mt-0.5 text-[12.5px] text-fg-tertiary">{description}</p>}
    </div>
  );
}

/** Owner-only: rename, guest access, ownership transfer and deletion. */
export function WorkspaceSettingsPanel() {
  const t = useTranslations();
  const { data, isError, refetch } = useWorkspaceSettings(true);

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader title={t("admin.settingsPage.title")} />
      {isError && !data ? (
        <LoadErrorBanner item={t("admin.settingsPage.title")} onRetry={() => void refetch()} />
      ) : !data ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="size-6 animate-spin text-fg-tertiary" />
        </div>
      ) : (
        <>
          <GeneralSection settings={data} />
          <TransferSection />
          <WorkspaceDangerZone slug={data.slug} />
        </>
      )}
    </div>
  );
}

function GeneralSection({ settings }: { settings: WorkspaceSettingsDto }) {
  const t = useTranslations();
  const update = useUpdateWorkspaceSettings();
  const handleError = useActionErrorHandler();
  const [draft, setDraft] = useState<string | null>(null);
  const name = draft ?? settings.name;
  const trimmed = name.trim();
  const dirty = trimmed !== settings.name && trimmed.length > 0;

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    update.mutate(
      { name: trimmed },
      {
        onSuccess: () => {
          setDraft(null);
          toast.success(t("adminWorkspace.settings.saved"));
        },
        onError: handleError,
      }
    );
  };

  return (
    <section className={SECTION}>
      <SectionHead title={t("adminWorkspace.settings.title")} />
      <div className={SECTION_BODY}>
        <form onSubmit={save} className="flex flex-col gap-3.5">
          <Field label={t("adminWorkspace.settings.name")} htmlFor="workspace-name">
            <Input
              id="workspace-name"
              value={name}
              maxLength={64}
              onChange={(e) => setDraft(e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("workspaces.address")} htmlFor="workspace-slug" hint={t("adminWorkspace.settings.slugImmutable")}>
            <Input id="workspace-slug" value={settings.slug} readOnly disabled className={`${inputClass} font-mono`} />
          </Field>
          <Button type="submit" disabled={!dirty || update.isPending} className="h-10 self-start font-semibold">
            {t("common.save")}
          </Button>
        </form>
        <ToggleRow
          id="workspace-guest-access"
          title={t("adminWorkspace.settings.guestAccess")}
          description={settings.inheritedGuestAccess ? t("adminWorkspace.settings.guestInherited") : undefined}
          checked={settings.allowGuestAccess}
          onCheckedChange={(checked) => update.mutate({ allowGuestAccess: checked }, { onError: handleError })}
          disabled={update.isPending}
        />
      </div>
    </section>
  );
}

function TransferSection() {
  const t = useTranslations();
  const { data } = useWorkspaceMembers(true);
  const transfer = useTransferOwnership();
  const handleError = useActionErrorHandler();
  const [target, setTarget] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const candidates = data?.members.filter((m) => m.userId !== data.currentUserId) ?? [];
  const selected = candidates.find((m) => m.userId === target);
  const selectedName = selected?.name || selected?.email || "";

  const confirm = () => {
    if (!selected) return;
    transfer.mutate(selected.userId, {
      onSuccess: () => {
        setTarget("");
        toast.success(t("adminWorkspace.transfer.success"));
      },
      onError: handleError,
    });
  };

  return (
    <section className={SECTION}>
      <SectionHead title={t("adminWorkspace.transfer.title")} description={t("adminWorkspace.transfer.description")} />
      <div className={SECTION_BODY}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label={t("adminWorkspace.transfer.newOwner")} className="flex-1">
            <Select value={target} onValueChange={setTarget} disabled={candidates.length === 0}>
              <SelectTrigger className="h-10 w-full rounded-[9px]" aria-label={t("adminWorkspace.transfer.newOwner")}>
                <SelectValue placeholder={t("adminWorkspace.transfer.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name || m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Button
            type="button"
            variant="outline"
            disabled={!selected || transfer.isPending}
            onClick={() => setConfirmOpen(true)}
            className="h-10 font-semibold"
          >
            {t("adminWorkspace.transfer.button")}
          </Button>
        </div>
      </div>
      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onConfirm={confirm}
        title={t("adminWorkspace.transfer.confirmTitle", { name: selectedName })}
        description={t("adminWorkspace.transfer.confirm", { name: selectedName })}
        confirmText={t("adminWorkspace.transfer.button")}
        confirmVariant="destructive"
      />
    </section>
  );
}
