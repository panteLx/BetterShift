"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Users,
  Calendar,
  Share2,
  FolderOpen,
  Clock,
  Activity,
  LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AdminStats } from "@/hooks/useAdminStats";

interface StatsCardProps {
  title: string;
  value: number | string;
  description?: string;
  icon: LucideIcon;
  variant?: "default" | "warning" | "success" | "info";
  href?: string;
  badge?: {
    text: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  isLoading?: boolean;
}

/**
 * Individual Stats Card Component
 *
 * Displays a single statistic with optional click navigation.
 */
function StatsCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
  href,
  badge,
  isLoading = false,
}: StatsCardProps) {
  const router = useRouter();

  const variantColors = {
    default: "text-blue-600 dark:text-blue-400",
    warning: "text-yellow-600 dark:text-yellow-400",
    success: "text-green-600 dark:text-green-400",
    info: "text-cyan-600 dark:text-cyan-400",
  };

  const handleClick = () => {
    if (href) {
      router.push(href);
    }
  };

  return (
    <Card
      className={cn(
        "transition-all",
        href && "cursor-pointer hover:shadow-md hover:scale-[1.02]"
      )}
      onClick={handleClick}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", variantColors[variant])} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground">-</div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{value}</div>
              {badge && (
                <Badge variant={badge.variant} className="text-xs">
                  {badge.text}
                </Badge>
              )}
            </div>
            {description && (
              <p className="text-xs text-muted-foreground mt-1">
                {description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface StatsCardsGridProps {
  stats: AdminStats | null;
  isLoading: boolean;
}

/**
 * Admin Stats Cards Grid
 *
 * Displays system statistics in a responsive grid layout.
 *
 * Features:
 * - Responsive layout (1 col mobile, 2-3 cols desktop)
 * - Color-coded by importance/type
 * - Clickable cards navigate to relevant pages
 * - Loading skeleton states
 * - Warning indicators (e.g., orphaned calendars)
 */
export function StatsCardsGrid({ stats, isLoading }: StatsCardsGridProps) {
  const t = useTranslations();

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Total Users */}
      <StatsCard
        title={t("admin.stats.totalUsers")}
        value={isLoading ? "-" : stats?.users.total || 0}
        description={
          isLoading
            ? undefined
            : t("admin.stats.usersByRole", {
                superadmin: stats?.users.superadmin || 0,
                admin: stats?.users.admin || 0,
                user: stats?.users.user || 0,
              })
        }
        icon={Users}
        variant="info"
        href="/admin/users"
        isLoading={isLoading}
      />

      {/* Total Calendars */}
      <StatsCard
        title={t("admin.stats.totalCalendars")}
        value={isLoading ? "-" : stats?.calendars.total || 0}
        description={t("admin.stats.calendarsDescription")}
        icon={Calendar}
        variant="default"
        href="/admin/calendars"
        isLoading={isLoading}
      />

      {/* Active Shares */}
      <StatsCard
        title={t("admin.stats.activeShares")}
        value={isLoading ? "-" : stats?.shares.active || 0}
        description={
          isLoading
            ? undefined
            : t("admin.stats.sharesDescription", {
                user: stats?.shares.user || 0,
                token: stats?.shares.token || 0,
              })
        }
        icon={Share2}
        variant="success"
        isLoading={isLoading}
      />

      {/* Orphaned Calendars */}
      <StatsCard
        title={t("admin.stats.orphanedCalendars")}
        value={isLoading ? "-" : stats?.calendars.orphaned || 0}
        description={t("admin.stats.orphanedDescription")}
        icon={FolderOpen}
        variant={
          !isLoading && stats && stats.calendars.orphaned > 0
            ? "warning"
            : "default"
        }
        href="/admin/calendars"
        badge={
          !isLoading && stats && stats.calendars.orphaned > 0
            ? {
                text: t("admin.stats.needsAttention"),
                variant: "destructive",
              }
            : undefined
        }
        isLoading={isLoading}
      />

      {/* Total Shifts */}
      <StatsCard
        title={t("admin.stats.totalShifts")}
        value={isLoading ? "-" : stats?.shifts.total || 0}
        description={t("admin.stats.shiftsDescription")}
        icon={Clock}
        variant="default"
        isLoading={isLoading}
      />

      {/* Recent Activity */}
      <StatsCard
        title={t("admin.stats.recentActivity")}
        value={isLoading ? "-" : stats?.activity.recent || 0}
        description={t("admin.stats.last7Days")}
        icon={Activity}
        variant="info"
        href="/admin/logs"
        isLoading={isLoading}
      />
    </div>
  );
}
