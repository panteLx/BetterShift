/**
 * Stage 4: self-service onboarding (sub-project 3). Loaded by tenant-isolation-check.ts
 * after the DB guard, so importing lib/db here is safe.
 */
import type * as Harness from "./tenant-isolation-check";

export interface OnboardingHarness {
  check: typeof Harness.check;
  httpRequest: typeof Harness.httpRequest;
  signIn: typeof Harness.signIn;
  seedUser: typeof Harness.seedUser;
  seedCalendar: typeof Harness.seedCalendar;
  seedFeedToken: typeof Harness.seedFeedToken;
  seedMemberships: typeof Harness.seedMemberships;
  baseDomain: string;
  portalHost: string;
  seeded: Harness.SeedData;
}

type SeedUser = Harness.SeedUser;

export async function runOnboardingChecks(h: OnboardingHarness): Promise<void> {
  const { db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { eq, and } = await import("drizzle-orm");

  const api = async (as: SeedUser | null, host: string, method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { host, origin: `http://${host}` };
    if (as) headers.cookie = await h.signIn(as.email, as.password, host);
    if (body !== undefined) headers["content-type"] = "application/json";
    const res = await h.httpRequest(path, method, headers, body !== undefined ? JSON.stringify(body) : undefined);
    let json: unknown = null;
    try { json = JSON.parse(res.text); } catch { /* HTML or empty */ }
    console.log(`        ${method} ${host}${path} -> ${res.status}`);
    return { status: res.status, json: json as Record<string, unknown> | null, headers: res.headers };
  };
  const tryCheck = async (name: string, fn: () => Promise<boolean>) => {
    try {
      h.check(name, await fn());
    } catch (error) {
      h.check(`${name} (threw: ${error instanceof Error ? error.message : String(error)})`, false);
    }
  };
  const ctx = { h, db, schema, eq, and, api, tryCheck };

  await checkCreate(ctx);
  await checkJoinLinks(ctx);
  await checkMembershipEnd(ctx);
  await checkMembershipEndScoping(ctx);
  await checkAdminMemberships(ctx);
}

type Ctx = {
  h: OnboardingHarness;
  db: typeof import("../lib/db")["db"];
  schema: typeof import("../lib/db/schema");
  eq: typeof import("drizzle-orm")["eq"];
  and: typeof import("drizzle-orm")["and"];
  api: (as: SeedUser | null, host: string, method: string, path: string, body?: unknown) =>
    Promise<{ status: number; json: Record<string, unknown> | null; headers: Record<string, unknown> }>;
  tryCheck: (name: string, fn: () => Promise<boolean>) => Promise<void>;
};

async function checkCreate({ h, db, schema, eq, api, tryCheck }: Ctx): Promise<void> {
  console.log("\nStage 4a: self-service workspace creation");
  const portal = h.portalHost;
  const alphaHost = `alpha.${h.baseDomain}`;
  const creator = await h.seedUser("creator@tenancy.test");
  const limited = await h.seedUser("limited@tenancy.test");
  const admin = h.seeded.users.admin;
  const slugExists = async (slug: string) =>
    (await db.select().from(schema.organization).where(eq(schema.organization.slug, slug))).length > 0;

  // Three owned workspaces already: the fourth must hit the limit (default 3).
  for (const slug of ["lim-one", "lim-two", "lim-three"]) {
    const [ws] = await db.insert(schema.organization).values({ id: crypto.randomUUID(), name: slug, slug }).returning();
    await h.seedMemberships(ws.id, [[limited, "owner"]]);
  }

  await tryCheck("anonymous create is 401", async () =>
    (await api(null, portal, "POST", "/api/workspaces", { name: "Anon", slug: "anon-ws" })).status === 401);
  await tryCheck("invalid slug is 400 invalid", async () => {
    const r = await api(creator, portal, "POST", "/api/workspaces", { name: "Bad", slug: "Bad_Slug" });
    return r.status === 400 && r.json?.code === "invalid" && !(await slugExists("Bad_Slug"));
  });
  await tryCheck("built-in reserved slug is 400 reserved", async () => {
    const r = await api(creator, portal, "POST", "/api/workspaces", { name: "Admin", slug: "admin" });
    return r.status === 400 && r.json?.code === "reserved";
  });
  await tryCheck("TENANT_RESERVED_SLUGS entry is 400 reserved", async () => {
    const r = await api(creator, portal, "POST", "/api/workspaces", { name: "Env", slug: "reserved-by-env" });
    return r.status === 400 && r.json?.code === "reserved";
  });
  await tryCheck("taken slug is 409 taken", async () => {
    const r = await api(creator, portal, "POST", "/api/workspaces", { name: "Alpha 2", slug: "alpha" });
    return r.status === 409 && r.json?.code === "taken";
  });
  await tryCheck("valid create is 201 and makes the creator owner", async () => {
    const r = await api(creator, portal, "POST", "/api/workspaces", { name: "Gamma Team", slug: "gamma-onb" });
    const ws = (await db.select().from(schema.organization).where(eq(schema.organization.slug, "gamma-onb")))[0];
    const own = ws && (await db.select().from(schema.member).where(eq(schema.member.organizationId, ws.id)));
    return r.status === 201 && !!ws && ws.name === "Gamma Team" && own?.length === 1 && own[0].userId === creator.id && own[0].role === "owner";
  });
  await tryCheck("new subdomain answers immediately (negative cache invalidated)", async () =>
    (await api(null, `gamma-onb.${h.baseDomain}`, "GET", "/api/workspace")).status === 200);
  await tryCheck("fourth owned workspace is 403 limit", async () => {
    const r = await api(limited, portal, "POST", "/api/workspaces", { name: "Four", slug: "lim-four" });
    return r.status === 403 && r.json?.code === "limit" && !(await slugExists("lim-four"));
  });
  await tryCheck("instance admin is exempt from the limit", async () => {
    for (const slug of ["adm-one", "adm-two", "adm-three"]) {
      const [ws] = await db.insert(schema.organization).values({ id: crypto.randomUUID(), name: slug, slug }).returning();
      await h.seedMemberships(ws.id, [[admin, "owner"]]);
    }
    return (await api(admin, portal, "POST", "/api/workspaces", { name: "Adm Four", slug: "adm-four" })).status === 201;
  });
  await tryCheck("GET /api/workspaces lists own memberships with role", async () => {
    const r = await api(creator, portal, "GET", "/api/workspaces");
    const list = (r.json?.workspaces ?? []) as Array<{ slug: string; role: string }>;
    return r.status === 200 && list.length === 1 && list[0].slug === "gamma-onb" && list[0].role === "owner" && r.json?.maxOwned === 3;
  });
  await tryCheck("slug availability reports each state", async () => {
    const s = async (slug: string) =>
      (await api(creator, portal, "GET", `/api/workspaces/slug-availability?slug=${encodeURIComponent(slug)}`)).json?.status;
    return (await s("free-slug-x")) === "available" && (await s("alpha")) === "taken" &&
      (await s("admin")) === "reserved" && (await s("x")) === "invalid";
  });
  await tryCheck("portal-only /api/workspaces is 404 on a workspace host", async () =>
    (await api(creator, alphaHost, "GET", "/api/workspaces")).status === 404);
  await tryCheck("GET /api/workspace/mine works on a workspace host", async () => {
    const r = await api(h.seeded.users.sharedMember, alphaHost, "GET", "/api/workspace/mine");
    const slugs = ((r.json?.workspaces ?? []) as Array<{ slug: string }>).map((w) => w.slug).sort();
    return r.status === 200 && slugs.join(",") === "alpha,beta";
  });
  await tryCheck("better-auth organization create is disabled (404)", async () =>
    (await api(admin, alphaHost, "POST", "/api/auth/organization/create", { name: "X", slug: "via-plugin" })).status === 404 &&
    !(await slugExists("via-plugin")));
}

async function checkJoinLinks({ h, db, schema, eq, and, api, tryCheck }: Ctx): Promise<void> {
  console.log("\nStage 4b: join links");
  const portal = h.portalHost;
  const alphaHost = `alpha.${h.baseDomain}`;
  const { alphaOwner, alphaMember, betaOwner } = h.seeded.users;
  const joinerA = await h.seedUser("joiner-a@tenancy.test");
  const joinerB = await h.seedUser("joiner-b@tenancy.test");
  const joinerC = await h.seedUser("joiner-c@tenancy.test");
  const alphaId = h.seeded.workspaces.alpha.id;
  const isMember = async (userId: string) =>
    (await db.select().from(schema.member).where(and(eq(schema.member.organizationId, alphaId), eq(schema.member.userId, userId)))).length === 1;
  const linkRow = async (id: string) =>
    (await db.select().from(schema.workspaceJoinLinks).where(eq(schema.workspaceJoinLinks.id, id)))[0];

  let single = { id: "", token: "" };
  await tryCheck("owner creates a single-use link", async () => {
    const r = await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { name: "One", expiresInDays: 7, maxUses: 1 });
    const link = r.json?.link as { id: string; token: string; maxUses: number; status: string } | undefined;
    if (link) single = link;
    return r.status === 201 && link?.maxUses === 1 && link.status === "active" && link.token.length === 43;
  });
  await tryCheck("plain member cannot list links (403)", async () =>
    (await api(alphaMember, alphaHost, "GET", "/api/workspace/join-links")).status === 403);
  await tryCheck("plain member cannot create links (403)", async () =>
    (await api(alphaMember, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: null })).status === 403);
  await tryCheck("non-member cannot list alpha links (403)", async () =>
    (await api(betaOwner, alphaHost, "GET", "/api/workspace/join-links")).status === 403);
  await tryCheck("invalid expiry is 400", async () =>
    (await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: 5, maxUses: null })).status === 400);
  await tryCheck("GET /api/join/:token shows the workspace without consuming a use", async () => {
    const a = await api(joinerA, portal, "GET", `/api/join/${single.token}`);
    await api(joinerA, portal, "GET", `/api/join/${single.token}`);
    const ws = a.json?.workspace as { slug: string } | undefined;
    return a.status === 200 && ws?.slug === "alpha" && (await linkRow(single.id)).usageCount === 0 && !(await isMember(joinerA.id));
  });
  await tryCheck("anonymous redeem is 401", async () =>
    (await api(null, portal, "POST", `/api/join/${single.token}`)).status === 401);
  await tryCheck("first redeem joins as member", async () => {
    const r = await api(joinerA, portal, "POST", `/api/join/${single.token}`);
    const row = (await db.select().from(schema.member).where(and(eq(schema.member.organizationId, alphaId), eq(schema.member.userId, joinerA.id))))[0];
    return r.status === 200 && row?.role === "member" && (await linkRow(single.id)).usageCount === 1;
  });
  await tryCheck("second user on an exhausted single-use link is 404 invalid_link", async () => {
    const r = await api(joinerB, portal, "POST", `/api/join/${single.token}`);
    return r.status === 404 && r.json?.code === "invalid_link" && !(await isMember(joinerB.id)) && (await linkRow(single.id)).usageCount === 1;
  });
  await tryCheck("existing member redeeming does not consume a use", async () => {
    const multi = await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: 5 });
    const link = multi.json?.link as { id: string; token: string };
    const r = await api(alphaMember, portal, "POST", `/api/join/${link.token}`);
    return r.status === 200 && r.json?.alreadyMember === true && (await linkRow(link.id)).usageCount === 0;
  });
  await tryCheck("revoked link is rejected", async () => {
    const created = await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: null });
    const link = created.json?.link as { id: string; token: string };
    const del = await api(alphaOwner, alphaHost, "DELETE", `/api/workspace/join-links/${link.id}`);
    const r = await api(joinerB, portal, "POST", `/api/join/${link.token}`);
    return del.status === 200 && r.status === 404 && !(await isMember(joinerB.id));
  });
  await tryCheck("expired link is rejected", async () => {
    const created = await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: 1, maxUses: null });
    const link = created.json?.link as { id: string; token: string };
    await db.update(schema.workspaceJoinLinks).set({ expiresAt: new Date(Date.now() - 60_000) }).where(eq(schema.workspaceJoinLinks.id, link.id));
    return (await api(joinerC, portal, "POST", `/api/join/${link.token}`)).status === 404 && !(await isMember(joinerC.id));
  });
  await tryCheck("unknown token looks like any invalid token", async () => {
    const r = await api(joinerC, portal, "GET", `/api/join/${"x".repeat(43)}`);
    return r.status === 404 && r.json?.code === "invalid_link";
  });
  await tryCheck("beta owner cannot revoke an alpha link via beta's host (404)", async () => {
    const created = await api(alphaOwner, alphaHost, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: null });
    const link = created.json?.link as { id: string };
    const r = await api(betaOwner, `beta.${h.baseDomain}`, "DELETE", `/api/workspace/join-links/${link.id}`);
    return r.status === 404 && (await linkRow(link.id)).revokedAt === null;
  });
  await tryCheck("/api/join is 404 on a workspace host", async () =>
    (await api(joinerC, alphaHost, "GET", `/api/join/${single.token}`)).status === 404);
  await tryCheck("list never returns links of another workspace", async () => {
    const r = await api(betaOwner, `beta.${h.baseDomain}`, "GET", "/api/workspace/join-links");
    return r.status === 200 && Array.isArray(r.json?.links) && (r.json?.links as unknown[]).length === 0;
  });
  await tryCheck("audit log stores the link id, never the token", async () => {
    const rows = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "workspace.join"));
    return rows.length > 0 && rows.every((row) => !(row.metadata ?? "").includes(single.token));
  });
}

