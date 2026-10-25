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

export interface MembersResponse {
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
  role?: "member" | "admin";
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

export function useAdminUserWorkspaces(userId: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.adminUser(userId),
    queryFn: () =>
      workspaceFetch<{ workspaces: MyWorkspace[] }>(`/api/admin/users/${encodeURIComponent(userId)}/workspaces`),
    enabled,
  });
}

export function useAdminAddUserToWorkspace(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { slug: string; role: "member" | "admin" }) =>
      workspaceFetch<{ ok: true }>(`/api/admin/users/${encodeURIComponent(userId)}/workspaces`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.adminUser(userId) }),
  });
}

export function useAdminRemoveUserFromWorkspace(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      workspaceFetch<{ calendarsTransferred: number }>(
        `/api/admin/users/${encodeURIComponent(userId)}/workspaces?workspaceId=${encodeURIComponent(workspaceId)}`,
        { method: "DELETE" }
      ),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.adminUser(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.detail(userId) });
    },
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

export function useChangeMemberRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: "admin" | "member" }) =>
      workspaceFetch<{ ok: true }>(`/api/workspace/members/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onMutate: async ({ userId, role }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.members });
      const snapshot = queryClient.getQueryData<MembersResponse>(queryKeys.workspaces.members);
      if (snapshot) {
        queryClient.setQueryData<MembersResponse>(queryKeys.workspaces.members, {
          ...snapshot,
          members: snapshot.members.map((m) => (m.userId === userId ? { ...m, role } : m)),
        });
      }
      return { snapshot };
    },
    onError: (_e, _v, context) => {
      if (context?.snapshot) queryClient.setQueryData(queryKeys.workspaces.members, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members }),
  });
}

export function useTransferOwnership() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      workspaceFetch<{ ok: true }>("/api/workspace/transfer", { method: "POST", body: JSON.stringify({ userId }) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.members });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine });
    },
  });
}

export interface WorkspaceSettingsDto {
  name: string;
  slug: string;
  allowGuestAccess: boolean;
  inheritedGuestAccess: boolean;
}

export function useWorkspaceSettings(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.settings,
    queryFn: () => workspaceFetch<WorkspaceSettingsDto>("/api/workspace/settings"),
    enabled,
  });
}

export function useUpdateWorkspaceSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: { name?: string; allowGuestAccess?: boolean | null }) =>
      workspaceFetch<{ ok: true }>("/api/workspace/settings", { method: "PATCH", body: JSON.stringify(patch) }),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.workspaces.settings });
      const snapshot = queryClient.getQueryData<WorkspaceSettingsDto>(queryKeys.workspaces.settings);
      if (snapshot) {
        const { allowGuestAccess, ...rest } = patch;
        queryClient.setQueryData(queryKeys.workspaces.settings, {
          ...snapshot,
          ...rest,
          // null (reset) keeps the shown value until the refetch brings the inherited one
          ...(allowGuestAccess === undefined ? {} : allowGuestAccess === null ? { inheritedGuestAccess: true } : { allowGuestAccess, inheritedGuestAccess: false }),
        });
      }
      return { snapshot };
    },
    onError: (_e, _v, context) => {
      if (context?.snapshot) queryClient.setQueryData(queryKeys.workspaces.settings, context.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.settings });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspace });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine });
    },
  });
}

export interface WorkspaceStatsDto {
  members: number;
  calendars: number;
  shifts: number;
  activeJoinLinks: number;
}

export function useWorkspaceStats(enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.workspaces.stats,
    queryFn: () => workspaceFetch<WorkspaceStatsDto>("/api/workspace/stats"),
    enabled,
  });
}

/** Deleting navigates to the portal, so no cache handling is needed. */
export function useDeleteWorkspace() {
  return useMutation({
    mutationFn: (confirmSlug: string) =>
      workspaceFetch<{ ok: true }>("/api/workspace", { method: "DELETE", body: JSON.stringify({ confirmSlug }) }),
  });
}
