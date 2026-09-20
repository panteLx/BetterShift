"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { queryKeys } from "@/lib/query-keys";
import { handleRateLimitError } from "@/lib/rate-limit-client";
import type { AnnouncementTone } from "@/lib/announcements";

// Same shape as in hooks/useCalendarBundles.ts: carries the 429 response so
// onError can render the rate-limit toast instead of the generic one.
class RateLimitError extends Error {
  constructor(public response: Response) {
    super("Rate limit exceeded");
    this.name = "RateLimitError";
  }
}

async function throwIfFailed(response: Response) {
  if (response.ok) return;
  if (response.status === 429) throw new RateLimitError(response);
  throw new Error(await response.text());
}

export interface AdminAnnouncement {
  id: string;
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  showOnAuth: boolean;
  showOnDashboard: boolean;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  createdByName: string | null;
}

export interface AnnouncementPayload {
  title: string;
  body: string | null;
  tone: AnnouncementTone;
  showOnAuth: boolean;
  showOnDashboard: boolean;
  enabled: boolean;
  startsAt: string | null;
  endsAt: string | null;
}

async function fetchAdminAnnouncements(): Promise<AdminAnnouncement[]> {
  const response = await fetch("/api/admin/announcements");
  if (!response.ok) throw new Error(`Fetch admin announcements failed: ${response.status}`);
  const data = await response.json();
  return data.announcements ?? [];
}

export function useAdminAnnouncements() {
  const { data, isLoading } = useQuery({
    queryKey: queryKeys.admin.announcements,
    queryFn: fetchAdminAnnouncements,
  });
  return { announcements: data ?? [], isLoading };
}

export function useAdminAnnouncementActions() {
  const t = useTranslations();
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.admin.announcements });
    // The reader lists are served by a different route and must refetch too.
    queryClient.invalidateQueries({ queryKey: queryKeys.announcements.all });
  };

  /** Cancels the in-flight list query, snapshots it and applies `patch`. */
  const snapshotAndPatch = async (patch: (list: AdminAnnouncement[]) => AdminAnnouncement[]) => {
    await queryClient.cancelQueries({ queryKey: queryKeys.admin.announcements });
    const previous = queryClient.getQueryData<AdminAnnouncement[]>(queryKeys.admin.announcements);
    queryClient.setQueryData<AdminAnnouncement[]>(queryKeys.admin.announcements, (old) =>
      patch(old ?? [])
    );
    return previous;
  };

  const restore = (previous: AdminAnnouncement[] | undefined) =>
    queryClient.setQueryData(queryKeys.admin.announcements, previous);

  const createMutation = useMutation({
    mutationFn: async (payload: AnnouncementPayload) => {
      const response = await fetch("/api/admin/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await throwIfFailed(response);
      return response.json();
    },
    onMutate: async (payload) => {
      const optimistic: AdminAnnouncement = {
        id: `optimistic-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString(),
        createdByName: null,
      };
      return { previous: await snapshotAndPatch((list) => [optimistic, ...list]) };
    },
    onError: async (err, variables, context) => {
      restore(context?.previous);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("admin.announcements.saveError"));
    },
    onSettled: invalidate,
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...payload }: AnnouncementPayload & { id: string }) => {
      const response = await fetch(`/api/admin/announcements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      await throwIfFailed(response);
      return response.json();
    },
    onMutate: async ({ id, ...payload }) => ({
      previous: await snapshotAndPatch((list) =>
        list.map((item) => (item.id === id ? { ...item, ...payload } : item))
      ),
    }),
    onError: async (err, variables, context) => {
      restore(context?.previous);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("admin.announcements.saveError"));
    },
    onSettled: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/admin/announcements/${id}`, { method: "DELETE" });
      await throwIfFailed(response);
      return response.json();
    },
    onMutate: async (id) => ({
      previous: await snapshotAndPatch((list) => list.filter((item) => item.id !== id)),
    }),
    onError: async (err, variables, context) => {
      restore(context?.previous);
      if (err instanceof RateLimitError) {
        await handleRateLimitError(err.response, t);
        return;
      }
      toast.error(t("admin.announcements.deleteError"));
    },
    onSettled: invalidate,
  });

  return {
    createAnnouncement: createMutation.mutateAsync,
    updateAnnouncement: updateMutation.mutateAsync,
    deleteAnnouncement: deleteMutation.mutateAsync,
    isSaving: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