async function checkMembershipEnd({ h, db, schema, eq, and, api, tryCheck }: Ctx): Promise<void> {
  console.log("\nStage 4c: leaving and removing members");
  const s = schema;
  const [delta] = await db.insert(s.organization).values({ id: crypto.randomUUID(), name: "Delta", slug: "delta-end" }).returning();
  const host = `delta-end.${h.baseDomain}`;
  const dOwner = await h.seedUser("d-owner@tenancy.test");
  const dAdmin = await h.seedUser("d-admin@tenancy.test");
  const dLeaver = await h.seedUser("d-leaver@tenancy.test");
  const dKicked = await h.seedUser("d-kicked@tenancy.test");
  await db.insert(s.member).values([
    { id: crypto.randomUUID(), organizationId: delta.id, userId: dOwner.id, role: "owner" },
    { id: crypto.randomUUID(), organizationId: delta.id, userId: dAdmin.id, role: "admin" },
    { id: crypto.randomUUID(), organizationId: delta.id, userId: dLeaver.id, role: "member" },
    { id: crypto.randomUUID(), organizationId: delta.id, userId: dKicked.id, role: "member" },
  ]);
  // Owner's calendar shared with the leaver (share + subscription + feed token), and one the leaver owns.
  const ownerCal = await h.seedCalendar(delta.id, dOwner.id, "Delta Owner Cal", dLeaver.id);
  await db.insert(s.userCalendarSubscriptions).values({ userId: dLeaver.id, calendarId: ownerCal.id, status: "subscribed", source: "shared" });
  const leaverFeed = await h.seedFeedToken(ownerCal.id, dLeaver.id);
  const leaverCal = await h.seedCalendar(delta.id, dLeaver.id, "Delta Leaver Cal", dKicked.id);
  const kickedShareCal = await h.seedCalendar(delta.id, dOwner.id, "Delta Kick Cal", dKicked.id);
  const isMember = async (userId: string) =>
    (await db.select().from(s.member).where(and(eq(s.member.organizationId, delta.id), eq(s.member.userId, userId)))).length === 1;
  // GET /api/calendars returns a bare array; a non-200 also means "not visible".
  const listsCalendar = async (as: SeedUser, calendarId: string) => {
    const r = await api(as, host, "GET", "/api/calendars");
    return r.status === 200 && Array.isArray(r.json) && (r.json as Array<{ id: string }>).some((c) => c.id === calendarId);
  };

  await tryCheck("members list is visible to a plain member", async () => {
    const r = await api(dLeaver, host, "GET", "/api/workspace/members");
    return r.status === 200 && (r.json?.members as unknown[]).length === 4 && r.json?.currentRole === "member";
  });
  await tryCheck("leaver sees the shared calendar before leaving", async () => listsCalendar(dLeaver, ownerCal.id));
  await tryCheck("plain member cannot remove others (403)", async () =>
    (await api(dLeaver, host, "DELETE", `/api/workspace/members/${dKicked.id}`)).status === 403 && (await isMember(dKicked.id)));
  await tryCheck("workspace admin cannot remove the owner (409)", async () =>
    (await api(dAdmin, host, "DELETE", `/api/workspace/members/${dOwner.id}`)).status === 409 && (await isMember(dOwner.id)));
  await tryCheck("removing yourself via DELETE is 400", async () =>
    (await api(dAdmin, host, "DELETE", `/api/workspace/members/${dAdmin.id}`)).status === 400);
  await tryCheck("owner cannot leave (409)", async () =>
    (await api(dOwner, host, "POST", "/api/workspace/leave")).status === 409 && (await isMember(dOwner.id)));
  await tryCheck("removing a non-member id is 404", async () =>
    (await api(dAdmin, host, "DELETE", `/api/workspace/members/${h.seeded.users.betaOwner.id}`)).status === 404);

  await tryCheck("member leaves: 200, calendar transferred", async () => {
    const r = await api(dLeaver, host, "POST", "/api/workspace/leave");
    const cal = (await db.select().from(s.calendars).where(eq(s.calendars.id, leaverCal.id)))[0];
    return r.status === 200 && r.json?.calendarsTransferred === 1 && cal.ownerId === dOwner.id && !(await isMember(dLeaver.id));
  });
  await tryCheck("leaver's share, subscription and feed token are gone", async () => {
    const shares = await db.select().from(s.calendarShares).where(and(eq(s.calendarShares.userId, dLeaver.id), eq(s.calendarShares.calendarId, ownerCal.id)));
    const subs = await db.select().from(s.userCalendarSubscriptions).where(eq(s.userCalendarSubscriptions.userId, dLeaver.id));
    const feeds = await db.select().from(s.calendarFeedTokens).where(eq(s.calendarFeedTokens.userId, dLeaver.id));
    return shares.length === 0 && subs.length === 0 && feeds.length === 0;
  });
  await tryCheck("leaver's old feed URL is 404", async () =>
    (await api(null, host, "GET", `/api/feed/${leaverFeed}`)).status === 404);
  await tryCheck("leaver no longer sees the formerly shared calendar", async () => !(await listsCalendar(dLeaver, ownerCal.id)));
  await tryCheck("admin removes a member: 200 and share gone", async () => {
    const r = await api(dAdmin, host, "DELETE", `/api/workspace/members/${dKicked.id}`);
    const shares = await db.select().from(s.calendarShares).where(eq(s.calendarShares.userId, dKicked.id));
    return r.status === 200 && !(await isMember(dKicked.id)) && shares.length === 0;
  });
  // Defence in depth: re-insert a share by hand and make sure the membership gate still refuses it.
  await db.insert(s.calendarShares).values({ calendarId: kickedShareCal.id, userId: dKicked.id, bundleId: kickedShareCal.bundleId, sharedBy: dOwner.id });
  await tryCheck("stale share row alone grants no access to a non-member", async () => {
    const r = await api(dKicked, host, "GET", `/api/calendars/${kickedShareCal.id}`);
    return r.status === 404 || r.status === 403;
  });
  await tryCheck("stale share row does not list the calendar for a non-member", async () =>
    !(await listsCalendar(dKicked, kickedShareCal.id)));
  await tryCheck("membership APIs are 404 on the portal", async () =>
    (await api(dOwner, h.portalHost, "GET", "/api/workspace/members")).status === 404);
}

