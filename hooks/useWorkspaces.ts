"use client";

import { useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { ApiError } from "@/lib/api-error";
import { isRateLimitError } from "@/lib/rate-limit-client";
import { usePublicConfig } from "@/hooks/usePublicConfig";
import { workspaceOrigin } from "@/lib/workspace-url";
import type { JoinLinkDto } from "@/lib/workspace-join-links";
import type { MyWorkspace, SlugAvailability } from "@/lib/workspaces";

export interface MyWorkspacesResponse {
  workspaces: MyWorkspace[];
  ownedCount: number;
  maxOwned: number;
}

export interface JoinLinkInfo {
  workspace: { name: string; slug: string };
  alreadyMember: boolean;
}

// Type-only re-exports: the server modules never reach the client bundle.
export type { JoinLinkDto, MyWorkspace, SlugAvailability };

/** Error carrying the API's machine-readable `code`, mapped to i18n keys by the caller. */
export class WorkspaceApiError extends ApiError {
  constructor(
    message: string,
    status: number,
    public readonly code: string | null,
    /** Unread 429 response, for handleRateLimitError(). */
    public readonly rateLimitResponse: Response | null = null
  ) {
    super(message, status);
    this.name = "WorkspaceApiError";
  }
}

export async function workspaceFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
  });
  if (isRateLimitError(response)) {
    throw new WorkspaceApiError("Rate limit exceeded", 429, "rate_limited", response);
  }
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new WorkspaceApiError(json?.error ?? `HTTP ${response.status}`, response.status, json?.code ?? null);
  }
  return json as T;
}

export function useWorkspaceHref(): (slug: string) => string {
  const config = usePublicConfig();
  return useCallback(
    (slug: string) => `${workspaceOrigin(slug, config.auth.url, config.tenantBaseDomain ?? "")}/`,
    [config.auth.url, config.tenantBaseDomain]
  );
}

export function useMyWorkspaces(source: "portal" | "workspace", enabled = true) {
  // Both endpoints return the same list and a page only ever runs on one host, so one key suffices.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return useQuery({
    queryKey: queryKeys.workspaces.mine,
    queryFn: () =>
      workspaceFetch<MyWorkspacesResponse>(source === "portal" ? "/api/workspaces" : "/api/workspace/mine"),
    staleTime: 60_000,
    enabled,
  });
}

export function useSlugAvailability(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.slug(slug),
    queryFn: () =>
      workspaceFetch<{ slug: string; status: SlugAvailability }>(
        `/api/workspaces/slug-availability?slug=${encodeURIComponent(slug)}`
      ),
    enabled,
    staleTime: 10_000,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { name: string; slug: string }) =>
      workspaceFetch<{ workspace: MyWorkspace }>("/api/workspaces", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine }),
  });
}

export function useJoinLinkInfo(token: string) {
  return useQuery({
    queryKey: queryKeys.workspaces.join(token),
    queryFn: () => workspaceFetch<JoinLinkInfo>(`/api/join/${encodeURIComponent(token)}`),
    retry: false,
  });
}

export function useRedeemJoinLink(token: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      workspaceFetch<JoinLinkInfo>(`/api/join/${encodeURIComponent(token)}`, { method: "POST" }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine }),
  });
}

export interface WorkspaceMemberDto {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
  joinedAt: string;
}

interface MembersResponse {
  members: WorkspaceMemberDto[];
  currentUserId: string;
  currentRole: string;
}

export function useWorkspaceMembers(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.members,
    queryFn: () => workspaceFetch<MembersResponse>("/api/workspace/members"),
    enabled,
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      workspaceFetch<{ calendarsTransferred: number }>(
        `/api/workspace/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      ),
    onMutate: async (userId) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.members });
      const snapshot = queryClient.getQueryData<MembersResponse>(queryKeys.workspaces.members);
      if (snapshot) {
        queryClient.setQueryData<MembersResponse>(queryKeys.workspaces.members, {
          ...snapshot,
          members: snapshot.members.filter((m) => m.userId !== userId),
        });
      }
      return { snapshot };
    },
    onError: (_err, _userId, context) => {
      if (context?.snapshot) queryClient.setQueryData(queryKeys.workspaces.members, context.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members });
      queryClient.invalidateQueries({ queryKey: queryKeys.calendars.all });
    },
  });
}

/** Leaving navigates to the portal, so no cache handling is needed. */
export function useLeaveWorkspace() {
  return useMutation({
    mutationFn: () =>
      workspaceFetch<{ calendarsTransferred: number }>("/api/workspace/leave", { method: "POST" }),
  });
}

export function useJoinLinks(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.joinLinks,
    queryFn: () => workspaceFetch<{ links: JoinLinkDto[] }>("/api/workspace/join-links"),
    enabled,
  });
}

export interface CreateJoinLinkInput {
  name: string | null;
  expiresInDays: 1 | 7 | 30 | null;
  maxUses: number | null;
}

export function useCreateJoinLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateJoinLinkInput) =>
      workspaceFetch<{ link: JoinLinkDto }>("/api/workspace/join-links", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.joinLinks }),
  });
}

export function useRevokeJoinLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      workspaceFetch<{ ok: true }>(`/api/workspace/join-links/${encodeURIComponent(id)}`, {
        method: "DELETE",
      }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.joinLinks });
      const snapshot = queryClient.getQueryData<{ links: JoinLinkDto[] }>(queryKeys.workspaces.joinLinks);
      if (snapshot) {
        queryClient.setQueryData<{ links: JoinLinkDto[] }>(queryKeys.workspaces.joinLinks, {
          links: snapshot.links.map((l) => (l.id === id ? { ...l, status: "revoked" as const } : l)),
        });
      }
      return { snapshot };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshot) queryClient.setQueryData(queryKeys.workspaces.joinLinks, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.joinLinks }),
  });
}
