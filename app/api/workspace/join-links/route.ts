import { NextRequest, NextResponse } from "next/server";
import { MANAGER_ROLES, requireWorkspaceMember } from "@/lib/workspace-access";
import { rateLimit } from "@/lib/rate-limiter";
import { logUserAction, type WorkspaceJoinLinkMetadata } from "@/lib/audit-log";
import { createJoinLink, listJoinLinks, parseJoinLinkInput, toJoinLinkDto } from "@/lib/workspace-join-links";

export async function GET(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const links = await listJoinLinks(ctx.workspace.id);
  return NextResponse.json({ links: links.map(toJoinLinkDto) });
}

export async function POST(request: NextRequest) {
  const ctx = await requireWorkspaceMember(request, MANAGER_ROLES);
  if (ctx instanceof NextResponse) return ctx;
  const limited = rateLimit(request, ctx.user.id, "workspace-link-create");
  if (limited) return limited;

  const input = parseJoinLinkInput(await request.json().catch(() => null));
  if (!input) return NextResponse.json({ error: "Invalid join link settings", code: "invalid" }, { status: 400 });

  const link = await createJoinLink(ctx.workspace.id, ctx.user.id, input);
  void logUserAction<WorkspaceJoinLinkMetadata>({
    action: "workspace.join_link_create",
    userId: ctx.user.id,
    resourceType: "workspace",
    resourceId: ctx.workspace.id,
    workspaceId: ctx.workspace.id,
    metadata: { linkId: link.id, maxUses: input.maxUses, expiresInDays: input.expiresInDays },
    request,
  });
  return NextResponse.json({ link: toJoinLinkDto(link) }, { status: 201 });
}
