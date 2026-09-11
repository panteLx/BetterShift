"use client";

import { ReactNode, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowUpCircle, ChevronRight, FolderClosed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pill } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { UserMenu } from "@/components/user-menu";
import { AdminPageHeader, SeverityPill } from "@/components/admin/admin-kit";
import { COUNT_PAGINATION, useAdminSections } from "@/components/admin/admin-sidebar";
import { useAuditDescription } from "@/components/admin/audit-describe";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAdminAuditLogs, type AuditLogSort } from "@/hooks/useAdminAuditLogs";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import { getDateLocale } from "@/lib/locales";
import { cn } from "@/lib/utils";

const ACTIVITY_SORT: AuditLogSort = { field: "timestamp", direction: "desc" };
const ACTIVITY_PAGE = { limit: 5, offset: 0 };
const ADMIN_FILTER = { action: "admin." };
const SECURITY_FILTER = { action: "security." };

const noSubscribe = () => () => {};

function ScaleValue({ value }: { value: number | undefined }) {
  return (
    <span
      className={cn(
        "shrink-0 font-mono text-[17px] font-medium",
        !value ? "text-fg-faint" : "text-fg-strong"
      )}
    >
      {value ?? "–"}
    </span>
  );
}

function SystemItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center gap-[7px] whitespace-nowrap">
      <span className="text-[11.5px] text-fg-faint">{label}</span>
      {children}
    </div>
  );
}

