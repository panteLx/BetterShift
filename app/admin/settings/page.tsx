"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ChoiceChips, Field, ToggleRow } from "@/components/form-kit";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { WorkspaceSettingsPanel } from "@/components/admin/workspace-settings-panel";
import { SystemInfoItems } from "@/components/admin/system-kit";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import type { UpdateBannerVisibility } from "@/lib/system-settings";

const SECTION =
  "flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-line lg:bg-surface-card";
const SECTION_HEAD = "lg:border-b lg:border-line lg:px-4 lg:py-[13px]";
const SECTION_BODY =
  "flex flex-col gap-4 rounded-[11px] border border-line bg-surface-card p-3 lg:rounded-none lg:border-0 lg:p-4";

export default function AdminSettingsPage() {
  const { scope, workspaceRole, isLoading } = useAdminScope();
  const router = useRouter();
  const ownerOnlyBlocked = scope === "workspace" && !isLoading && workspaceRole !== "owner";

  useEffect(() => {
    if (ownerOnlyBlocked) router.replace("/admin");
  }, [ownerOnlyBlocked, router]);

  if (scope === null || isLoading) return null;
  // The instance settings hooks would 404 on workspace hosts.
  if (scope === "workspace") return workspaceRole === "owner" ? <WorkspaceSettingsPanel /> : null;
  return <InstanceSettings global={scope === "global"} />;
}

function InstanceSettings({ global }: { global: boolean }) {
  const t = useTranslations();
  const { versionInfo } = useVersionUpdateCheck();
  const { settings, updateSettings, isUpdating } = useSystemSettings();

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader title={t("admin.settingsPage.title")} />

      <section className={SECTION}>
        <div className={SECTION_HEAD}>
          <h2 className="eyebrow lg:hidden">{t("admin.systemInfo.title")}</h2>
          <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">
            {t("admin.systemInfo.title")}
          </span>
        </div>
        <div className="flex flex-col gap-2.5 rounded-[11px] border border-line bg-surface-card px-3 py-3 lg:flex-row lg:flex-wrap lg:gap-x-6 lg:rounded-none lg:border-0 lg:p-4">
          <SystemInfoItems versionInfo={versionInfo} compact />
        </div>
      </section>

      <section className={SECTION}>
        <div className={SECTION_HEAD}>
          <h2 className="eyebrow lg:hidden">{t("admin.guestAccess.title")}</h2>
          <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">
            {t("admin.guestAccess.title")}
          </span>
          <p className="mt-0.5 text-[12.5px] text-fg-tertiary">
            {global ? t("admin.guestAccess.workspaceDefaultDescription") : t("admin.guestAccess.description")}
          </p>
        </div>
        <div className={SECTION_BODY}>
          <ToggleRow
            id="allow-guest-access"
            title={t("admin.guestAccess.toggleLabel")}
            description={t("admin.guestAccess.toggleHint")}
            checked={settings?.allowGuestAccess ?? false}
            onCheckedChange={(checked) => updateSettings({ allowGuestAccess: checked })}
            disabled={!settings || isUpdating}
          />
        </div>
      </section>

      <section className={SECTION}>
        <div className={SECTION_HEAD}>
          <h2 className="eyebrow lg:hidden">{t("admin.systemSettings.title")}</h2>
          <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">
            {t("admin.systemSettings.title")}
          </span>
          <p className="mt-0.5 text-[12.5px] text-fg-tertiary">{t("admin.systemSettings.description")}</p>
        </div>
        <div className={SECTION_BODY}>
          <ToggleRow
            id="update-check-enabled"
            title={t("admin.systemSettings.checkEnabled")}
            description={t("admin.systemSettings.checkEnabledHint")}
            checked={settings?.updateCheckEnabled ?? true}
            onCheckedChange={(checked) => updateSettings({ updateCheckEnabled: checked })}
            disabled={!settings || isUpdating}
          />
          <Field label={t("admin.systemSettings.visibility")}>
            <ChoiceChips<UpdateBannerVisibility>
              value={settings?.updateBannerVisibility ?? "all"}
              onChange={(updateBannerVisibility) => updateSettings({ updateBannerVisibility })}
              disabled={!settings || isUpdating || !settings.updateCheckEnabled}
              options={[
                { value: "all", label: t("admin.systemSettings.visibilityAll") },
                { value: "admins", label: t("admin.systemSettings.visibilityAdmins") },
              ]}
            />
          </Field>
        </div>
      </section>
    </div>
  );
}
