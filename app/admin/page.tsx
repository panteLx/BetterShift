"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { StatsCardsGrid } from "@/components/admin/stats-cards";
import { useAdminStats } from "@/hooks/useAdminStats";
import {
  FolderOpen,
  RefreshCw,
  Info,
  ExternalLink,
  GitCommit,
  Calendar as CalendarIcon,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

interface VersionInfo {
  version: string;
  commitHash: string;
  buildDate: string;
  githubUrl: string;
  isDev: boolean;
  latestVersion?: string;
  latestUrl?: string;
  hasUpdate?: boolean;
}

/**
 * Admin Dashboard Page
 *
 * Displays system statistics and quick actions.
 * Implemented in Phase 9.3
 */
export default function AdminDashboardPage() {
  const t = useTranslations();
  const router = useRouter();
  const locale = useLocale();
  const dateLocale = getDateLocale(locale);

  const { stats, isLoading: isLoadingStats } = useAdminStats();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [isLoadingVersion, setIsLoadingVersion] = useState(true);

  // Fetch version info
  useEffect(() => {
    fetchVersionInfo();
  }, []);

  const fetchVersionInfo = async () => {
    try {
      const response = await fetch("/api/version");
      if (!response.ok) return;
      const data = await response.json();
      setVersionInfo(data);
    } catch (error) {
      console.error("Failed to fetch version info:", error);
    } finally {
      setIsLoadingVersion(false);
    }
  };

  if (isLoadingStats && !stats) {
    return <FullscreenLoader />;
  }

  const hasOrphanedCalendars = stats && stats.calendars.orphaned > 0;

  return (
    <div className="space-y-6">
      {/* Welcome Message */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {t("admin.dashboard")}
          </h2>
          <p className="text-muted-foreground mt-2">
            {t("admin.dashboardDescription")}
          </p>
        </div>
      </div>

      {/* System Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div>
                <CardTitle className="pb-3">
                  {t("admin.systemInfo.title")}
                </CardTitle>
                <CardDescription>
                  {t("admin.systemInfo.description")}
                </CardDescription>
              </div>
            </div>
            {versionInfo?.hasUpdate && !versionInfo.isDev && (
              <Badge variant="default" className="gap-1">
                <AlertCircle className="h-3 w-3" />
                {t("admin.systemInfo.updateAvailable")}
              </Badge>
            )}
            {versionInfo && !versionInfo.hasUpdate && !versionInfo.isDev && (
              <Badge variant="secondary" className="gap-1">
                <CheckCircle className="h-3 w-3" />
                {t("admin.systemInfo.upToDate")}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingVersion ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" />
              {t("common.loading")}
            </div>
          ) : versionInfo ? (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Version */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4" />
                  {t("admin.systemInfo.version")}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-lg font-semibold font-mono">
                    {versionInfo.version}
                  </code>
                  {versionInfo.isDev && (
                    <Badge variant="outline">
                      {t("admin.systemInfo.development")}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Build Date */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarIcon className="h-4 w-4" />
                  {t("admin.systemInfo.buildDate")}
                </div>
                <div className="text-lg font-semibold">
                  {versionInfo.buildDate !== "dev" &&
                  versionInfo.buildDate !== "unknown"
                    ? format(new Date(versionInfo.buildDate), "PPp", {
                        locale: dateLocale,
                      })
                    : t("admin.systemInfo.unknown")}
                </div>
              </div>

              {/* Commit Hash */}
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitCommit className="h-4 w-4" />
                  {t("admin.systemInfo.commitHash")}
                </div>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                    {versionInfo.commitHash}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 gap-1"
                    asChild
                  >
                    <a
                      href={versionInfo.githubUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-3 w-3" />
                      {t("admin.systemInfo.viewOnGitHub")}
                    </a>
                  </Button>
                </div>
              </div>

              {/* Latest Version (if available) */}
              {versionInfo.latestVersion && !versionInfo.isDev && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Info className="h-4 w-4" />
                    {t("admin.systemInfo.latestVersion")}
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-lg font-semibold font-mono">
                      {versionInfo.latestVersion}
                    </code>
                    {versionInfo.latestUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1"
                        asChild
                      >
                        <a
                          href={versionInfo.latestUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3 w-3" />
                          {t("admin.systemInfo.viewRelease")}
                        </a>
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {t("admin.systemInfo.unknown")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Orphaned Calendars Warning */}
      {hasOrphanedCalendars && (
        <Card className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950/20">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderOpen className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                <div>
                  <CardTitle className="text-yellow-900 dark:text-yellow-100">
                    {t("admin.orphanedCalendarsWarning")}
                  </CardTitle>
                  <CardDescription className="text-yellow-700 dark:text-yellow-300">
                    {t("admin.orphanedCalendarsWarningDescription", {
                      count: stats!.calendars.orphaned,
                    })}
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => router.push("/admin/calendars")}
                className="border-yellow-600 text-yellow-900 hover:bg-yellow-100 dark:text-yellow-100 dark:hover:bg-yellow-900/30"
              >
                {t("admin.manageOrphanedCalendars")}
              </Button>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* Stats Cards */}
      <StatsCardsGrid stats={stats} isLoading={isLoadingStats} />

      {/* Recent Activity Preview */}
      {stats?.activity.logs && stats.activity.logs.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("admin.stats.recentActivity")}</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/admin/logs")}
              >
                {t("common.viewAll")}
              </Button>
            </div>
            <CardDescription>
              {t("admin.recentActivityDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.activity.logs.map((log, index) => (
                <div key={log.id}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={
                          log.severity === "error"
                            ? "destructive"
                            : log.severity === "warning"
                            ? "outline"
                            : "secondary"
                        }
                      >
                        {log.severity}
                      </Badge>
                      <div className="text-sm">
                        <span className="font-medium">{log.action}</span>
                        {log.resourceType && (
                          <span className="text-muted-foreground">
                            {" "}
                            • {log.resourceType}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(log.timestamp, {
                        addSuffix: true,
                        locale: dateLocale,
                      })}
                    </span>
                  </div>
                  {index < stats.activity.logs.length - 1 && (
                    <Separator className="mt-3" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
