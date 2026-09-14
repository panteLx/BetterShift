"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown, Copy, Info, MoreVertical, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { StatusBanner } from "@/components/status-banner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CheckRow, Field, InfoNote, SectionLabel, inputClass } from "@/components/form-kit";
import {
  useCalendarBundles,
  type PermissionBundle,
  type PermissionBundleWithUsage,
} from "@/hooks/useCalendarBundles";
import { usePermissionBundleForm } from "@/hooks/usePermissionBundleForm";
import { useBundleDisplayName } from "@/components/permission-bundle-picker";
import {
  CAPABILITY_GROUPS,
  getBlockingDependents,
  isAdminOnlyCapability,
  type Capability,
} from "@/lib/permission-bundles";
import { cn } from "@/lib/utils";

type UpdateBundle = (
  bundleId: string,
  input: { name?: string; capabilities?: Capability[] }
) => Promise<PermissionBundle>;

function BundleEditor({
  bundle,
  updateBundle,
}: {
  bundle: PermissionBundleWithUsage;
  updateBundle: UpdateBundle;
}) {
  const t = useTranslations();
  const form = usePermissionBundleForm(bundle);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateBundle(bundle.id, {
        ...(form.name.trim() !== bundle.name ? { name: form.name.trim() } : {}),
        capabilities: form.capabilities,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 border-t border-line px-3.5 py-4">
      <Field label={t("common.labels.name")} htmlFor={`bundle-name-${bundle.id}`}>
        <Input
          id={`bundle-name-${bundle.id}`}
          value={form.name}
          onChange={(e) => form.setName(e.target.value)}
          className={inputClass}
          maxLength={50}
        />
      </Field>

      {form.isGuestBound && (
        <InfoNote icon={Info}>{t("permissionBundles.guestLockedHint")}</InfoNote>
      )}
      {form.stampPresetBypassWarning && (
        <InfoNote icon={TriangleAlert}>
          {t("permissionBundles.stampPresetBypassWarning")}
        </InfoNote>
      )}

      {CAPABILITY_GROUPS.map((group) => (
        <section key={group.key} className="flex flex-col gap-2">
          <SectionLabel className="mb-0">
            {t(`permissionBundles.groups.${group.key}`)}
          </SectionLabel>
          <div className="flex flex-col gap-2.5">
            {group.capabilities.map((capability) => {
              const guestLocked = form.isGuestBound && isAdminOnlyCapability(capability);
              const blockers = guestLocked
                ? []
                : getBlockingDependents(capability, form.capabilities);
              const dependencyLocked = blockers.length > 0;
              const hint = guestLocked
                ? undefined
                : dependencyLocked
                  ? t("permissionBundles.requiredByHint", {
                      capability: t(`permissionBundles.capabilityLabels.${blockers[0]}`),
                    })
                  : t(`permissionBundles.capabilityHints.${capability}`);
              return (
                <CheckRow
                  key={capability}
                  id={`cap-${bundle.id}-${capability}`}
                  checked={form.capabilities.includes(capability)}
                  onCheckedChange={(checked) => form.toggle(capability, checked)}
                  disabled={guestLocked || dependencyLocked}
                  label={t(`permissionBundles.capabilityLabels.${capability}`)}
                  hint={hint}
                />
              );
            })}
          </div>
        </section>
      ))}

      <div className="flex gap-2">
        <Button
          variant="outline"
          className="h-10 flex-1 font-semibold"
          onClick={form.reset}
          disabled={!form.dirty || saving}
        >
          {t("common.cancel")}
        </Button>
        <Button
          className="h-10 flex-1 font-semibold"
          onClick={save}
          disabled={!form.dirty || !form.name.trim() || saving}
        >
          {saving ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </div>
  );
}

function BundleRow({
  bundle,
  expanded,
  onToggleExpand,
  onClone,
  onDelete,
  updateBundle,
}: {
  bundle: PermissionBundleWithUsage;
  expanded: boolean;
  onToggleExpand: () => void;
  onClone: () => void;
  onDelete: () => void;
  updateBundle: UpdateBundle;
}) {
  const t = useTranslations();
  const displayName = useBundleDisplayName();
  const usageCount =
    bundle.usage.shareCount + bundle.usage.tokenCount + (bundle.usage.isGuestBundle ? 1 : 0);

  return (
    <div className="rounded-[11px] border border-line">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <div
          role="button"
          tabIndex={0}
          onClick={onToggleExpand}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpand();
            }
          }}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-lg px-1.5 py-1.5 hover:bg-surface-panel"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-fg-strong">
              {displayName(bundle)}
            </span>
            <span className="block text-[12px] text-fg-tertiary">
              {t("permissionBundles.usedByCount", { count: usageCount })}
            </span>
          </span>
          <ChevronDown
            className={cn(
              "size-4 shrink-0 text-fg-tertiary transition-transform",
              expanded && "rotate-180"
            )}
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label={t("common.labels.action")}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-fg-tertiary transition-colors hover:bg-surface-panel data-[state=open]:bg-surface-panel"
          >
            <MoreVertical className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onClone} className="gap-2.5">
              <Copy className="size-4" />
              {t("permissionBundles.clone")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="gap-2.5 text-danger focus:text-danger">
              <Trash2 className="size-4 text-danger" />
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {expanded && <BundleEditor bundle={bundle} updateBundle={updateBundle} />}
    </div>
  );
}

