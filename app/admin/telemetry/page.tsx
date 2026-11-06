"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/form-kit";
import { AdminPageHeader } from "@/components/admin/admin-kit";
import { useAdminScope } from "@/hooks/useAdminScope";
import { useSystemSettings } from "@/hooks/useSystemSettings";
import { useTelemetryPayload } from "@/hooks/useTelemetryPayload";
import { useTelemetrySend } from "@/hooks/useTelemetrySend";
import type { DiagnosticsPayload } from "@/lib/telemetry/schema";

// Upstream repo for prefilled issue links; a self-hosted fork's GITHUB_REPO_OWNER/NAME
// override isn't available client-side, so this always points at the canonical project.
const GITHUB_ISSUE_URL = "https://github.com/panteLx/BetterShift/issues/new";
// GitHub truncates query strings past roughly this length.
const MAX_ISSUE_URL_LENGTH = 6000;

export default function AdminTelemetryPage() {
  const { scope } = useAdminScope();
  // The telemetry endpoints do not exist on workspace hosts.
  if (scope !== "instance" && scope !== "global") return null;
  return <TelemetryPanel />;
}

function TelemetryPanel() {
  const t = useTranslations();
  const { settings, updateSettings, isUpdating } = useSystemSettings();

  // Resolved server-side: an env override wins over the stored value here too.
  const telemetryEnabled = settings?.telemetryResolved === true;
  const { data: telemetryPreview } = useTelemetryPayload("telemetry", true);
  const { sendNow, isSending } = useTelemetrySend();
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const { data: diagnostics } = useTelemetryPayload("diagnostics", diagnosticsOpen) as {
    data: DiagnosticsPayload | undefined;
  };
  const [includeInstanceId, setIncludeInstanceId] = useState(true);
  // No instance id exists unless telemetry is actually on, regardless of stale server data.
  const diagnosticsBody: DiagnosticsPayload | null = diagnostics
    ? { ...diagnostics, instanceId: telemetryEnabled && includeInstanceId ? diagnostics.instanceId : null }
    : null;

  const copyDiagnostics = async () => {
    if (!diagnosticsBody) return;
    try {
      await navigator.clipboard.writeText(
        "```json\n" + JSON.stringify(diagnosticsBody, null, 2) + "\n```"
      );
      toast.success(t("admin.telemetry.copied"));
    } catch (error) {
      console.error("Failed to copy diagnostics:", error);
      toast.error(t("common.error"));
    }
  };

  const issueHref = diagnosticsBody
    ? `${GITHUB_ISSUE_URL}?body=${encodeURIComponent(
        "\n\n<details><summary>Diagnostics</summary>\n\n```json\n" +
          JSON.stringify(diagnosticsBody, null, 2) +
          "\n```\n\n</details>"
      )}`
    : null;
  const issueHrefTooLong = (issueHref?.length ?? 0) > MAX_ISSUE_URL_LENGTH;

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader title={t("admin.telemetryPage.title")} />

      <section className="flex flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-line lg:bg-surface-card">
        <div className="lg:border-b lg:border-line lg:px-4 lg:py-[13px]">
          <h2 className="eyebrow lg:hidden">{t("admin.telemetry.title")}</h2>
          <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">
            {t("admin.telemetry.title")}
          </span>
          <p className="mt-0.5 text-[12.5px] text-fg-tertiary">{t("admin.telemetry.description")}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-[11px] border border-line bg-surface-card p-3 lg:rounded-none lg:border-0 lg:p-4">
          <ToggleRow
            id="telemetry-enabled"
            title={t("admin.telemetry.toggleLabel")}
            description={
              settings?.telemetryEnvManaged
                ? t("admin.telemetry.envManaged")
                : settings?.telemetryEnabled === null
                  ? t("admin.telemetry.notDecided")
                  : undefined
            }
            checked={telemetryEnabled}
            onCheckedChange={(checked) => updateSettings({ telemetryEnabled: checked })}
            disabled={!settings || isUpdating || settings.telemetryEnvManaged}
          />

          <details className="rounded-lg border border-line">
            <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-fg-secondary">
              {t("admin.telemetry.previewTitle")}
            </summary>
            <pre className="max-h-[240px] overflow-auto rounded-b-lg border-t border-line bg-surface-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-fg-tertiary">
              {telemetryPreview ? JSON.stringify(telemetryPreview, null, 2) : t("common.loading")}
            </pre>
          </details>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg font-semibold"
              disabled={!telemetryEnabled || isSending}
              onClick={() => sendNow()}
            >
              {t("admin.telemetry.sendNow")}
            </Button>
            {!telemetryEnabled && (
              <span className="text-[12.5px] text-fg-tertiary">{t("admin.telemetry.sendNowHint")}</span>
            )}
          </div>

          <div className="h-px bg-line-subtle" />

          <div className="flex flex-col gap-1">
            <span className="block text-[14px] font-semibold text-fg-strong">
              {t("admin.telemetry.diagnosticsTitle")}
            </span>
            <p className="text-[12.5px] text-fg-secondary">{t("admin.telemetry.diagnosticsDescription")}</p>
          </div>

          {telemetryEnabled && (
            <ToggleRow
              id="telemetry-include-instance-id"
              title={t("admin.telemetry.includeInstanceId")}
              description={t("admin.telemetry.includeInstanceIdHint")}
              checked={includeInstanceId}
              onCheckedChange={setIncludeInstanceId}
            />
          )}

          <details
            className="rounded-lg border border-line"
            onToggle={(event) => setDiagnosticsOpen(event.currentTarget.open)}
          >
            <summary className="cursor-pointer select-none px-3 py-2 text-[13px] font-medium text-fg-secondary">
              {t("admin.telemetry.diagnosticsPreviewTitle")}
            </summary>
            <pre className="max-h-[240px] overflow-auto rounded-b-lg border-t border-line bg-surface-panel px-3 py-2.5 text-[11.5px] leading-relaxed text-fg-tertiary">
              {diagnosticsBody ? JSON.stringify(diagnosticsBody, null, 2) : t("common.loading")}
            </pre>
          </details>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 rounded-lg font-semibold"
              disabled={!diagnosticsBody}
              onClick={copyDiagnostics}
            >
              {t("admin.telemetry.copy")}
            </Button>
            {issueHref && !issueHrefTooLong && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg font-semibold">
                <a href={issueHref} target="_blank" rel="noopener noreferrer">
                  {t("admin.telemetry.openIssue")}
                </a>
              </Button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
