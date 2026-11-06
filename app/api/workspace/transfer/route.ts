import { NextRequest, NextResponse } from "next/server";
import { busyResponse, requireWorkspaceMember } from "@/lib/workspace-access";
import { transferOwnership } from "@/lib/workspace-admin";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceOwnerTransferredMetadata } from "@/lib/audit-log";

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, ["owner"]);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-mutation");
  if (limited) return limited;
  const body = (await request.json().catch(() => null)) as { userId?: unknown } | null;
  if (typeof body?.userId !== "string" || !body.userId) {
    return NextResponse.json({ error: "Invalid user", code: "invalid" }, { status: 400 });
  }
  let result;
  try {
    result = transferOwnership(ctx.workspace.id, ctx.user.id, body.userId, { exemptFromLimit: false });
  } catch (error) {
    return busyResponse(error);
  }
  if (!result.ok) {
    const status = { self: 409, limit: 409, not_member: 404, not_owner: 403 }[result.reason];
    return NextResponse.json({ error: result.reason, code: result.reason }, { status });
  }
  void logUserAction<WorkspaceOwnerTransferredMetadata>({
    action: "workspace.owner_transfer",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: ctx.workspace.id,
    metadata: { fromUser: ctx.user.id, toUser: body.userId, byInstanceAdmin: false },
    request,
  });
  return NextResponse.json({ ok: true });
}