/** "Gruppen" tab: bundle list, create/clone/delete, and the capability editor. */
export function PermissionBundleEditor({ calendarId }: { calendarId: string }) {
  const t = useTranslations();
  const { bundles, isError, createBundle, cloneBundle, deleteBundle, updateBundle } =
    useCalendarBundles(calendarId);
  const displayName = useBundleDisplayName();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [bundleToDelete, setBundleToDelete] = useState<PermissionBundleWithUsage | null>(null);

  if (isError) {
    return (
      <StatusBanner tone="danger" icon={TriangleAlert}>
        {t("permissionBundles.bundlesUnavailable")}
      </StatusBanner>
    );
  }

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name) return;
    const created = await createBundle({ name, capabilities: [] });
    setNewName("");
    setCreating(false);
    setExpandedId(created.id);
  };

  const handleClone = async (bundle: PermissionBundleWithUsage) => {
    const suggested = `${displayName(bundle)} ${t("permissionBundles.cloneSuffix")}`;
    const cloned = await cloneBundle(bundle.id, suggested);
    setExpandedId(cloned.id);
  };

  return (
    <div className="flex flex-col gap-3">
      {bundles.map((bundle) => (
        <BundleRow
          key={bundle.id}
          bundle={bundle}
          expanded={expandedId === bundle.id}
          onToggleExpand={() => setExpandedId((id) => (id === bundle.id ? null : bundle.id))}
          onClone={() => handleClone(bundle)}
          onDelete={() => setBundleToDelete(bundle)}
          updateBundle={updateBundle}
        />
      ))}

      {creating ? (
        <div className="flex gap-2">
          <Input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("permissionBundles.newBundleNamePlaceholder")}
            className={cn(inputClass, "min-w-0 flex-1")}
            maxLength={50}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <Button onClick={handleCreate} disabled={!newName.trim()} className="h-10 shrink-0 font-semibold">
            {t("common.save")}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCreating(false);
              setNewName("");
            }}
            className="h-10 shrink-0 font-semibold"
          >
            {t("common.cancel")}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          onClick={() => setCreating(true)}
          className="h-10 justify-start gap-2 font-semibold"
        >
          <Plus className="size-4" />
          {t("permissionBundles.newBundle")}
        </Button>
      )}

      {bundleToDelete && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => !open && setBundleToDelete(null)}
          onConfirm={async () => {
            await deleteBundle(bundleToDelete.id);
            setBundleToDelete(null);
          }}
          title={t("permissionBundles.deleteConfirmTitle")}
          description={t("permissionBundles.deleteConfirmDesc", {
            name: displayName(bundleToDelete) ?? "",
          })}
          confirmVariant="destructive"
          confirmText={t("common.delete")}
        />
      )}
    </div>
  );
}
