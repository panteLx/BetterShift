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

export function useWorkspace() {
  return useQuery({
    queryKey: queryKeys.workspace,
    queryFn: fetchWorkspace,
    staleTime: 60_000,
  });
}
