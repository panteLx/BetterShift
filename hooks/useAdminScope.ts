"use client";

import { useMemo } from "react";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { useWorkspace } from "@/hooks/useWorkspace";
import { adminScopeFor, type AdminScope } from "@/lib/admin-sections";
import { isWorkspaceRole, type WorkspaceRole } from "@/lib/auth/workspace-permissions";

export function useAdminScope() {
  const config = usePublicConfig();
  const multiTenant = !!config.tenantBaseDomain;
  // /api/workspace answers 404 on the portal, which is how "global" is told apart.
  const { data, isLoading } = useWorkspace(multiTenant);
  const workspace = data ?? undefined;
  const isPortal = data === null;
  return useMemo(() => {
    const workspaceRole: WorkspaceRole | null = isWorkspaceRole(workspace?.role) ? workspace.role : null;
    const kind = !multiTenant ? "unknown" : workspace ? "workspace" : isPortal ? "portal" : null;
    const scope: AdminScope | null = kind === null ? null : adminScopeFor(multiTenant, kind);
    return { scope, workspace: workspace ?? null, workspaceRole, isLoading: multiTenant && isLoading };
  }, [multiTenant, workspace, isLoading, isPortal]);
}
