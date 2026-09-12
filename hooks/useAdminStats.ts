"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { queryKeys } from "@/lib/query-keys";
import { BACKGROUND_REFETCH_INTERVAL } from "@/lib/query-client";
import { AdminRequestError } from "@/lib/admin-list";
import { useAdminErrorToast } from "@/hooks/useAdminList";

export interface AdminActivityLog {
  id: string;
  action: string;
  resourceType: string | null;
  resourceId: string | null;
  userId: string | null;
  metadata: unknown;
  severity: string;
  timestamp: Date;
}

export interface AdminStats {
  users: {
    superadmin: number;
    admin: number;
    user: number;
    total: number;
  };
  calendars: {
    /** Calendars with an owner; orphaned ones are counted separately */
    total: number;
    orphaned: number;
  };
  shares: {
    user: number;
    token: number;
    active: number;
  };
  shifts: {
    total: number;
  };
  activity: {
    /** Audit entries of the last 7 days */
    recent: number;
    /** Admin actions and security events, the scope of `logs` */
    total: number;
    logs: AdminActivityLog[];
  };
  auditLogs: {
    total: number;
  };
}

async function fetchAdminStats(): Promise<AdminStats> {
  const response = await fetch("/api/admin/stats");
  if (!response.ok) throw new AdminRequestError(response.status);

  const data = await response.json();
  return {
    ...data,
    activity: {
      ...data.activity,
      logs: data.activity.logs.map((log: AdminActivityLog & { timestamp: string }) => ({
        ...log,
        timestamp: new Date(log.timestamp),
      })),
    },
  };
}

/**
 * System-wide statistics for the dashboard and sidebar, polled. Several components
 * observe the same query; a failure still shows a single toast.
 */
export function useAdminStats() {
  const t = useTranslations();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: queryKeys.admin.stats,
    queryFn: fetchAdminStats,
    refetchInterval: BACKGROUND_REFETCH_INTERVAL,
  });

  useAdminErrorToast(error, "admin-stats-error", t("admin.statsFetchError"));

  return {
    stats: data ?? null,
    isLoading,
    error,
    refetch,
  };
}
