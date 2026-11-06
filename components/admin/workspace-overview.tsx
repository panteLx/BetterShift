"use client";

import { useTranslations } from "next-intl";
import { AdminPageHeader, StatTile } from "@/components/admin/admin-kit";
import { LoadErrorBanner } from "@/components/admin/load-error-banner";
import { useWorkspaceStats } from "@/hooks/useWorkspaces";

export function WorkspaceOverviewPage() {
  const t = useTranslations();
  const { data, isError, refetch } = useWorkspaceStats(true);

  const tiles = [
    { key: "members", label: t("adminWorkspace.overview.members"), value: data?.members },
    { key: "calendars", label: t("adminWorkspace.overview.calendars"), value: data?.calendars },
    { key: "shifts", label: t("adminWorkspace.overview.shifts"), value: data?.shifts },
    { key: "links", label: t("adminWorkspace.overview.activeLinks"), value: data?.activeJoinLinks },
  ];

  return (
    <div className="flex flex-col gap-[14px] lg:gap-[18px]">
      <AdminPageHeader title={t("adminWorkspace.title")} />
      {isError && !data ? (
        <LoadErrorBanner item={t("adminWorkspace.title")} onRetry={() => void refetch()} />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {tiles.map((tile) =>
            tile.value === undefined ? (
              <div key={tile.key} className="h-[62px] animate-pulse rounded-[10px] border border-line bg-surface-sunken" />
            ) : (
              <StatTile key={tile.key} label={tile.label} value={tile.value} />
            )
          )}
        </div>
      )}
    </div>
  );
}
