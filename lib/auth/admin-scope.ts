import { headers } from "next/headers";
import { MULTI_TENANT } from "@/lib/auth/env";
import { adminScopeFor, type AdminScope } from "@/lib/admin-sections";
import { resolveWorkspaceFromHost } from "@/lib/workspace";

export async function getAdminScopeForRequest(): Promise<{
  scope: AdminScope;
  workspaceId: string | null;
} | null> {
  if (!MULTI_TENANT) return { scope: "instance", workspaceId: null };
  const resolution = await resolveWorkspaceFromHost((await headers()).get("host"));
  const scope = adminScopeFor(true, resolution.kind);
  if (!scope) return null;
  return {
    scope,
    workspaceId: resolution.kind === "workspace" ? resolution.workspace.id : null,
  };
}
