import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { MULTI_TENANT } from "@/lib/auth/env";
import { rateLimit } from "@/lib/rate-limiter";
import { isWorkspaceMember } from "@/lib/workspace";
import { logUserAction, type WorkspaceJoinedMetadata } from "@/lib/audit-log";
import { findJoinLink, redeemJoinLink } from "@/lib/workspace-join-links";

type Params = { params: Promise<{ token: string }> };
const invalid = () => NextResponse.json({ error: "Link invalid or expired", code: "invalid_link" }, { status: 404 });

async function guard(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });
  return rateLimit(request, user.id, "workspace-join") ?? user;
}

export async function GET(request: NextRequest, { params }: Params) {
  const user = await guard(request);
  if (user instanceof NextResponse) return user;
  const found = await findJoinLink((await params).token);
  if (!found) return invalid();
  return NextResponse.json({
    workspace: { name: found.workspace.name, slug: found.workspace.slug },
    alreadyMember: await isWorkspaceMember(user.id, found.workspace.id),
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  const user = await guard(request);
  if (user instanceof NextResponse) return user;
  const result = redeemJoinLink((await params).token, user.id);
  if (!result.ok) return invalid();
  if (!result.alreadyMember) {
    void logUserAction<WorkspaceJoinedMetadata>({
      action: "workspace.join",
      userId: user.id,
      resourceType: "workspace",
      resourceId: result.workspace.id,
      workspaceId: result.workspace.id,
      metadata: { linkId: result.linkId, workspaceName: result.workspace.name },
      request,
    });
  }
  return NextResponse.json({
    workspace: { name: result.workspace.name, slug: result.workspace.slug },
    alreadyMember: result.alreadyMember,
  });
}
