import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization } from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import { canManageWorkspaceMemberships } from "@/lib/auth/admin";
import { getValidatedAdminUser, getValidatedTargetUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type AdminWorkspaceMembershipMetadata } from "@/lib/audit-log";
import { listMyWorkspaces } from "@/lib/workspaces";
import { endMembership } from "@/lib/workspace-membership-end";

type Params = { params: Promise<{ id: string }> };
const notFound = (code = "not_found") => NextResponse.json({ error: "Not found", code }, { status: 404 });

async function guard(request: NextRequest, params: Params["params"], mutation: boolean) {
  if (!MULTI_TENANT) return notFound();
  const admin = await getValidatedAdminUser(request);
  if (isErrorResponse(admin)) return admin;
  if (!canManageWorkspaceMemberships(admin)) {
    return NextResponse.json({ error: "Admin access required", code: "forbidden" }, { status: 403 });
  }
  if (mutation) {
    const limited = rateLimit(request, admin.id, "admin-user-mutations");
    if (limited) return limited;
  }
  const target = await getValidatedTargetUser((await params).id);
  if (isErrorResponse(target)) return target;
  return { admin, target };
}

export async function GET(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, false);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ workspaces: await listMyWorkspaces(ctx.target.id) });
}

export async function POST(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, true);
  if (ctx instanceof NextResponse) return ctx;
  const body = (await request.json().catch(() => null)) as { slug?: unknown; role?: unknown } | null;
  const role = body?.role;
  if (role !== "member" && role !== "admin") {
    return NextResponse.json({ error: "Invalid role", code: "invalid_role" }, { status: 400 });
  }
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const workspace = await db.query.organization.findFirst({ where: eq(organization.slug, slug), columns: { id: true, slug: true } });
  if (!workspace) return notFound("workspace_not_found");

  const existing = await db.query.member.findFirst({
    where: and(eq(member.organizationId, workspace.id), eq(member.userId, ctx.target.id)),
    columns: { id: true },
  });
  if (existing) return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 });

  try {
    await db.insert(member).values({ id: crypto.randomUUID(), organizationId: workspace.id, userId: ctx.target.id, role });
  } catch (error) {
    // The pre-check above has a race: two concurrent POSTs can both pass it, so the unique
    // index on (organization_id, user_id) is the real guard against a duplicate membership.
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed: member.organization_id, member.user_id")) {
      return NextResponse.json({ error: "Already a member", code: "already_member" }, { status: 409 });
    }
    throw error;
  }
  void logAdminAction<AdminWorkspaceMembershipMetadata>({
    action: "admin.workspace_member_add",
    userId: ctx.admin.id,
    resourceType: "user",
    resourceId: ctx.target.id,
    workspaceId: workspace.id,
    metadata: { targetUser: ctx.target.email, workspaceSlug: workspace.slug, role },
    request,
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const ctx = await guard(request, params, true);
  if (ctx instanceof NextResponse) return ctx;
  const workspaceId = request.nextUrl.searchParams.get("workspaceId") ?? "";
  const workspace = await db.query.organization.findFirst({ where: eq(organization.id, workspaceId), columns: { id: true, slug: true } });
  if (!workspace) return notFound("workspace_not_found");

  const result = endMembership(workspace.id, ctx.target.id);
  if (!result.ok) {
    const status = result.reason === "not_member" ? 404 : 409;
    return NextResponse.json({ error: `Cannot remove: ${result.reason}`, code: result.reason }, { status });
  }
  void logAdminAction<AdminWorkspaceMembershipMetadata>({
    action: "admin.workspace_member_remove",
    userId: ctx.admin.id,
    resourceType: "user",
    resourceId: ctx.target.id,
    workspaceId: workspace.id,
    metadata: { targetUser: ctx.target.email, workspaceSlug: workspace.slug, calendarsTransferred: result.calendarsTransferred },
    request,
  });
  return NextResponse.json({ calendarsTransferred: result.calendarsTransferred });
}
