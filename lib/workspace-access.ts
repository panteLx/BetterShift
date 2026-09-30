import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { MULTI_TENANT } from "@/lib/auth/env";
import { isManagerRole, MANAGER_ROLES, type WorkspaceRole } from "@/lib/auth/workspace-permissions";
import { getRequestWorkspace, getWorkspaceRole, type Workspace } from "@/lib/workspace";

export { isManagerRole, MANAGER_ROLES };
export type { WorkspaceRole };

/** Guard for workspace-host membership APIs: 404 off multi-tenant or off a workspace host, 401, then 403. */
export async function requireWorkspaceMember(
  request: NextRequest,
  allowed: readonly WorkspaceRole[] = ["owner", "admin", "member"]
): Promise<{ user: { id: string; email: string; name: string }; workspace: Workspace; role: WorkspaceRole } | NextResponse> {
  const workspace = MULTI_TENANT ? await getRequestWorkspace() : null;
  if (!workspace) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });
  const role = (await getWorkspaceRole(user.id, workspace.id)) as WorkspaceRole | null;
  if (!role || !allowed.includes(role)) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }
  return { user, workspace, role };
}

/** Maps a SQLITE_BUSY-style failure from a write transaction to a retryable 503; rethrows anything else. */
export function busyResponse(error: unknown): NextResponse {
  const code = (error as { code?: string } | null)?.code;
  if (typeof code === "string" && code.startsWith("SQLITE_BUSY")) {
    return NextResponse.json({ error: "Try again", code: "busy" }, { status: 503 });
  }
  throw error;
}