/**
 * endMembership only touches the leaving user's grants in the workspace they leave, and the
 * new owner's stale grants on calendars transferred to them — everything else must survive.
 */
async function checkMembershipEndScoping({ h, db, schema, eq, and, api, tryCheck }: Ctx): Promise<void> {
  console.log("\nStage 4c-2: membership end cross-workspace scoping");
  const s = schema;
  const [epsilon] = await db.insert(s.organization).values({ id: crypto.randomUUID(), name: "Epsilon", slug: "epsilon-end" }).returning();
  const [zeta] = await db.insert(s.organization).values({ id: crypto.randomUUID(), name: "Zeta", slug: "zeta-end" }).returning();
  const epsilonHost = `epsilon-end.${h.baseDomain}`;
  const eOwner = await h.seedUser("e-owner@tenancy.test");
  const eOther = await h.seedUser("e-other@tenancy.test");
  const eLeaver = await h.seedUser("e-leaver@tenancy.test");
  const zOwner = await h.seedUser("z-owner@tenancy.test");
  await h.seedMemberships(epsilon.id, [[eOwner, "owner"], [eOther, "member"], [eLeaver, "member"]]);
  await h.seedMemberships(zeta.id, [[zOwner, "owner"], [eLeaver, "member"]]);

  // Owner's calendar in epsilon, shared with the leaver (share + subscription + feed token).
  const eOwnerCal = await h.seedCalendar(epsilon.id, eOwner.id, "Epsilon Owner Cal", eLeaver.id);
  await db.insert(s.userCalendarSubscriptions).values({ userId: eLeaver.id, calendarId: eOwnerCal.id, status: "subscribed", source: "shared" });
  await h.seedFeedToken(eOwnerCal.id, eLeaver.id);
  // Leaver's own calendar in epsilon, shared with a third member who must keep their access.
  const eLeaverCal = await h.seedCalendar(epsilon.id, eLeaver.id, "Epsilon Leaver Cal", eOther.id);
  // Stale grant: the eventual new owner (eOwner) already has a share + subscription on the
  // leaver's calendar; transfer must clean those up so eOwner doesn't see their own calendar as dismissed.
  await db.insert(s.calendarShares).values({ calendarId: eLeaverCal.id, userId: eOwner.id, bundleId: eLeaverCal.bundleId, sharedBy: eLeaver.id });
  await db.insert(s.userCalendarSubscriptions).values({ userId: eOwner.id, calendarId: eLeaverCal.id, status: "subscribed", source: "shared" });
  // Owner's calendar in zeta, shared with the same leaver (share + subscription + feed token) — the "other workspace".
  const zOwnerCal = await h.seedCalendar(zeta.id, zOwner.id, "Zeta Owner Cal", eLeaver.id);
  await db.insert(s.userCalendarSubscriptions).values({ userId: eLeaver.id, calendarId: zOwnerCal.id, status: "subscribed", source: "shared" });
  await h.seedFeedToken(zOwnerCal.id, eLeaver.id);

  await tryCheck("leaver leaves epsilon: calendar transferred to the epsilon owner", async () => {
    const r = await api(eLeaver, epsilonHost, "POST", "/api/workspace/leave");
    const cal = (await db.select().from(s.calendars).where(eq(s.calendars.id, eLeaverCal.id)))[0];
    return r.status === 200 && r.json?.calendarsTransferred === 1 && cal.ownerId === eOwner.id;
  });
  await tryCheck("leaver's share/subscription/feed token in the OTHER workspace (zeta) survive", async () => {
    const shares = await db.select().from(s.calendarShares).where(and(eq(s.calendarShares.userId, eLeaver.id), eq(s.calendarShares.calendarId, zOwnerCal.id)));
    const subs = await db.select().from(s.userCalendarSubscriptions).where(and(eq(s.userCalendarSubscriptions.userId, eLeaver.id), eq(s.userCalendarSubscriptions.calendarId, zOwnerCal.id)));
    const feeds = await db.select().from(s.calendarFeedTokens).where(and(eq(s.calendarFeedTokens.userId, eLeaver.id), eq(s.calendarFeedTokens.calendarId, zOwnerCal.id)));
    return shares.length === 1 && subs.length === 1 && feeds.length === 1;
  });
  await tryCheck("third member's share on the transferred calendar survives", async () => {
    const shares = await db.select().from(s.calendarShares).where(and(eq(s.calendarShares.userId, eOther.id), eq(s.calendarShares.calendarId, eLeaverCal.id)));
    return shares.length === 1;
  });
  await tryCheck("new owner's stale share and subscription on the transferred calendar are gone", async () => {
    const shares = await db.select().from(s.calendarShares).where(and(eq(s.calendarShares.userId, eOwner.id), eq(s.calendarShares.calendarId, eLeaverCal.id)));
    const subs = await db.select().from(s.userCalendarSubscriptions).where(and(eq(s.userCalendarSubscriptions.userId, eOwner.id), eq(s.userCalendarSubscriptions.calendarId, eLeaverCal.id)));
    return shares.length === 0 && subs.length === 0;
  });
}

