/**
 * Stage 5: workspace-scope admin APIs (sub-project 4a). Loaded by tenant-isolation-check.ts
 * after the onboarding stage, so importing lib/db here is safe.
 */
import type { OnboardingHarness } from "./tenancy-onboarding-checks";
import type * as Harness from "./tenant-isolation-check";

type SeedUser = Harness.SeedUser;
type Api = (as: SeedUser | null, host: string, method: string, path: string, body?: unknown) =>
  Promise<{ status: number; json: Record<string, unknown> | null; headers: Record<string, unknown> }>;

export async function runAdminChecks(h: OnboardingHarness): Promise<void> {
  const { db } = await import("../lib/db");
  const schema = await import("../lib/db/schema");
  const { eq, and, count } = await import("drizzle-orm");

  const api: Api = async (as, host, method, path, body) => {
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

  const newWorkspace = async (slug: string) => {
    const [ws] = await db.insert(schema.organization).values({ id: crypto.randomUUID(), name: slug, slug }).returning();
    return ws;
  };
  const addMember = (workspaceId: string, u: SeedUser, role: "owner" | "admin" | "member") =>
    db.insert(schema.member).values({ id: crypto.randomUUID(), organizationId: workspaceId, userId: u.id, role });
  const roleOf = async (workspaceId: string, userId: string) =>
    (await db.select({ role: schema.member.role }).from(schema.member)
      .where(and(eq(schema.member.organizationId, workspaceId), eq(schema.member.userId, userId))))[0]?.role ?? null;
  const owners = async (workspaceId: string) =>
    db.select().from(schema.member).where(and(eq(schema.member.organizationId, workspaceId), eq(schema.member.role, "owner")));
  const memberCount = async (workspaceId: string) =>
    (await db.select({ n: count() }).from(schema.member).where(eq(schema.member.organizationId, workspaceId)))[0].n;

  // Each actor gets its own users so the per-user mutation rate limit (30 per window) is never hit.
  await checkRolesAndMembers();
  await checkSettingsAndStats();
  await checkJoinLinkRoles();
  await checkTransfer();
  await checkGuards();
  await checkDelete();

  async function checkRolesAndMembers() {
    console.log("\nStage 5a: role changes and member removal");
    const ws = await newWorkspace("adm-roles");
    const host = `adm-roles.${h.baseDomain}`;
    const owner = await h.seedUser("adm-r-owner@tenancy.test");
    const admin = await h.seedUser("adm-r-admin@tenancy.test");
    const m1 = await h.seedUser("adm-r-m1@tenancy.test");
    const m2 = await h.seedUser("adm-r-m2@tenancy.test");
    const m3 = await h.seedUser("adm-r-m3@tenancy.test");
    const m4 = await h.seedUser("adm-r-m4@tenancy.test");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, admin, "admin");
    for (const u of [m1, m2, m3, m4]) await addMember(ws.id, u, "member");
    const patch = (as: SeedUser, target: SeedUser, role: unknown) =>
      api(as, host, "PATCH", `/api/workspace/members/${target.id}`, { role });

    await tryCheck("owner PATCH member->admin is 200 and the row is admin", async () =>
      (await patch(owner, m1, "admin")).status === 200 && (await roleOf(ws.id, m1.id)) === "admin");
    await tryCheck("admin PATCH member->admin is 403, row unchanged", async () =>
      (await patch(admin, m2, "admin")).status === 403 && (await roleOf(ws.id, m2.id)) === "member");
    await tryCheck("admin PATCH admin->member is 403, row unchanged", async () =>
      (await patch(admin, m1, "member")).status === 403 && (await roleOf(ws.id, m1.id)) === "admin");
    await tryCheck("member PATCH is 403", async () => (await patch(m2, m3, "admin")).status === 403);
    await tryCheck("owner PATCH the owner's role is 409 owner", async () => {
      const r = await patch(owner, owner, "member");
      return r.status === 409 && r.json?.code === "owner" && (await roleOf(ws.id, owner.id)) === "owner";
    });
    await tryCheck("body role 'owner' is 400", async () =>
      (await patch(owner, m2, "owner")).status === 400 && (await roleOf(ws.id, m2.id)) === "member");
    await tryCheck("PATCH of a non-member is 404 not_member", async () => {
      const stranger = await h.seedUser("adm-r-stranger@tenancy.test");
      const r = await patch(owner, stranger, "admin");
      return r.status === 404 && r.json?.code === "not_member";
    });
    await tryCheck("admin DELETE member is 200", async () => {
      const r = await api(admin, host, "DELETE", `/api/workspace/members/${m4.id}`);
      return r.status === 200 && (await roleOf(ws.id, m4.id)) === null;
    });
    await tryCheck("admin DELETE admin is 403, row stays", async () =>
      (await api(admin, host, "DELETE", `/api/workspace/members/${m1.id}`)).status === 403 && (await roleOf(ws.id, m1.id)) === "admin");
    await tryCheck("admin DELETE owner is 409/403, row stays", async () => {
      const r = await api(admin, host, "DELETE", `/api/workspace/members/${owner.id}`);
      return (r.status === 409 || r.status === 403) && (await roleOf(ws.id, owner.id)) === "owner";
    });
    await tryCheck("owner DELETE admin is 200", async () =>
      (await api(owner, host, "DELETE", `/api/workspace/members/${m1.id}`)).status === 200 && (await roleOf(ws.id, m1.id)) === null);
  }

  async function checkSettingsAndStats() {
    console.log("\nStage 5b: settings and stats");
    const ws = await newWorkspace("adm-settings");
    const host = `adm-settings.${h.baseDomain}`;
    const owner = await h.seedUser("adm-s-owner@tenancy.test");
    const admin = await h.seedUser("adm-s-admin@tenancy.test");
    const plain = await h.seedUser("adm-s-member@tenancy.test");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, admin, "admin");
    await addMember(ws.id, plain, "member");
    const cal = await h.seedCalendar(ws.id, owner.id, "Settings Cal", plain.id);
    void cal;
    await h.seedCalendar(ws.id, owner.id, "Settings Cal 2", plain.id);
    await api(owner, host, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: null });
    const settingsRows = async (workspaceId: string) =>
      db.select().from(schema.workspaceSettings).where(eq(schema.workspaceSettings.workspaceId, workspaceId));
    const defaultBefore = JSON.stringify(await settingsRows("default"));

    await tryCheck("member GET settings is 403", async () =>
      (await api(plain, host, "GET", "/api/workspace/settings")).status === 403);
    await tryCheck("admin GET settings is 200 with the documented shape", async () => {
      const r = await api(admin, host, "GET", "/api/workspace/settings");
      return r.status === 200 && r.json?.slug === "adm-settings" && typeof r.json?.allowGuestAccess === "boolean" &&
        typeof r.json?.inheritedGuestAccess === "boolean";
    });
    await tryCheck("admin PATCH settings is 403", async () =>
      (await api(admin, host, "PATCH", "/api/workspace/settings", { name: "Nope" })).status === 403);
    await tryCheck("owner PATCH name is 200 and GET /api/workspace shows it", async () => {
      const r = await api(owner, host, "PATCH", "/api/workspace/settings", { name: "  Renamed Team  " });
      const g = await api(owner, host, "GET", "/api/workspace");
      return r.status === 200 && g.json?.name === "Renamed Team";
    });
    await tryCheck("owner PATCH empty or oversized name is 400", async () => {
      const a = await api(owner, host, "PATCH", "/api/workspace/settings", { name: "   " });
      const b = await api(owner, host, "PATCH", "/api/workspace/settings", { name: "x".repeat(500) });
      return a.status === 400 && b.status === 400;
    });
    await tryCheck("owner PATCH allowGuestAccess writes this workspace's row only", async () => {
      const r = await api(owner, host, "PATCH", "/api/workspace/settings", { allowGuestAccess: true });
      const own = await settingsRows(ws.id);
      const g = await api(admin, host, "GET", "/api/workspace/settings");
      return r.status === 200 && own.length === 1 && own[0].allowGuestAccess === true &&
        g.json?.allowGuestAccess === true && g.json?.inheritedGuestAccess === false &&
        JSON.stringify(await settingsRows("default")) === defaultBefore;
    });
    await tryCheck("PATCH with a non-boolean value or empty body is 400", async () => {
      const a = await api(owner, host, "PATCH", "/api/workspace/settings", { allowGuestAccess: "yes" });
      const b = await api(owner, host, "PATCH", "/api/workspace/settings", {});
      return a.status === 400 && b.status === 400;
    });
    await tryCheck("member GET stats is 403", async () =>
      (await api(plain, host, "GET", "/api/workspace/stats")).status === 403);
    await tryCheck("owner GET stats equals the DB counts", async () => {
      const r = await api(owner, host, "GET", "/api/workspace/stats");
      const cals = (await db.select({ n: count() }).from(schema.calendars).where(eq(schema.calendars.workspaceId, ws.id)))[0].n;
      const shiftN = (await db.select({ n: count() }).from(schema.shifts)
        .innerJoin(schema.calendars, eq(schema.shifts.calendarId, schema.calendars.id))
        .where(eq(schema.calendars.workspaceId, ws.id)))[0].n;
      const links = (await db.select({ n: count() }).from(schema.workspaceJoinLinks)
        .where(eq(schema.workspaceJoinLinks.workspaceId, ws.id)))[0].n;
      return r.status === 200 && r.json?.members === (await memberCount(ws.id)) && r.json?.calendars === cals &&
        r.json?.shifts === shiftN && r.json?.activeJoinLinks === links && cals === 2 && shiftN === 2 && links === 1;
    });
  }

  async function checkJoinLinkRoles() {
    console.log("\nStage 5c: join link roles");
    const ws = await newWorkspace("adm-links");
    const host = `adm-links.${h.baseDomain}`;
    const owner = await h.seedUser("adm-l-owner@tenancy.test");
    const admin = await h.seedUser("adm-l-admin@tenancy.test");
    const joiner = await h.seedUser("adm-l-joiner@tenancy.test");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, admin, "admin");
    const none = { expiresInDays: null, maxUses: null };

    await tryCheck("admin POST join link with role admin is 403", async () =>
      (await api(admin, host, "POST", "/api/workspace/join-links", { ...none, role: "admin" })).status === 403);
    await tryCheck("invalid link role is 400", async () =>
      (await api(owner, host, "POST", "/api/workspace/join-links", { ...none, role: "owner" })).status === 400);
    let adminLink: { id: string; token: string } | null = null;
    await tryCheck("owner POST join link with role admin is 201 and carries the role", async () => {
      const r = await api(owner, host, "POST", "/api/workspace/join-links", { ...none, role: "admin" });
      const link = r.json?.link as { id: string; token: string; role: string } | undefined;
      adminLink = link ?? null;
      return r.status === 201 && link?.role === "admin";
    });
    await tryCheck("redeeming the admin link makes the joiner an admin", async () => {
      if (!adminLink) return false;
      const r = await api(joiner, h.portalHost, "POST", `/api/join/${adminLink.token}`);
      return r.status === 200 && (await roleOf(ws.id, joiner.id)) === "admin";
    });
    await tryCheck("admin DELETE an admin-role link is 403, link stays active", async () => {
      if (!adminLink) return false;
      const r = await api(admin, host, "DELETE", `/api/workspace/join-links/${adminLink.id}`);
      const row = (await db.select().from(schema.workspaceJoinLinks).where(eq(schema.workspaceJoinLinks.id, adminLink.id)))[0];
      return r.status === 403 && row.revokedAt === null;
    });
    await tryCheck("admin POST default role creates a member link and may revoke it", async () => {
      const c = await api(admin, host, "POST", "/api/workspace/join-links", none);
      const link = c.json?.link as { id: string; role: string };
      const d = await api(admin, host, "DELETE", `/api/workspace/join-links/${link.id}`);
      return c.status === 201 && link.role === "member" && d.status === 200;
    });
    await tryCheck("owner may revoke the admin-role link", async () =>
      !!adminLink && (await api(owner, host, "DELETE", `/api/workspace/join-links/${adminLink.id}`)).status === 200);
    await tryCheck("DELETE of an unknown link id is 404", async () =>
      (await api(owner, host, "DELETE", `/api/workspace/join-links/${crypto.randomUUID()}`)).status === 404);
  }

  async function checkTransfer() {
    console.log("\nStage 5d: ownership transfer");
    const ws = await newWorkspace("adm-transfer");
    const host = `adm-transfer.${h.baseDomain}`;
    const owner = await h.seedUser("adm-t-owner@tenancy.test");
    const admin = await h.seedUser("adm-t-admin@tenancy.test");
    const target = await h.seedUser("adm-t-target@tenancy.test");
    const capped = await h.seedUser("adm-t-capped@tenancy.test");
    const outsider = await h.seedUser("adm-t-outsider@tenancy.test");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, admin, "admin");
    await addMember(ws.id, target, "member");
    await addMember(ws.id, capped, "member");
    const transfer = (as: SeedUser, userId: unknown) => api(as, host, "POST", "/api/workspace/transfer", { userId });

    await tryCheck("transfer to self is 409 self", async () => {
      const r = await transfer(owner, owner.id);
      return r.status === 409 && r.json?.code === "self";
    });
    await tryCheck("transfer to a non-member is 404 not_member", async () => {
      const r = await transfer(owner, outsider.id);
      return r.status === 404 && r.json?.code === "not_member";
    });
    await tryCheck("admin transfer is 403, ownership unchanged", async () =>
      (await transfer(admin, target.id)).status === 403 && (await owners(ws.id)).length === 1 && (await roleOf(ws.id, owner.id)) === "owner");
    await tryCheck("missing userId is 400", async () => (await transfer(owner, undefined)).status === 400);
    await tryCheck("target already at the workspace limit is 409 limit", async () => {
      for (const slug of ["adm-cap-1", "adm-cap-2", "adm-cap-3"]) {
        const cw = await newWorkspace(slug);
        await addMember(cw.id, capped, "owner");
      }
      const r = await transfer(owner, capped.id);
      return r.status === 409 && r.json?.code === "limit" && (await roleOf(ws.id, owner.id)) === "owner";
    });
    await tryCheck("owner transfers to a member: 200, exactly one owner (target), old owner is admin", async () => {
      const r = await transfer(owner, target.id);
      const o = await owners(ws.id);
      return r.status === 200 && o.length === 1 && o[0].userId === target.id && (await roleOf(ws.id, owner.id)) === "admin";
    });
    await tryCheck("the former owner can no longer transfer (403)", async () =>
      (await transfer(owner, capped.id)).status === 403);
    await tryCheck("two concurrent transfers: exactly one 200, exactly one owner afterwards", async () => {
      const second = await h.seedUser("adm-t-second@tenancy.test");
      await addMember(ws.id, second, "member");
      // Warm the session so both requests race on the transfer, not on sign-in.
      await api(target, host, "GET", "/api/workspace");
      const [a, b] = await Promise.all([transfer(target, admin.id), transfer(target, second.id)]);
      const statuses = [a.status, b.status].sort();
      const o = await owners(ws.id);
      return statuses.filter((s) => s === 200).length === 1 && o.length === 1 && o[0].userId !== target.id;
    });
    await tryCheck("the transfer audit row exists", async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "workspace.owner_transfer"));
      return logs.some((l) => l.workspaceId === ws.id && JSON.parse(l.metadata ?? "{}").toUser === target.id);
    });
  }

  async function checkGuards() {
    console.log("\nStage 5e: outsiders, instance admins and cross-workspace access");
    const ws = await newWorkspace("adm-guard");
    const other = await newWorkspace("adm-guard-b");
    const host = `adm-guard.${h.baseDomain}`;
    const owner = await h.seedUser("adm-g-owner@tenancy.test");
    const member = await h.seedUser("adm-g-member@tenancy.test");
    const otherOwner = await h.seedUser("adm-g-b-owner@tenancy.test");
    const outsider = await h.seedUser("adm-g-outsider@tenancy.test");
    const instanceAdmin = await h.seedUser("adm-g-instance-admin@tenancy.test", "admin");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, member, "member");
    await addMember(other.id, otherOwner, "owner");
    await addMember(other.id, member, "member");
    const snapshot = async (id: string) => JSON.stringify([
      await db.select().from(schema.organization).where(eq(schema.organization.id, id)),
      await db.select().from(schema.member).where(eq(schema.member.organizationId, id)),
      await db.select().from(schema.workspaceSettings).where(eq(schema.workspaceSettings.workspaceId, id)),
    ]);
    const before = await snapshot(ws.id);

    const attempts = async (as: SeedUser) => {
      const results = [
        await api(as, host, "GET", "/api/workspace/stats"),
        await api(as, host, "GET", "/api/workspace/settings"),
        await api(as, host, "PATCH", "/api/workspace/settings", { name: "Hijack", allowGuestAccess: true }),
        await api(as, host, "POST", "/api/workspace/transfer", { userId: as.id }),
        await api(as, host, "PATCH", `/api/workspace/members/${member.id}`, { role: "admin" }),
        await api(as, host, "DELETE", `/api/workspace/members/${member.id}`),
        await api(as, host, "DELETE", "/api/workspace", { confirmSlug: "adm-guard" }),
      ];
      return results.every((r) => r.status === 403 || r.status === 404);
    };
    await tryCheck("non-member outsider is refused on every workspace admin route", () => attempts(outsider));
    await tryCheck("instance admin without membership is refused on every workspace admin route", () => attempts(instanceAdmin));
    await tryCheck("owner of another workspace is refused on this host", () => attempts(otherOwner));
    await tryCheck("plain member is refused on every workspace admin route", () => attempts(member));
    await tryCheck("nothing changed in the guarded workspace", async () =>
      (await snapshot(ws.id)) === before && (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id))).length === 1);
    await tryCheck("anonymous requests are refused (401, or the proxy login redirect)", async () =>
      [401, 307].includes((await api(null, host, "GET", "/api/workspace/stats")).status) &&
      [401, 307].includes((await api(null, host, "DELETE", "/api/workspace", { confirmSlug: "adm-guard" })).status));
    await tryCheck("the portal host has no workspace admin routes (404)", async () =>
      (await api(owner, h.portalHost, "GET", "/api/workspace/stats")).status === 404);
  }

  async function checkDelete() {
    console.log("\nStage 5f: workspace deletion");
    const ws = await newWorkspace("adm-delete");
    const keep = await newWorkspace("adm-delete-keep");
    const host = `adm-delete.${h.baseDomain}`;
    const owner = await h.seedUser("adm-d-owner@tenancy.test");
    const admin = await h.seedUser("adm-d-admin@tenancy.test");
    const keepOwner = await h.seedUser("adm-d-keep-owner@tenancy.test");
    const defaultOwner = await h.seedUser("adm-d-default-owner@tenancy.test");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, admin, "admin");
    await addMember(keep.id, keepOwner, "owner");
    await addMember("default", defaultOwner, "owner");
    const cal = await h.seedCalendar(ws.id, owner.id, "Delete Cal", admin.id);
    await h.seedCalendar(keep.id, keepOwner.id, "Keep Cal", keepOwner.id);
    await api(owner, host, "POST", "/api/workspace/join-links", { expiresInDays: null, maxUses: null });
    await api(owner, host, "PATCH", "/api/workspace/settings", { allowGuestAccess: true });
    await db.insert(schema.announcements).values({ title: "ws", workspaceId: ws.id });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const keepBefore = JSON.stringify([
      await db.select().from(schema.calendars).where(eq(schema.calendars.workspaceId, keep.id)),
      await db.select().from(schema.member).where(eq(schema.member.organizationId, keep.id)),
    ]);

    await tryCheck("admin DELETE workspace is 403", async () =>
      (await api(admin, host, "DELETE", "/api/workspace", { confirmSlug: "adm-delete" })).status === 403);
    await tryCheck("wrong confirmSlug is 400 confirmation_mismatch and nothing is deleted", async () => {
      const r = await api(owner, host, "DELETE", "/api/workspace", { confirmSlug: "nope" });
      const none = await api(owner, host, "DELETE", "/api/workspace");
      return r.status === 400 && r.json?.code === "confirmation_mismatch" && none.status === 400 &&
        (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id))).length === 1;
    });
    await tryCheck("deleting the default workspace is 409 default", async () => {
      const r = await api(defaultOwner, `default.${h.baseDomain}`, "DELETE", "/api/workspace", { confirmSlug: "default" });
      return r.status === 409 && r.json?.code === "default" &&
        (await db.select().from(schema.organization).where(eq(schema.organization.id, "default"))).length === 1;
    });
    await tryCheck("owner DELETE with the right slug is 200 and everything of the workspace is gone", async () => {
      const r = await api(owner, host, "DELETE", "/api/workspace", { confirmSlug: "adm-delete" });
      const gone = async (rows: Promise<unknown[]>) => (await rows).length === 0;
      const shiftsLeft = (await db.select({ n: count() }).from(schema.shifts).where(eq(schema.shifts.calendarId, cal.id)))[0].n;
      const users = await db.select({ id: schema.user.id }).from(schema.user)
        .where(eq(schema.user.id, owner.id));
      return r.status === 200 &&
        (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id))).length === 0 &&
        (await gone(db.select().from(schema.calendars).where(eq(schema.calendars.workspaceId, ws.id)))) &&
        (await gone(db.select().from(schema.member).where(eq(schema.member.organizationId, ws.id)))) &&
        (await gone(db.select().from(schema.workspaceJoinLinks).where(eq(schema.workspaceJoinLinks.workspaceId, ws.id)))) &&
        (await gone(db.select().from(schema.workspaceSettings).where(eq(schema.workspaceSettings.workspaceId, ws.id)))) &&
        shiftsLeft === 0 && users.length === 1;
    });
    await tryCheck("the next request to the host is 404 (slug cache invalidated)", async () =>
      (await api(null, host, "GET", "/api/workspace")).status === 404);
    await tryCheck("the workspace's own audit rows and announcements are gone", async () =>
      (await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.workspaceId, ws.id))).length === 0 &&
      (await db.select().from(schema.announcements).where(eq(schema.announcements.workspaceId, ws.id))).length === 0);
    await tryCheck("the delete audit row survives as an instance-level entry", async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      const logs = await db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, "workspace.delete"));
      return logs.some((l) => l.workspaceId === null && JSON.parse(l.metadata ?? "{}").slug === "adm-delete");
    });
    await tryCheck("another workspace is untouched", async () =>
      JSON.stringify([
        await db.select().from(schema.calendars).where(eq(schema.calendars.workspaceId, keep.id)),
        await db.select().from(schema.member).where(eq(schema.member.organizationId, keep.id)),
      ]) === keepBefore);
  }
}
