"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { FullscreenLoader } from "@/components/fullscreen-loader";
import { AdminPageHeader, AdminSearch } from "@/components/admin/admin-kit";
import { LoadErrorBanner } from "@/components/admin/load-error-banner";
import { WorkspaceTable } from "@/components/admin/workspace-table";
import { WorkspaceDeleteDialog, WorkspaceDetailSheet } from "@/components/admin/workspace-detail-sheet";
import { useAdminWorkspaces } from "@/hooks/useAdminWorkspaces";

export default function AdminWorkspacesPage() {
  const t = useTranslations();
  const { data, isLoading, isError, refetch } = useAdminWorkspaces();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const workspaces = useMemo(() => data?.workspaces ?? [], [data]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return workspaces;
    return workspaces.filter(
      (w) =>
        w.name.toLowerCase().includes(q) ||
        w.slug.toLowerCase().includes(q) ||
        (w.owner?.email.toLowerCase().includes(q) ?? false)
    );
  }, [workspaces, search]);
  const selected = workspaces.find((w) => w.id === selectedId) ?? null;

  if (isLoading) return <FullscreenLoader />;
  if (isError && !data) {
    return <LoadErrorBanner item={t("admin.workspacesMenu")} onRetry={() => void refetch()} />;
  }

  const openDetails = (id: string) => {
    setSelectedId(id);
    setDetailsOpen(true);
  };
  const openDelete = (id: string) => {
    setSelectedId(id);
    setDeleteOpen(true);
  };

  return (
    <>
      <div className="flex flex-col gap-4">
        <AdminPageHeader
          title={t("admin.workspacesMenu")}
          subtitle={t("admin.workspaces.subtitle", { count: workspaces.length })}
        />
        <AdminSearch value={search} onChange={setSearch} placeholder={t("admin.workspaces.searchPlaceholder")} className="lg:w-[340px]" />
        <WorkspaceTable
          workspaces={filtered}
          onWorkspaceClick={(w) => openDetails(w.id)}
          onDeleteWorkspace={(w) => openDelete(w.id)}
          emptyMessage={search.trim() ? t("admin.workspaces.noSearchResults") : t("admin.workspaces.empty")}
        />
      </div>

      {selected && (
        <>
          <WorkspaceDetailSheet
            key={`details-${selected.id}`}
            open={detailsOpen}
            onOpenChange={setDetailsOpen}
            workspace={selected}
            onDelete={() => {
              setDetailsOpen(false);
              setDeleteOpen(true);
            }}
          />
          <WorkspaceDeleteDialog workspace={selected} open={deleteOpen} onOpenChange={setDeleteOpen} />
        </>
      )}
    </>
  );
}
