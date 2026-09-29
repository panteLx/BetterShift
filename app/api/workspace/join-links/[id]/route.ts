import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { logUserAction, type WorkspaceJoinLinkMetadata } from "@/lib/audit-log";
import { revokeJoinLink } from "@/lib/workspace-join-links";

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const { id } = await params;
  const outcome = await revokeJoinLink(ctx.workspace.id, id);
  if (outcome === "not_found") {
    return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  }
  if (outcome === "unchanged") return NextResponse.json({ ok: true });
  void logUserAction<WorkspaceJoinLinkMetadata>({
    action: "workspace.join_link_revoke",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: ctx.workspace.id,
    metadata: { linkId: id },
    request,
  });
  return NextResponse.json({ ok: true });
}
