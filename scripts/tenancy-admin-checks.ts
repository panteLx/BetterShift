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
  await checkInstanceApi();
  await checkAdminGuard();

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

  async function checkInstanceApi() {
    console.log("\nStage 5g: instance-scope workspace APIs");
    const portal = h.portalHost;
    const iaOwner = await h.seedUser("adm-i-owner@tenancy.test");
    const iaMember = await h.seedUser("adm-i-member@tenancy.test");
    const iaPlain = await h.seedUser("adm-i-plain@tenancy.test");
    const cappedOwner = await h.seedUser("adm-i-capped@tenancy.test");
    const stranger = await h.seedUser("adm-i-stranger@tenancy.test");
    const admin = await h.seedUser("adm-i-admin@tenancy.test", "admin");
    const admin2 = await h.seedUser("adm-i-admin2@tenancy.test", "admin");
    const admin3 = await h.seedUser("adm-i-admin3@tenancy.test", "admin");
    const superA = await h.seedUser("adm-i-super@tenancy.test", "superadmin");
    const ws = await newWorkspace("adm-inst");
    const wsHost = `adm-inst.${h.baseDomain}`;
    await addMember(ws.id, iaOwner, "owner");
    await addMember(ws.id, iaMember, "member");
    await h.seedCalendar(ws.id, iaOwner.id, "Inst Cal", iaMember.id);
    const listPath = "/api/admin/workspaces";
    const audit = async (action: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return db.select().from(schema.auditLogs).where(eq(schema.auditLogs.action, action));
    };

    await tryCheck("portal GET workspaces as instance admin lists every workspace with owner and counts", async () => {
      const r = await api(admin, portal, "GET", listPath);
      const list = (r.json?.workspaces ?? []) as { id: string; slug: string; owner: { id: string } | null; memberCount: number; calendarCount: number }[];
      const orgs = await db.select().from(schema.organization);
      if (r.status !== 200 || list.length !== orgs.length) return false;
      for (const o of orgs) {
        const row = list.find((w) => w.id === o.id);
        const ownerRow = (await owners(o.id))[0];
        const cals = (await db.select({ n: count() }).from(schema.calendars).where(eq(schema.calendars.workspaceId, o.id)))[0].n;
        if (!row || (row.owner?.id ?? null) !== (ownerRow?.userId ?? null) || row.memberCount !== (await memberCount(o.id)) || row.calendarCount !== cals) return false;
      }
      return list.find((w) => w.id === ws.id)?.calendarCount === 1;
    });
    await tryCheck("GET workspaces: non-admin 403, anonymous 401", async () =>
      (await api(iaPlain, portal, "GET", listPath)).status === 403 && (await api(null, portal, "GET", listPath)).status === 401);
    await tryCheck("a workspace host has no instance workspace routes (404), even for the instance admin", async () =>
      (await api(admin, wsHost, "GET", listPath)).status === 404 &&
      (await api(superA, wsHost, "DELETE", `${listPath}/${ws.id}`, { confirmSlug: "adm-inst" })).status === 404);

    await tryCheck("admin PATCH name is 200 with an audit row for that workspace", async () => {
      const r = await api(admin, portal, "PATCH", `${listPath}/${ws.id}`, { name: " Inst Renamed " });
      const rows = await audit("workspace.rename");
      return r.status === 200 && rows.some((l) => l.workspaceId === ws.id && JSON.parse(l.metadata ?? "{}").to === "Inst Renamed") &&
        (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id)))[0].name === "Inst Renamed";
    });
    await tryCheck("admin PATCH empty or oversized name is 400, unknown workspace 404", async () =>
      (await api(admin, portal, "PATCH", `${listPath}/${ws.id}`, { name: "  " })).status === 400 &&
      (await api(admin, portal, "PATCH", `${listPath}/${ws.id}`, { name: "x".repeat(500) })).status === 400 &&
      (await api(admin, portal, "PATCH", `${listPath}/${crypto.randomUUID()}`, { name: "Ghost" })).status === 404);

    await tryCheck("members: GET lists, POST by email is 201 with the given role", async () => {
      const g = await api(admin, portal, "GET", `${listPath}/${ws.id}/members`);
      const a = await api(admin, portal, "POST", `${listPath}/${ws.id}/members`, { email: iaPlain.email, role: "admin" });
      return g.status === 200 && (g.json?.members as unknown[]).length === 2 && a.status === 201 && (await roleOf(ws.id, iaPlain.id)) === "admin";
    });
    await tryCheck("members: duplicate 409, unknown email 404, bad role 400", async () =>
      (await api(admin, portal, "POST", `${listPath}/${ws.id}/members`, { email: iaPlain.email, role: "member" })).status === 409 &&
      (await api(admin, portal, "POST", `${listPath}/${ws.id}/members`, { email: "nobody-here@tenancy.test", role: "member" })).status === 404 &&
      (await api(admin, portal, "POST", `${listPath}/${ws.id}/members`, { email: stranger.email, role: "owner" })).status === 400);
    await tryCheck("members: DELETE removes the member and hands their calendars to the owner", async () => {
      await h.seedCalendar(ws.id, iaPlain.id, "Plain Cal", iaPlain.id);
      const r = await api(admin, portal, "DELETE", `${listPath}/${ws.id}/members?userId=${iaPlain.id}`);
      const cals = await db.select().from(schema.calendars).where(and(eq(schema.calendars.workspaceId, ws.id), eq(schema.calendars.name, "Plain Cal")));
      return r.status === 200 && r.json?.calendarsTransferred === 1 && (await roleOf(ws.id, iaPlain.id)) === null && cals[0]?.ownerId === iaOwner.id;
    });
    await tryCheck("members: DELETE of the owner is 409, of a non-member 404", async () =>
      (await api(admin3, portal, "DELETE", `${listPath}/${ws.id}/members?userId=${iaOwner.id}`)).status === 409 &&
      (await api(admin3, portal, "DELETE", `${listPath}/${ws.id}/members?userId=${stranger.id}`)).status === 404 &&
      (await roleOf(ws.id, iaOwner.id)) === "owner");
    await tryCheck("members: non-admin is 403", async () =>
      (await api(iaMember, portal, "GET", `${listPath}/${ws.id}/members`)).status === 403);

    await tryCheck("users?workspaceId returns only that workspace's members, each row with workspaces[]", async () => {
      const r = await api(admin, portal, "GET", `/api/admin/users?workspaceId=${ws.id}&limit=100`);
      const items = (r.json?.items ?? []) as { id: string; workspaces: { id: string; slug: string }[] }[];
      const ids = items.map((u) => u.id).sort();
      return r.status === 200 && r.json?.total === 2 && JSON.stringify(ids) === JSON.stringify([iaOwner.id, iaMember.id].sort()) &&
        items.every((u) => Array.isArray(u.workspaces) && u.workspaces.some((w) => w.id === ws.id && w.slug === "adm-inst"));
    });
    await tryCheck("calendars?workspaceId returns only that workspace's calendars", async () => {
      const r = await api(admin, portal, "GET", `/api/admin/calendars?workspaceId=${ws.id}&limit=100`);
      const items = (r.json?.items ?? []) as { workspaceId: string; workspaceSlug: string }[];
      return r.status === 200 && items.length === 2 && items.every((c) => c.workspaceId === ws.id && c.workspaceSlug === "adm-inst");
    });

    await tryCheck("admin transfer to a non-member is 404, unknown workspace without owner 409", async () => {
      const r = await api(admin2, portal, "POST", `${listPath}/${ws.id}/transfer`, { userId: stranger.id });
      const bare = await newWorkspace("adm-inst-bare");
      const n = await api(admin2, portal, "POST", `${listPath}/${bare.id}/transfer`, { userId: stranger.id });
      return r.status === 404 && n.status === 409 && n.json?.code === "no_owner";
    });
    await tryCheck("admin transfer to a member at the owner limit is 200 (exempt), old owner becomes admin", async () => {
      for (const slug of ["adm-icap-1", "adm-icap-2", "adm-icap-3"]) {
        const cw = await newWorkspace(slug);
        await addMember(cw.id, cappedOwner, "owner");
      }
      await addMember(ws.id, cappedOwner, "member");
      const r = await api(admin2, portal, "POST", `${listPath}/${ws.id}/transfer`, { userId: cappedOwner.id });
      const o = await owners(ws.id);
      const rows = await audit("workspace.owner_transfer");
      return r.status === 200 && o.length === 1 && o[0].userId === cappedOwner.id && (await roleOf(ws.id, iaOwner.id)) === "admin" &&
        rows.some((l) => l.workspaceId === null && JSON.parse(l.metadata ?? "{}").byInstanceAdmin === true);
    });

    await tryCheck("admin (not superadmin) DELETE is 403 and the workspace stays", async () =>
      (await api(admin, portal, "DELETE", `${listPath}/${ws.id}`, { confirmSlug: "adm-inst" })).status === 403 &&
      (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id))).length === 1);
    await tryCheck("superadmin DELETE with a wrong slug is 400, on the default workspace 409", async () =>
      (await api(superA, portal, "DELETE", `${listPath}/${ws.id}`, { confirmSlug: "nope" })).status === 400 &&
      (await api(superA, portal, "DELETE", `${listPath}/default`, { confirmSlug: "default" })).status === 409);
    await tryCheck("superadmin DELETE with the right slug is 200, cascade done, instance-level audit row kept", async () => {
      const r = await api(superA, portal, "DELETE", `${listPath}/${ws.id}`, { confirmSlug: "adm-inst" });
      const rows = await audit("workspace.delete");
      return r.status === 200 &&
        (await db.select().from(schema.organization).where(eq(schema.organization.id, ws.id))).length === 0 &&
        (await db.select().from(schema.calendars).where(eq(schema.calendars.workspaceId, ws.id))).length === 0 &&
        (await db.select().from(schema.member).where(eq(schema.member.organizationId, ws.id))).length === 0 &&
        rows.some((l) => l.workspaceId === null && JSON.parse(l.metadata ?? "{}").slug === "adm-inst" && JSON.parse(l.metadata ?? "{}").byInstanceAdmin === true);
    });
  }

  async function checkAdminGuard() {
    console.log("\nStage 5h: scope-aware admin guard in the proxy");
    const portal = h.portalHost;
    const ws = await newWorkspace("adm-proxy");
    const wsHost = `adm-proxy.${h.baseDomain}`;
    const owner = await h.seedUser("adm-x-owner@tenancy.test");
    const wsAdmin = await h.seedUser("adm-x-admin@tenancy.test");
    const member = await h.seedUser("adm-x-member@tenancy.test");
    const plain = await h.seedUser("adm-x-plain@tenancy.test");
    const instAdmin = await h.seedUser("adm-x-inst@tenancy.test", "admin");
    const instMember = await h.seedUser("adm-x-instmember@tenancy.test", "admin");
    await addMember(ws.id, owner, "owner");
    await addMember(ws.id, wsAdmin, "admin");
    await addMember(ws.id, member, "member");
    await addMember(ws.id, instMember, "member");

    const get = async (as: SeedUser | null, host: string, path: string) => {
      const headers: Record<string, string> = { host };
      if (as) headers.cookie = await h.signIn(as.email, as.password, host);
      return h.httpRequest(path, "GET", headers);
    };
    const redirectsTo = (r: { status: number; headers: Record<string, unknown> }, pathname: string, error?: string) => {
      const loc = r.headers.location;
      if (![302, 307].includes(r.status) || typeof loc !== "string") return false;
      const url = new URL(loc, "http://x");
      return url.pathname === pathname && (error === undefined || url.searchParams.get("error") === error);
    };
    // The proxy's own 404 has an empty body; a Next.js 404 page does not.
    const hidden = (r: { status: number; text: string }) => r.status === 404 && r.text === "";
    const denied = async (userId: string) => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return db.select().from(schema.auditLogs)
        .where(and(eq(schema.auditLogs.action, "admin_access_denied"), eq(schema.auditLogs.userId, userId)));
    };

    await tryCheck("portal /admin without a cookie redirects to /login", async () =>
      redirectsTo(await get(null, portal, "/admin"), "/login"));
    await tryCheck("portal /admin as a plain user redirects with admin_access_required", async () =>
      redirectsTo(await get(plain, portal, "/admin"), "/", "admin_access_required"));
    await tryCheck("portal /admin, /admin/users, /admin/workspaces, /admin/settings, /admin/telemetry are 200 for an instance admin", async () => {
      for (const p of ["/admin", "/admin/users", "/admin/workspaces", "/admin/settings", "/admin/telemetry"]) {
        if ((await get(instAdmin, portal, p)).status !== 200) return false;
      }
      return true;
    });
    await tryCheck("portal /admin/members is 404 (workspace-only section)", async () =>
      hidden(await get(instAdmin, portal, "/admin/members")));
    await tryCheck("portal /api/admin/stats as instance admin is 200", async () =>
      (await get(instAdmin, portal, "/api/admin/stats")).status === 200);

    await tryCheck("workspace host /admin and /admin/members: owner 200, workspace admin 200", async () =>
      (await get(owner, wsHost, "/admin")).status === 200 && (await get(wsAdmin, wsHost, "/admin")).status === 200 &&
      (await get(owner, wsHost, "/admin/members")).status === 200 && (await get(wsAdmin, wsHost, "/admin/members")).status === 200);
    await tryCheck("workspace host /admin: plain member redirects with admin_access_required", async () =>
      redirectsTo(await get(member, wsHost, "/admin"), "/", "admin_access_required"));
    await tryCheck("workspace host /admin: instance admin who is not a member gets no bypass", async () =>
      redirectsTo(await get(instAdmin, wsHost, "/admin"), "/", "admin_access_required"));
    await tryCheck("workspace host /admin: instance admin who is a plain member is redirected", async () =>
      redirectsTo(await get(instMember, wsHost, "/admin"), "/", "admin_access_required"));
    await tryCheck("workspace host hides instance-only sections from the owner", async () => {
      for (const p of ["/admin/users", "/admin/workspaces", "/admin/calendars", "/admin/logs"]) {
        if (!hidden(await get(owner, wsHost, p))) return false;
      }
      return true;
    });
    await tryCheck("workspace host /admin/settings is 404 for a workspace admin, served for the owner", async () =>
      hidden(await get(wsAdmin, wsHost, "/admin/settings")) && (await get(owner, wsHost, "/admin/settings")).status === 200);
    await tryCheck("workspace host hides /admin/telemetry from the owner", async () =>
      hidden(await get(owner, wsHost, "/admin/telemetry")));
    await tryCheck("percent-encoded /%61dmin never reaches the admin shell for non-admins or across scopes", async () => {
      const notServed = (r: { status: number; text: string }) => r.status !== 200;
      return notServed(await get(member, wsHost, "/%61dmin")) &&
        notServed(await get(plain, wsHost, "/%61dmin")) &&
        notServed(await get(instAdmin, wsHost, "/%61dmin/users")) &&
        notServed(await get(owner, wsHost, "/%61dmin/users")) &&
        notServed(await get(plain, portal, "/%61dmin")) &&
        notServed(await get(instAdmin, wsHost, "/%61pi/admin/stats"));
    });
    await tryCheck("workspace host /api/admin/stats is 404 for owner and instance admin", async () =>
      hidden(await get(owner, wsHost, "/api/admin/stats")) && hidden(await get(instAdmin, wsHost, "/api/admin/stats")));
    await tryCheck("denied attempts write admin_access_denied audit rows with scope", async () => {
      const rows = [...(await denied(member.id)), ...(await denied(instAdmin.id))];
      const scopes = rows.map((r) => JSON.parse(r.metadata ?? "{}").scope);
      return (await denied(plain.id)).length > 0 && scopes.includes("workspace") && (await denied(instAdmin.id)).length > 0;
    });
  }
}
