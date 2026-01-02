"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
import { FolderOpen, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { getDateLocale } from "@/lib/locales";
import { useLocale } from "next-intl";

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

  const { stats, isLoading, refetch } = useAdminStats();

  if (isLoading && !stats) {
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
        <Button
          variant="outline"
          size="icon"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className={isLoading ? "animate-spin" : ""} />
        </Button>
      </div>

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
      <StatsCardsGrid stats={stats} isLoading={isLoading} />

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
