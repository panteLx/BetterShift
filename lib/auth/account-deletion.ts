import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  announcements,
  auditLogs,
  member,
  organization,
} from "@/lib/db/schema";
import { MULTI_TENANT } from "@/lib/auth/env";
import {
  DEFAULT_WORKSPACE_ID,
  invalidateWorkspaceCache,
} from "@/lib/workspace";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class SoleWorkspaceOwnerError extends Error {
  constructor(public workspaceIds: string[]) {
    super("This account is the only owner of a workspace that has other members");
    this.name = "SoleWorkspaceOwnerError";
  }
}

/**
 * Returns the workspaces that would be left memberless by deleting this
 * account, or throws SoleWorkspaceOwnerError when the account is the only
 * owner of a workspace that has other members. Never returns `default`.
 */
function planWorkspaceCleanup(tx: Transaction, userId: string): string[] {
  // Single-tenant: everyone shares `default`, whose first user is its owner.
  if (!MULTI_TENANT) return [];

  const memberships = tx
    .select({ workspaceId: member.organizationId, role: member.role })
    .from(member)
    .where(eq(member.userId, userId))
    .all();

  const blocked: string[] = [];
  const memberless: string[] = [];
  for (const m of memberships) {
    const others = tx
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, m.workspaceId), ne(member.userId, userId)))
      .all();
    if (others.length === 0) {
      if (m.workspaceId !== DEFAULT_WORKSPACE_ID) memberless.push(m.workspaceId);
    } else if (m.role === "owner" && !others.some((o) => o.role === "owner")) {
      blocked.push(m.workspaceId);
    }
  }

  if (blocked.length > 0) throw new SoleWorkspaceOwnerError(blocked);
  return memberless;
}

/** Read-only pre-check so callers can refuse before any side effect (e.g. audit logging). */
export function assertNotSoleWorkspaceOwner(userId: string): void {
  db.transaction((tx) => {
    planWorkspaceCleanup(tx, userId);
  });
}

/**
 * Re-checks the sole-owner rule and deletes every workspace this account is
 * the only member of, inside the caller's transaction. Returns the deleted
 * slugs; pass them to invalidateDeletedWorkspaces() after the commit.
 */
export function deleteMemberlessWorkspaces(
  tx: Transaction,
  userId: string
): string[] {
  const workspaceIds = planWorkspaceCleanup(tx, userId);
  if (workspaceIds.length === 0) return [];

  const slugs = tx
    .select({ slug: organization.slug })
    .from(organization)
    .where(inArray(organization.id, workspaceIds))
    .all()
    .map((row) => row.slug);

  // Migrated DBs reference organization from these two tables without ON DELETE
  // (SQLite ALTER ADD), so clear them by hand; audit history stays as instance-level.
  tx.update(auditLogs)
    .set({ workspaceId: null })
    .where(inArray(auditLogs.workspaceId, workspaceIds))
    .run();
  tx.delete(announcements)
    .where(inArray(announcements.workspaceId, workspaceIds))
    .run();
  tx.delete(organization)
    .where(
      and(
        inArray(organization.id, workspaceIds),
        ne(organization.id, DEFAULT_WORKSPACE_ID)
      )
    )
    .run();

  return slugs;
}

export function invalidateDeletedWorkspaces(slugs: string[]): void {
  for (const slug of slugs) invalidateWorkspaceCache(slug);
}
