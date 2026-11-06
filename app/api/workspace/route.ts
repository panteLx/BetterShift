import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { getRequestWorkspace, getWorkspaceRole } from "@/lib/workspace";
import { MULTI_TENANT } from "@/lib/auth/env";
import { busyResponse, requireWorkspaceMember } from "@/lib/workspace-access";
import { deleteWorkspace } from "@/lib/workspace-admin";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceDeletedMetadata } from "@/lib/audit-log";

export async function GET(request: NextRequest) {
  try {
    const workspace = await getRequestWorkspace();
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const user = await getSessionUser(request.headers);
    const role = user ? await getWorkspaceRole(user.id, workspace.id) : null;

    return NextResponse.json({
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      role,
      multiTenant: MULTI_TENANT,
    });
  } catch (error) {
    console.error("[API] GET /api/workspace error:", error);
    return NextResponse.json({ error: "Failed to resolve workspace" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, ["owner"]);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-delete");
  if (limited) return limited;
  const body = (await request.json().catch(() => null)) as { confirmSlug?: unknown } | null;
  if (body?.confirmSlug !== ctx.workspace.slug) {
    return NextResponse.json({ error: "Confirmation does not match", code: "confirmation_mismatch" }, { status: 400 });
  }
  let result;
  try {
    result = await deleteWorkspace(ctx.workspace.id);
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    return NextResponse.json(
      { error: result.reason, code: result.reason },
      { status: result.reason === "default" ? 409 : 404 }
    );
  }
  // workspaceId null keeps the entry: audit rows cascade with the workspace otherwise.
  void logUserAction<WorkspaceDeletedMetadata>({
    action: "workspace.delete",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: null,
    metadata: {
      slug: result.workspace.slug,
      name: result.workspace.name,
      members: result.counts.members,
      calendars: result.counts.calendars,
      byInstanceAdmin: false,
    },
    request,
  });
  return NextResponse.json({ ok: true });
}
