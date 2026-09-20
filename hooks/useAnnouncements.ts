"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import type { AnnouncementPlacement, PublicAnnouncement } from "@/lib/announcements";

async function fetchAnnouncements(
  placement: AnnouncementPlacement
): Promise<PublicAnnouncement[]> {
  const response = await fetch(`/api/announcements?placement=${placement}`);
  if (!response.ok) {
    throw new Error(`Fetch /api/announcements failed: ${response.status}`);
  }
  const data = await response.json();
  return data.announcements ?? [];
}

/** Announcements are supplementary: a failure returns an empty list, never an error state. */
export function useAnnouncements(placement: AnnouncementPlacement): PublicAnnouncement[] {
  const { data } = useQuery({
    queryKey: queryKeys.announcements.byPlacement(placement),
    queryFn: () => fetchAnnouncements(placement),
    staleTime: 60 * 1000,
    retry: 1,
    // A page load, focus and reconnect already cover the liveness this needs;
    // the global background interval would otherwise poll every open tab forever.
    refetchInterval: false,
  });

  return data ?? [];
}
