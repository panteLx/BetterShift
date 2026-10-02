"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { workspaceFetch, type WorkspaceMemberDto } from "@/hooks/useWorkspaces";

export interface AdminWorkspaceRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  owner: { id: string; name: string; email: string } | null;
  memberCount: number;
  calendarCount: number;
}

type ListData = { workspaces: AdminWorkspaceRow[] };
type MembersData = { members: WorkspaceMemberDto[] };

const listKey = queryKeys.admin.workspaces.list;
const base = (id: string) => `/api/admin/workspaces/${encodeURIComponent(id)}`;

export function useAdminWorkspaces(enabled = true) {
  return useQuery({
    queryKey: listKey,
    queryFn: () => workspaceFetch<ListData>("/api/admin/workspaces"),
    enabled,
  });
}

export function useAdminWorkspaceMembers(id: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.admin.workspaces.members(id),
    queryFn: () => workspaceFetch<MembersData>(`${base(id)}/members`),
    enabled,
  });
}

/** Patches the list cache optimistically; returns the snapshot for rollback. */
async function patchList(
  queryClient: ReturnType<typeof useQueryClient>,
  patch: (rows: AdminWorkspaceRow[]) => AdminWorkspaceRow[]
) {
  await queryClient.cancelQueries({ queryKey: listKey });
  const snapshot = queryClient.getQueryData<ListData>(listKey);
  if (snapshot) queryClient.setQueryData<ListData>(listKey, { workspaces: patch(snapshot.workspaces) });
  return snapshot;
}

async function patchMembers(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
  patch: (members: WorkspaceMemberDto[]) => WorkspaceMemberDto[]
) {
  const key = queryKeys.admin.workspaces.members(id);
  await queryClient.cancelQueries({ queryKey: key });
  const snapshot = queryClient.getQueryData<MembersData>(key);
  if (snapshot) queryClient.setQueryData<MembersData>(key, { members: patch(snapshot.members) });
  return snapshot;
}

export function useAdminRenameWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      workspaceFetch<{ ok: true; name: string }>(base(id), { method: "PATCH", body: JSON.stringify({ name }) }),
    onMutate: async ({ id, name }) => ({
      snapshot: await patchList(queryClient, (rows) => rows.map((w) => (w.id === id ? { ...w, name } : w))),
    }),
    onError: (_e, _v, context) => {
      if (context?.snapshot) queryClient.setQueryData(listKey, context.snapshot);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: listKey }),
  });
}

export function useAdminTransferWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    // Exactly one of userId/email; email is resolved server-side and also covers non-members of an ownerless workspace.
    mutationFn: ({ id, userId, email }: { id: string; userId?: string; email?: string }) =>
      workspaceFetch<{ ok: true }>(`${base(id)}/transfer`, { method: "POST", body: JSON.stringify({ userId, email }) }),
    onMutate: async ({ id, userId }) => {
      if (!userId) return { members: undefined };
      // The previous owner becomes an admin, mirroring the server.
      const members = await patchMembers(queryClient, id, (rows) =>
        rows.map((m) => (m.userId === userId ? { ...m, role: "owner" } : m.role === "owner" ? { ...m, role: "admin" } : m))
      );
      return { members };
    },
    onError: (_e, { id }, context) => {
      if (context?.members) queryClient.setQueryData(queryKeys.admin.workspaces.members(id), context.members);
    },
    onSettled: (_d, _e, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.workspaces.members(id) });
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

export function useAdminChangeWorkspaceSlug() {
  const queryClient = useQueryClient();
  return useMutation({
    // No optimistic patch: the server validates availability.
    mutationFn: ({ id, slug }: { id: string; slug: string }) =>
      workspaceFetch<{ ok: true; slug: string }>(base(id), { method: "PATCH", body: JSON.stringify({ slug }) }),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine });
    },
  });
}

export function useAdminDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, confirmSlug }: { id: string; confirmSlug: string }) =>
      workspaceFetch<{ ok: true }>(base(id), { method: "DELETE", body: JSON.stringify({ confirmSlug }) }),
    onMutate: async ({ id }) => ({ snapshot: await patchList(queryClient, (rows) => rows.filter((w) => w.id !== id)) }),
    onError: (_e, _v, context) => {
      if (context?.snapshot) queryClient.setQueryData(listKey, context.snapshot);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.workspaces.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.calendars.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.mine });
    },
  });
}

export function useAdminAddWorkspaceMember() {
  const queryClient = useQueryClient();
  return useMutation({
    // No optimistic patch: the server resolves the email to an account.
    mutationFn: ({ id, email, role }: { id: string; email: string; role: "member" | "admin" }) =>
      workspaceFetch<{ ok: true }>(`${base(id)}/members`, { method: "POST", body: JSON.stringify({ email, role }) }),
    onSettled: (_d, _e, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.workspaces.members(id) });
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
    },
  });
}

export function useAdminRemoveWorkspaceMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      workspaceFetch<{ calendarsTransferred: number }>(`${base(id)}/members?userId=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      }),
    onMutate: async ({ id, userId }) => ({
      members: await patchMembers(queryClient, id, (rows) => rows.filter((m) => m.userId !== userId)),
      snapshot: await patchList(queryClient, (rows) =>
        rows.map((w) => (w.id === id ? { ...w, memberCount: Math.max(0, w.memberCount - 1) } : w))
      ),
    }),
    onError: (_e, { id }, context) => {
      if (context?.members) queryClient.setQueryData(queryKeys.admin.workspaces.members(id), context.members);
      if (context?.snapshot) queryClient.setQueryData(listKey, context.snapshot);
    },
    onSettled: (_d, _e, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.workspaces.members(id) });
      queryClient.invalidateQueries({ queryKey: listKey });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.users.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.calendars.all });
    },
  });
}

export function useAdminWorkspaceActions() {
  return {
    rename: useAdminRenameWorkspace(),
    transfer: useAdminTransferWorkspace(),
    changeSlug: useAdminChangeWorkspaceSlug(),
    remove: useAdminDeleteWorkspace(),
    addMember: useAdminAddWorkspaceMember(),
    removeMember: useAdminRemoveWorkspaceMember(),
  };
}
