import { randomBytes } from "node:crypto";
import { and, desc, eq, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { member, organization, workspaceJoinLinks, type WorkspaceJoinLink } from "@/lib/db/schema";
import type { Workspace } from "@/lib/workspace";

export const JOIN_LINK_EXPIRY_DAYS = [1, 7, 30] as const;
export const JOIN_LINK_MAX_USES_LIMIT = 1000;
const JOIN_LINK_NAME_MAX_LENGTH = 64;

export type JoinLinkStatus = "active" | "revoked" | "expired" | "exhausted";

type StatusFields = Pick<WorkspaceJoinLink, "revokedAt" | "expiresAt" | "maxUses" | "usageCount">;

export function joinLinkStatus(link: StatusFields, now: Date = new Date()): JoinLinkStatus {
  if (link.revokedAt) return "revoked";
  if (link.expiresAt && link.expiresAt.getTime() <= now.getTime()) return "expired";
  if (link.maxUses !== null && link.usageCount >= link.maxUses) return "exhausted";
  return "active";
}

export interface JoinLinkInput {
  name: string | null;
  expiresInDays: (typeof JOIN_LINK_EXPIRY_DAYS)[number] | null;
  maxUses: number | null;
}

export function parseJoinLinkInput(body: unknown): JoinLinkInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" && b.name.trim() ? b.name.trim().slice(0, JOIN_LINK_NAME_MAX_LENGTH) : null;
  const expires = b.expiresInDays ?? null;
  if (expires !== null && !JOIN_LINK_EXPIRY_DAYS.includes(expires as never)) return null;
  const maxUses = b.maxUses ?? null;
  if (maxUses !== null && (!Number.isInteger(maxUses) || (maxUses as number) < 1 || (maxUses as number) > JOIN_LINK_MAX_USES_LIMIT)) {
    return null;
  }
  return { name, expiresInDays: expires as JoinLinkInput["expiresInDays"], maxUses: maxUses as number | null };
}

export async function createJoinLink(workspaceId: string, createdBy: string, input: JoinLinkInput): Promise<WorkspaceJoinLink> {
  const now = new Date();
  const [row] = await db
    .insert(workspaceJoinLinks)
    .values({
      workspaceId,
      token: randomBytes(32).toString("base64url"),
      name: input.name,
      role: "member",
      expiresAt: input.expiresInDays ? new Date(now.getTime() + input.expiresInDays * 86_400_000) : null,
      maxUses: input.maxUses,
      createdBy,
      createdAt: now,
    })
    .returning();
  return row;
}

export function listJoinLinks(workspaceId: string): Promise<WorkspaceJoinLink[]> {
  return db.select().from(workspaceJoinLinks).where(eq(workspaceJoinLinks.workspaceId, workspaceId)).orderBy(desc(workspaceJoinLinks.createdAt));
}

/** Scoped to the workspace so a foreign link id behaves exactly like a missing one. */
export async function revokeJoinLink(workspaceId: string, linkId: string): Promise<boolean> {
  const result = await db
    .update(workspaceJoinLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(workspaceJoinLinks.id, linkId), eq(workspaceJoinLinks.workspaceId, workspaceId), isNull(workspaceJoinLinks.revokedAt)))
    .returning({ id: workspaceJoinLinks.id });
  if (result.length > 0) return true;
  // Already revoked still counts as success; a foreign or unknown id does not.
  const existing = await db.query.workspaceJoinLinks.findFirst({
    where: and(eq(workspaceJoinLinks.id, linkId), eq(workspaceJoinLinks.workspaceId, workspaceId)),
    columns: { id: true },
  });
  return !!existing;
}

export async function findJoinLink(token: string): Promise<{ link: WorkspaceJoinLink; workspace: Workspace } | null> {
  const link = await db.query.workspaceJoinLinks.findFirst({ where: eq(workspaceJoinLinks.token, token) });
  if (!link || joinLinkStatus(link) !== "active") return null;
  const workspace = await db.query.organization.findFirst({
    where: eq(organization.id, link.workspaceId),
    columns: { id: true, name: true, slug: true },
  });
  return workspace ? { link, workspace } : null;
}

export type RedeemResult =
  | { ok: true; workspace: Workspace; alreadyMember: boolean; linkId: string }
  | { ok: false };

export function redeemJoinLink(token: string, userId: string): RedeemResult {
  return db.transaction((tx) => {
    const link = tx.select().from(workspaceJoinLinks).where(eq(workspaceJoinLinks.token, token)).get();
    if (!link || joinLinkStatus(link) !== "active") return { ok: false } as const;
    const workspace = tx
      .select({ id: organization.id, name: organization.name, slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, link.workspaceId))
      .get();
    if (!workspace) return { ok: false } as const;

    const existing = tx
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, workspace.id), eq(member.userId, userId)))
      .get();
    if (existing) return { ok: true, workspace, alreadyMember: true, linkId: link.id } as const;

    // Conditional increment: the row count, not the earlier read, decides whether a use is left.
    const now = new Date();
    const claimed = tx
      .update(workspaceJoinLinks)
      .set({ usageCount: sql`${workspaceJoinLinks.usageCount} + 1`, lastUsedAt: now })
      .where(
        and(
          eq(workspaceJoinLinks.id, link.id),
          isNull(workspaceJoinLinks.revokedAt),
          or(isNull(workspaceJoinLinks.maxUses), lt(workspaceJoinLinks.usageCount, workspaceJoinLinks.maxUses))
        )
      )
      .run();
    if (claimed.changes === 0) return { ok: false } as const;

    tx.insert(member).values({ id: crypto.randomUUID(), organizationId: workspace.id, userId, role: link.role }).run();
    return { ok: true, workspace, alreadyMember: false, linkId: link.id } as const;
  });
}

export function toJoinLinkDto(link: WorkspaceJoinLink) {
  return {
    id: link.id,
    token: link.token,
    name: link.name,
    role: link.role,
    expiresAt: link.expiresAt?.toISOString() ?? null,
    maxUses: link.maxUses,
    usageCount: link.usageCount,
    status: joinLinkStatus(link),
    createdAt: link.createdAt.toISOString(),
    lastUsedAt: link.lastUsedAt?.toISOString() ?? null,
  };
}
export type JoinLinkDto = ReturnType<typeof toJoinLinkDto>;
