"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";

export interface WorkspaceInfo {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  multiTenant: boolean;
}

// null = the portal host, which has no workspace. Kept as data, not an error: an errored query
// without data flips back to "pending" on every refetch, which remounted the admin shell in a loop.
async function fetchWorkspace(): Promise<WorkspaceInfo | null> {
  const response = await fetch("/api/workspace");
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
  return response.json();
}

export function useWorkspace(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspace,
    queryFn: fetchWorkspace,
    staleTime: 60_000,
    enabled,
    retry: 2,
  });
}
