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

async function fetchWorkspace(): Promise<WorkspaceInfo> {
  const response = await fetch("/api/workspace");
  if (!response.ok) throw new ApiError(`HTTP ${response.status}`, response.status);
  return response.json();
}

export function useWorkspace(enabled = true) {
  return useQuery({
    queryKey: queryKeys.workspace,
    queryFn: fetchWorkspace,
    staleTime: 60_000,
    enabled,
    // 404 is an answer (portal host), anything else is worth a second look.
    retry: (failureCount, error) => !(error instanceof ApiError && error.status === 404) && failureCount < 2,
  });
}
