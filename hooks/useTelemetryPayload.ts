"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { DiagnosticsPayload, TelemetryPayload } from "@/lib/telemetry/schema";

async function fetchPayload(profile: string) {
  const response = await fetch(`/api/admin/telemetry/payload?profile=${profile}`);
  if (!response.ok) throw new Error(`Failed to fetch telemetry payload: ${response.status}`);
  return response.json();
}

/** Admin-only preview of the payload this instance would send; gate `enabled` to the caller's need. */
export function useTelemetryPayload(
  profile: "telemetry" | "diagnostics",
  enabled: boolean
) {
  return useQuery<TelemetryPayload | DiagnosticsPayload>({
    queryKey: queryKeys.admin.telemetryPayload(profile),
    queryFn: () => fetchPayload(profile),
    enabled,
    staleTime: 60_000,
  });
}
