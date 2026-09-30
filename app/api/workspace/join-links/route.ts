import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { canCreateJoinLink } from "@/lib/auth/workspace-permissions";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceJoinLinkMetadata } from "@/lib/audit-log";
import { createJoinLink, listJoinLinks, parseJoinLinkInput, toJoinLinkDto } from "@/lib/workspace-join-links";

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const links = await listJoinLinks(ctx.workspace.id);
  // Admin-role tokens would let a workspace admin appoint admins, so only the owner sees those links.
  const visible = ctx.role === "owner" ? links : links.filter((link) => link.role !== "admin");
  return NextResponse.json({ links: visible.map(toJoinLinkDto) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-link-create");
  if (limited) return limited;

  const rawBody = await request.json().catch(() => null);
  const rawRole = (rawBody as { role?: unknown } | null)?.role ?? "member";
  if (rawRole !== "member" && rawRole !== "admin") {
    return NextResponse.json({ error: "Invalid role", code: "invalid_role" }, { status: 400 });
  }
  const input = parseJoinLinkInput(rawBody);
  if (!input) return NextResponse.json({ error: "Invalid join link settings", code: "invalid" }, { status: 400 });
  if (!canCreateJoinLink(ctx.role, rawRole)) {
    return NextResponse.json({ error: "Forbidden", code: "forbidden" }, { status: 403 });
  }

  const link = await createJoinLink(ctx.workspace.id, ctx.user.id, input, rawRole);
  void logUserAction<WorkspaceJoinLinkMetadata>({
    action: "workspace.join_link_create",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: ctx.workspace.id,
    metadata: { linkId: link.id, maxUses: input.maxUses, expiresInDays: input.expiresInDays, role: rawRole },
    request,
  });
  return NextResponse.json({ link: toJoinLinkDto(link) }, { status: 201 });
}
