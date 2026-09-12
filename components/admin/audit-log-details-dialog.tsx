"use client";

import { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/form-kit";
import { AdminDetailPanel } from "@/components/admin/admin-detail-panel";
import { SeverityPill, UserAvatar } from "@/components/admin/admin-kit";
import { useAuditDescription } from "@/components/admin/audit-describe";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";
import type { AuditLog } from "@/hooks/useAdminAuditLogs";

interface AuditLogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: AuditLog;
}

function DetailRow({ label, children, mono }: { label: string; children: ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-line-subtle px-3.5 py-2.5 last:border-b-0">
      <span className="shrink-0 text-[12.5px] text-fg-tertiary">{label}</span>
      <span
        className={cn(
          "min-w-0 break-all text-right text-fg-body",
          mono ? "font-mono text-[12px]" : "text-[13px]"
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function AuditLogDetailsDialog({ open, onOpenChange, log }: AuditLogDetailsDialogProps) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const describe = useAuditDescription();

  const copyToClipboard = () => {
    const jsonString = JSON.stringify(
      {
        id: log.id,
        action: log.action,
        timestamp: log.timestamp,
        severity: log.severity,
        userId: log.userId,
        userName: log.userName,
        userEmail: log.userEmail,
        resourceType: log.resourceType,
        resourceId: log.resourceId,
        metadata: log.metadata,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        isUserVisible: log.isUserVisible,
      },
      null,
      2
    );

    navigator.clipboard.writeText(jsonString);
    toast.success(t("common.copied", { item: t("admin.metadata") }));
  };

  return (
    <AdminDetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.auditLogDetails")}
      subtitle={format(new Date(log.timestamp), "PPpp", { locale: dateLocale })}
      footer={
        <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 flex-1 font-semibold">
          {t("common.close")}
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-[6px] bg-surface-sunken px-2 py-[3px] font-mono text-[12px] font-medium text-fg-body">
            {log.action}
          </span>
          <SeverityPill severity={log.severity} />
        </div>
        <p className="text-[14px] leading-snug text-fg-strong">{describe(log)}</p>
      </div>

      <div>
        <SectionLabel>{t("common.labels.user")}</SectionLabel>
        {log.userId != null ? (
          <div className="flex items-center gap-3 rounded-[11px] border border-line px-3.5 py-3">
            <UserAvatar name={log.userName} image={log.userImage} size={36} />
            <div className="min-w-0">
              <div className="truncate text-[13.5px] font-semibold text-fg-strong">
                {log.userName || t("admin.unknownUser")}
              </div>
              <div className="truncate text-[12.5px] text-fg-tertiary">{log.userEmail || "—"}</div>
            </div>
          </div>
        ) : (
          <div className="rounded-[11px] border border-line px-3.5 py-3 text-[13px] text-fg-secondary">
            {t("admin.systemAction")}
          </div>
        )}
      </div>

      <div>
        <SectionLabel>{t("adminAudit.details")}</SectionLabel>
        <div className="overflow-hidden rounded-[11px] border border-line">
          {log.resourceType != null && (
            <>
              <DetailRow label={t("admin.resourceType")}>{log.resourceType}</DetailRow>
              <DetailRow label={t("admin.resourceId")} mono>
                {log.resourceId || "—"}
              </DetailRow>
            </>
          )}
          {log.ipAddress != null && (
            <DetailRow label={t("common.labels.ipAddress")} mono>
              {log.ipAddress}
            </DetailRow>
          )}
          <DetailRow label={t("admin.userVisible")}>{log.isUserVisible ? t("common.yes") : t("common.no")}</DetailRow>
          <DetailRow label={t("admin.logId")} mono>
            {log.id}
          </DetailRow>
        </div>
        {log.userAgent != null && (
          <p className="mt-2 break-all text-[12px] leading-relaxed text-fg-tertiary">
            <span className="font-semibold text-fg-secondary">{t("admin.userAgent")}:</span> {log.userAgent}
          </p>
        )}
      </div>

      {log.metadata != null && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <SectionLabel className="mb-0">{t("admin.metadata")}</SectionLabel>
            <Button variant="ghost" size="sm" onClick={copyToClipboard} className="h-7 gap-1.5 px-2 text-fg-secondary">
              <Copy className="size-3.5" />
              {t("common.copy")}
            </Button>
          </div>
          <pre className="overflow-x-auto rounded-[10px] border border-line bg-surface-panel p-3 font-mono text-[12px] leading-relaxed text-fg-body">
            {JSON.stringify(log.metadata, null, 2)}
          </pre>
        </div>
      )}
    </AdminDetailPanel>
  );
}