async function checkAdminMemberships({ h, db, schema, eq, and, api, tryCheck }: Ctx): Promise<void> {
  console.log("\nStage 4d: instance admin workspace memberships");
  const host = `alpha.${h.baseDomain}`;
  const { admin, alphaOwner, alphaMember } = h.seeded.users;
  const target = await h.seedUser("admin-target@tenancy.test");
  const betaId = h.seeded.workspaces.beta.id;
  const path = `/api/admin/users/${target.id}/workspaces`;
  const role = async () =>
    (await db.select().from(schema.member).where(and(eq(schema.member.organizationId, betaId), eq(schema.member.userId, target.id))))[0]?.role;

  await tryCheck("non-admin cannot add memberships (403)", async () =>
    (await api(alphaMember, host, "POST", path, { slug: "beta", role: "member" })).status === 403 && !(await role()));
  await tryCheck("admin adds the user to beta as admin", async () =>
    (await api(admin, host, "POST", path, { slug: "beta", role: "admin" })).status === 201 && (await role()) === "admin");
  await tryCheck("adding twice is 409", async () =>
    (await api(admin, host, "POST", path, { slug: "beta", role: "member" })).status === 409);
  await tryCheck("owner role cannot be granted (400)", async () =>
    (await api(admin, host, "POST", path, { slug: "alpha", role: "owner" })).status === 400);
  await tryCheck("unknown slug is 404", async () =>
    (await api(admin, host, "POST", path, { slug: "nope-nope", role: "member" })).status === 404);
  await tryCheck("admin lists the memberships", async () => {
    const r = await api(admin, host, "GET", path);
    return r.status === 200 && ((r.json?.workspaces ?? []) as Array<{ slug: string }>).some((w) => w.slug === "beta");
  });
  await tryCheck("admin removes the membership", async () =>
    (await api(admin, host, "DELETE", `${path}?workspaceId=${betaId}`)).status === 200 && !(await role()));
  await tryCheck("admin cannot remove a workspace owner (409)", async () =>
    (await api(admin, host, "DELETE", `/api/admin/users/${alphaOwner.id}/workspaces?workspaceId=${h.seeded.workspaces.alpha.id}`)).status === 409);
}
