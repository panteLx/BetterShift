"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { CustomFieldDefinition } from "@/lib/custom-fields";

async function fetchCustomFields(calendarId: string): Promise<CustomFieldDefinition[]> {
  const response = await fetch(`/api/calendars/${calendarId}/custom-fields`);
  if (!response.ok) throw new Error("Failed to fetch custom fields");
  return response.json();
}

export function useCustomFields(calendarId: string | null) {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.customFields.byCalendar(calendarId ?? ""),
    queryFn: () => fetchCustomFields(calendarId as string),
    enabled: !!calendarId,
  });

  return { customFields: data ?? [], isLoading };
}
