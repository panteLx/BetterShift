"use client";

import { useLocale, useTranslations } from "next-intl";
import { format } from "date-fns";
import { ChevronRight } from "lucide-react";
import { AdminMobileCard, AdminTableRow, SeverityPill } from "@/components/admin/admin-kit";
import { useAuditDescription } from "@/components/admin/audit-describe";
import type { AuditLog, RoutineAuditLogBundle } from "@/hooks/useAdminAuditLogs";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

interface RoutineBundleProps {
  bundle: RoutineAuditLogBundle;
  expanded: boolean;
  /** undefined = not fetched yet, "loading" = in flight */
  entries: AuditLog[] | "loading" | undefined;
  onToggle: () => void;
  onOpenDetails: (log: AuditLog) => void;
}

function useBundleDisplay(bundle: RoutineAuditLogBundle) {
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const dateRange = `${format(bundle.firstTimestamp, "PP", { locale: dateLocale })} – ${format(bundle.lastTimestamp, "PP", { locale: dateLocale })}`;
  const badge = `sync.executed ×${new Intl.NumberFormat(locale).format(bundle.count)}`;
  return { dateRange, badge };
}

function RoutineEntriesList({
  bundle,
  entries,
  onOpenDetails,
}: {
  bundle: RoutineAuditLogBundle;
  entries: AuditLog[] | "loading" | undefined;
  onOpenDetails: (log: AuditLog) => void;
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const describe = useAuditDescription();
  const formatTimestamp = (date: Date) => format(date, "PP p", { locale: dateLocale });

  if (entries === "loading") {
    return <div className="text-[12.5px] text-fg-tertiary">{t("common.loading")}</div>;
  }

  const shown = entries ?? [];
  const remaining = bundle.count - shown.length;

  return (
    <>
      <div className="eyebrow">{t("adminAudit.routineEntries")}</div>
      {shown.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 text-[12.5px]">
          <span className="shrink-0 font-mono text-fg-tertiary">{formatTimestamp(entry.timestamp)}</span>
          <span className="min-w-0 flex-1 truncate text-fg-body">{describe(entry)}</span>
          <button
            type="button"
            onClick={() => onOpenDetails(entry)}
            className="shrink-0 font-semibold text-brand-ink hover:underline"
          >
            {t("adminAudit.details")}
          </button>
        </div>
      ))}
      {remaining > 0 && (
        <div className="text-[12px] text-fg-faint">{t("adminAudit.routineEntriesMore", { count: remaining })}</div>
      )}
    </>
  );
}

/** Desktop table row(s) standing in for every routine run of one external sync (13g). */
export function RoutineBundleRow({
  bundle,
  expanded,
  entries,
  onToggle,
  onOpenDetails,
  template,
  isSuperAdmin,
}: RoutineBundleProps & { template: string; isSuperAdmin: boolean }) {
  const t = useTranslations();
  const { dateRange, badge } = useBundleDisplay(bundle);

  return (
    <>
      <AdminTableRow template={template} onClick={onToggle}>
        {isSuperAdmin && <span />}
        <ChevronRight
          className={cn("size-[15px] transition-transform", expanded ? "rotate-90 text-fg-secondary" : "text-fg-faint")}
        />
        <span className="font-mono text-[12.5px] text-fg-body">{dateRange}</span>
        <span className="max-w-full justify-self-start truncate rounded-[6px] bg-surface-sunken px-2 py-[3px] font-mono text-[12px] font-medium text-fg-body">
          {badge}
        </span>
        <span className="truncate text-[13px] text-fg-tertiary">{t("admin.systemAction")}</span>
        <span className="justify-self-start">
          <SeverityPill severity="info" />
        </span>
        <span className="truncate text-[12.5px] text-fg-tertiary">
          {t("adminAudit.routineBundleSummary", { sync: bundle.syncName, calendar: bundle.calendarName })}
        </span>
        <span className="truncate font-mono text-[12px] text-fg-tertiary">—</span>
        <span />
      </AdminTableRow>
      {expanded && (
        <div className="flex flex-col gap-2 border-b border-line-subtle bg-surface-panel px-4 py-3">
          <RoutineEntriesList bundle={bundle} entries={entries} onOpenDetails={onOpenDetails} />
        </div>
      )}
    </>
  );
}

/** Phone card standing in for every routine run of one external sync. */
export function RoutineBundleMobileCard({ bundle, expanded, entries, onToggle, onOpenDetails }: RoutineBundleProps) {
  const t = useTranslations();
  const { dateRange, badge } = useBundleDisplay(bundle);

  return (
    <>
      <AdminMobileCard onClick={onToggle} muted>
        <div className="flex w-full items-center gap-2">
          <span className="min-w-0 truncate rounded-[6px] bg-surface-sunken px-2 py-[3px] font-mono text-[12px] font-medium text-fg-body">
            {badge}
          </span>
          <span className="flex-1" />
          <ChevronRight
            className={cn("size-4 shrink-0 transition-transform", expanded ? "rotate-90 text-fg-secondary" : "text-fg-faint")}
          />
        </div>
        <div className="text-[13.5px] leading-snug text-fg-body">
          {t("adminAudit.routineBundleSummary", { sync: bundle.syncName, calendar: bundle.calendarName })}
        </div>
        <div className="text-[12px] text-fg-tertiary">{dateRange}</div>
      </AdminMobileCard>
      {expanded && (
        <div className="flex flex-col gap-2 rounded-[11px] border border-line-subtle bg-surface-panel px-3.5 py-3">
          <RoutineEntriesList bundle={bundle} entries={entries} onOpenDetails={onOpenDetails} />
        </div>
      )}
    </>
  );
}