export default function AdminDashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);
  const describe = useAuditDescription();
  const host = useSyncExternalStore(noSubscribe, () => window.location.host, () => "");

  const { stats } = useAdminStats();
  const { versionInfo } = useVersionUpdateCheck();
  const adminLogs = useAdminAuditLogs(ADMIN_FILTER, ACTIVITY_SORT, ACTIVITY_PAGE);
  const securityLogs = useAdminAuditLogs(SECURITY_FILTER, ACTIVITY_SORT, ACTIVITY_PAGE);
  const logsCount = useAdminAuditLogs(undefined, undefined, COUNT_PAGINATION);
  const [, usersArea, calendarsArea, logsArea] = useAdminSections();

  // Same scope as the previous preview: admin actions plus security events
  const activity = useMemo(
    () =>
      [...adminLogs.logs, ...securityLogs.logs]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, ACTIVITY_PAGE.limit),
    [adminLogs.logs, securityLogs.logs]
  );
  const activityTotal = adminLogs.total + securityLogs.total;
  const activityLoading = adminLogs.isLoading || securityLogs.isLoading;

  const orphaned = stats?.calendars.orphaned ?? 0;
  const hasUpdate = !!versionInfo?.hasUpdate && !versionInfo.isDev;
  const attentionCount = (orphaned > 0 ? 1 : 0) + (hasUpdate ? 1 : 0);

  const buildDate =
    versionInfo && versionInfo.buildDate !== "dev" && versionInfo.buildDate !== "unknown"
      ? format(new Date(versionInfo.buildDate), "PPp", { locale: dateLocale })
      : t("admin.systemInfo.unknown");

  const versionPill = versionInfo?.isDev ? (
    <Pill tone="warning" className="text-[11px]">{t("admin.systemInfo.development")}</Pill>
  ) : hasUpdate ? (
    <Pill tone="brand" className="text-[11px]">{t("admin.systemInfo.updateAvailable")}</Pill>
  ) : versionInfo ? (
    <Pill tone="success" className="text-[11px]">{t("admin.systemInfo.upToDate")}</Pill>
  ) : null;

  const githubLink = versionInfo?.githubUrl && (
    <a
      href={versionInfo.githubUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[12.5px] font-semibold text-brand-ink hover:underline"
    >
      {t("admin.systemInfo.viewOnGitHub")}
    </a>
  );

  const scaleRows = [
    {
      label: t("admin.usersMenu"),
      value: stats?.users.total,
      sub: stats
        ? t("admin.stats.usersByRole", {
            superadmin: stats.users.superadmin,
            admin: stats.users.admin,
            user: stats.users.user,
          })
        : "",
    },
    {
      label: t("admin.calendarsMenu"),
      value: stats ? stats.calendars.total + orphaned : undefined,
      sub: stats
        ? orphaned > 0
          ? t("adminDashboard.calendarsOrphaned", { count: orphaned })
          : t("adminDashboard.calendarsAllOwned")
        : "",
    },
    { label: t("common.shifts"), value: stats?.shifts.total, sub: t("adminDashboard.acrossCalendars") },
    {
      label: t("common.labels.shares"),
      value: stats?.shares.active,
      sub: stats ? t("admin.stats.sharesDescription", { user: stats.shares.user, token: stats.shares.token }) : "",
    },
    { label: t("adminDashboard.events"), value: stats?.activity.recent, sub: t("admin.stats.last7Days") },
  ];

  const areaRows = [
    { ...usersArea, sub: stats ? t("adminDashboard.usersSub", { count: stats.users.total }) : "" },
    {
      ...calendarsArea,
      sub: stats ? t("adminDashboard.calendarsSub", { count: stats.calendars.total + orphaned, orphaned }) : "",
    },
    { ...logsArea, sub: logsCount.isLoading ? "" : t("adminDashboard.logsSub", { count: logsCount.total }) },
  ];

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader
        title={
          <>
            <span className="lg:hidden">{t("admin.title")}</span>
            <span className="hidden lg:inline">{t("adminDashboard.title")}</span>
          </>
        }
        subtitle={
          <>
            <span className="font-mono lg:hidden">
              {[host, versionInfo?.version, versionInfo?.commitHash].filter(Boolean).join(" · ")}
            </span>
            <span className="hidden lg:inline">
              {attentionCount > 0
                ? t("adminDashboard.attention", { count: attentionCount })
                : t("adminDashboard.allClear")}
            </span>
          </>
        }
        actions={
          versionInfo && (
            <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
              <SystemItem label={t("admin.systemInfo.version")}>
                <span className="font-mono text-[14px] font-semibold text-fg-strong">{versionInfo.version}</span>
                {versionPill}
              </SystemItem>
              <SystemItem label={t("admin.systemInfo.buildDate")}>
                <span className="text-[14px] font-semibold text-fg-strong">{buildDate}</span>
              </SystemItem>
              <SystemItem label={t("admin.systemInfo.commitHash")}>
                <span className="font-mono text-[14px] font-semibold text-fg-strong">{versionInfo.commitHash}</span>
                {githubLink}
              </SystemItem>
            </div>
          )
        }
        mobileActions={<UserMenu />}
      />

      {orphaned > 0 && (
        <StatusBanner
          tone="warning"
          icon={FolderClosed}
          title={t("admin.orphanedCalendarsWarning")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push("/admin/calendars")}
              className="h-8 rounded-lg font-semibold"
            >
              {t("adminDashboard.openCalendars")}
            </Button>
          }
        >
          {t("admin.orphanedCalendarsWarningDescription", { count: orphaned })}
        </StatusBanner>
      )}

      {hasUpdate && versionInfo?.latestVersion && (
        <StatusBanner
          tone="info"
          icon={ArrowUpCircle}
          title={t("admin.systemInfo.updateAvailable")}
          action={
            versionInfo.latestUrl && (
              <Button variant="outline" size="sm" asChild className="h-8 rounded-lg font-semibold">
                <a href={versionInfo.latestUrl} target="_blank" rel="noopener noreferrer">
                  {t("admin.systemInfo.viewRelease")}
                </a>
              </Button>
            )
          }
        >
          {t("admin.systemInfo.latestVersion")}: <span className="font-mono">{versionInfo.latestVersion}</span>
        </StatusBanner>
      )}

      <div className="grid gap-[14px] lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-[18px]">
        {/* Recent activity */}
        <section className="flex min-w-0 flex-col gap-2 lg:gap-0 lg:overflow-hidden lg:rounded-[12px] lg:border lg:border-line lg:bg-surface-card">
          <div className="flex items-center justify-between gap-3 lg:border-b lg:border-line lg:px-4 lg:py-[13px]">
            <div className="min-w-0">
              <h2>
                <span className="eyebrow lg:hidden">{t("adminDashboard.recentShort")}</span>
                <span className="hidden text-[14px] font-semibold text-fg-strong lg:inline">
                  {t("adminDashboard.recentTitle")}
                </span>
              </h2>
              <p className="mt-0.5 hidden text-[12.5px] text-fg-tertiary lg:block">
                {t("admin.recentActivityDescription")}
              </p>
            </div>
            <Link href="/admin/logs" className="shrink-0 text-[12.5px] font-semibold text-brand-ink hover:underline">
              {t("common.viewAll")}
            </Link>
          </div>

          {activity.length === 0 ? (
            <div className="rounded-[11px] border border-line px-4 py-8 text-center text-[13px] text-fg-tertiary lg:rounded-none lg:border-0">
              {activityLoading ? t("common.loading") : t("admin.noLogsFound")}
            </div>
          ) : (
            <ul className="flex flex-col gap-2 lg:gap-0 lg:px-4 lg:pt-1">
              {activity.map((log) => (
                <li
                  key={log.id}
                  className="flex flex-col gap-[7px] rounded-[11px] border border-line bg-surface-card px-3 py-[11px] lg:flex-row lg:items-center lg:gap-3 lg:rounded-none lg:border-0 lg:border-b lg:border-line-subtle lg:bg-transparent lg:px-0 lg:py-3"
                >
                  <div className="flex items-center gap-[9px] lg:contents">
                    <SeverityPill severity={log.severity} />
                    <span className="truncate font-mono text-[12px] text-fg-tertiary lg:order-2 lg:shrink-0">
                      {log.action}
                    </span>
                    <span className="ml-auto shrink-0 whitespace-nowrap text-[11.5px] text-fg-faint lg:order-3 lg:ml-0 lg:w-[100px] lg:text-right lg:text-[12.5px]">
                      {formatDistanceToNow(log.timestamp, { addSuffix: true, locale: dateLocale })}
                    </span>
                  </div>
                  <span className="text-[13px] leading-[1.45] text-fg-body lg:order-1 lg:min-w-0 lg:flex-1 lg:truncate lg:text-[13.5px] lg:text-fg-strong">
                    {describe(log)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-auto hidden border-t border-line bg-surface-panel px-4 py-3 text-[12.5px] text-fg-tertiary lg:block">
            {t("adminDashboard.activityFooter", { shown: activity.length, count: activityTotal })}
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-[14px]">
          {/* Scale */}
          <section className="flex flex-col gap-2 lg:gap-0">
            <h2 className="eyebrow lg:hidden">{t("adminDashboard.scope")}</h2>
            <div className="overflow-hidden rounded-[11px] border border-line bg-surface-card lg:rounded-[12px]">
              <div className="eyebrow hidden border-b border-line px-[15px] py-[11px] lg:block">
                {t("adminDashboard.scope")}
              </div>
              {scaleRows.map((row) => (
                <div
                  key={row.label}
                  className="flex items-center gap-3 border-b border-line-subtle px-3 py-[9px] last:border-b-0 lg:px-[15px] lg:py-2.5"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 lg:block">
                    <div className="flex-1 text-[13px] font-semibold text-fg-body">{row.label}</div>
                    <div className="truncate text-[11.5px] text-fg-faint lg:mt-px">{row.sub}</div>
                  </div>
                  <ScaleValue value={row.value} />
                </div>
              ))}
            </div>
          </section>

          {/* Jump links; phones reach the areas through the tab bar */}
          <nav className="hidden overflow-hidden rounded-[12px] border border-line bg-surface-card lg:block">
            {areaRows.map((area) => (
              <Link
                key={area.href}
                href={area.href}
                className="flex items-center gap-[11px] border-b border-line-subtle px-[15px] py-3 transition-colors last:border-b-0 hover:bg-surface-panel"
              >
                <area.icon className="size-4 shrink-0 text-fg-secondary" />
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] font-semibold text-fg-strong">{area.label}</div>
                  <div className="mt-px truncate text-[11.5px] text-fg-tertiary">{area.sub}</div>
                </div>
                <ChevronRight className="size-4 shrink-0 text-fg-faint" />
              </Link>
            ))}
          </nav>

          {/* Phones: system details that the desktop header shows inline */}
          <section className="flex flex-col gap-2 lg:hidden">
            <h2 className="eyebrow">{t("admin.systemInfo.title")}</h2>
            <div className="flex flex-col gap-2.5 rounded-[11px] border border-line bg-surface-card px-3 py-3">
              <SystemItem label={t("admin.systemInfo.version")}>
                <span className="font-mono text-[13px] font-semibold text-fg-strong">
                  {versionInfo?.version ?? "–"}
                </span>
                {versionPill}
              </SystemItem>
              <SystemItem label={t("admin.systemInfo.buildDate")}>
                <span className="text-[13px] font-semibold text-fg-strong">{versionInfo ? buildDate : "–"}</span>
              </SystemItem>
              <SystemItem label={t("admin.systemInfo.commitHash")}>
                <span className="font-mono text-[13px] font-semibold text-fg-strong">
                  {versionInfo?.commitHash ?? "–"}
                </span>
                {githubLink}
              </SystemItem>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
