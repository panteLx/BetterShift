import { and, count, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { announcements, auditLogs, calendars, member, organization, shifts, workspaceJoinLinks } from "@/lib/db/schema";
import { TENANT_MAX_WORKSPACES_PER_USER } from "@/lib/auth/env";
import { DEFAULT_WORKSPACE_ID, invalidateWorkspaceCache, type Workspace } from "@/lib/workspace";
import { WORKSPACE_NAME_MAX_LENGTH } from "@/lib/workspaces";

export function changeMemberRole(workspaceId: string, userId: string, role: "admin" | "member") {
  return db.transaction((tx) => {
    const row = tx
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, userId)))
      .get();
    if (!row) return { ok: false, reason: "not_member" } as const;
    if (row.role === "owner") return { ok: false, reason: "owner" } as const;
    if (row.role === role) return { ok: true, changed: false, from: row.role } as const;
    tx.update(member).set({ role }).where(eq(member.id, row.id)).run();
    return { ok: true, changed: true, from: row.role } as const;
  });
}

export function transferOwnership(
  workspaceId: string,
  fromUserId: string,
  toUserId: string,
  opts: { exemptFromLimit: boolean }
) {
  if (fromUserId === toUserId) return { ok: false, reason: "self" } as const;
  return db.transaction((tx) => {
    const from = tx
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, fromUserId)))
      .get();
    if (!from || from.role !== "owner") return { ok: false, reason: "not_owner" } as const;
    const to = tx
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, workspaceId), eq(member.userId, toUserId)))
      .get();
    if (!to) return { ok: false, reason: "not_member" } as const;
    if (!opts.exemptFromLimit) {
      const [owned] = tx
        .select({ n: count() })
        .from(member)
        .where(and(eq(member.userId, toUserId), eq(member.role, "owner")))
        .all();
      if ((owned?.n ?? 0) >= TENANT_MAX_WORKSPACES_PER_USER) return { ok: false, reason: "limit" } as const;
    }
    tx.update(member).set({ role: "admin" }).where(eq(member.id, from.id)).run();
    tx.update(member).set({ role: "owner" }).where(eq(member.id, to.id)).run();
    return { ok: true } as const;
  });
}

export async function renameWorkspace(workspaceId: string, rawName: string) {
  const name = rawName.trim();
  if (!name || name.length > WORKSPACE_NAME_MAX_LENGTH) return { ok: false, reason: "invalid_name" } as const;
  const [row] = await db
    .update(organization)
    .set({ name })
    .where(eq(organization.id, workspaceId))
    .returning({ id: organization.id, name: organization.name, slug: organization.slug });
  if (!row) return { ok: false, reason: "not_found" } as const;
  invalidateWorkspaceCache(row.slug);
  const workspace: Workspace = row;
  return { ok: true, workspace } as const;
}

export async function getWorkspaceCounts(workspaceId: string) {
  const now = new Date();
  const [[m], [c], [s], [l]] = await Promise.all([
    db.select({ n: count() }).from(member).where(eq(member.organizationId, workspaceId)),
    db.select({ n: count() }).from(calendars).where(eq(calendars.workspaceId, workspaceId)),
    db
      .select({ n: count() })
      .from(shifts)
      .innerJoin(calendars, eq(shifts.calendarId, calendars.id))
      .where(eq(calendars.workspaceId, workspaceId)),
    db
      .select({ n: count() })
      .from(workspaceJoinLinks)
      .where(
        and(
          eq(workspaceJoinLinks.workspaceId, workspaceId),
          isNull(workspaceJoinLinks.revokedAt),
          or(isNull(workspaceJoinLinks.expiresAt), gt(workspaceJoinLinks.expiresAt, now)),
          or(isNull(workspaceJoinLinks.maxUses), gt(workspaceJoinLinks.maxUses, workspaceJoinLinks.usageCount))
        )
      ),
  ]);
  return { members: m?.n ?? 0, calendars: c?.n ?? 0, shifts: s?.n ?? 0, activeJoinLinks: l?.n ?? 0 };
}

export async function deleteWorkspace(workspaceId: string) {
  if (workspaceId === DEFAULT_WORKSPACE_ID) return { ok: false, reason: "default" } as const;
  const workspace = await db.query.organization.findFirst({
    where: eq(organization.id, workspaceId),
    columns: { id: true, name: true, slug: true },
  });
  if (!workspace) return { ok: false, reason: "not_found" } as const;
  const counts = await getWorkspaceCounts(workspaceId);
  // audit_logs and announcements got their workspace_id via ALTER TABLE without a DB-level cascade, so delete them explicitly.
  db.transaction((tx) => {
    tx.delete(auditLogs).where(eq(auditLogs.workspaceId, workspaceId)).run();
    tx.delete(announcements).where(eq(announcements.workspaceId, workspaceId)).run();
    tx.delete(organization).where(eq(organization.id, workspaceId)).run();
  });
  invalidateWorkspaceCache(workspace.slug);
  return { ok: true, workspace, counts } as const;
}
