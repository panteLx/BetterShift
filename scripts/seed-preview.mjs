#!/usr/bin/env node
/**
 * Fills a fresh preview instance with demo data over its public HTTP API.
 *
 * Runs on the CI runner, never inside the image: going through the real routes
 * means no duplicate of better-auth's password hashing, and no seed code in the
 * production image.
 */

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing configuration: ${name}`);
    process.exit(1);
  }
  return value;
}

const BASE = requireEnv("PREVIEW_URL").replace(/\/$/, "");
const ADMIN_EMAIL = requireEnv("PREVIEW_ADMIN_EMAIL");
const ADMIN_PASSWORD = requireEnv("PREVIEW_ADMIN_PASSWORD");
const MEMBER_EMAIL = process.env.PREVIEW_MEMBER_EMAIL || "mitarbeiter@preview.local";
const BASIC_USER = process.env.PREVIEW_BASIC_AUTH_USER || "preview";
const BASIC_PASSWORD = process.env.PREVIEW_BASIC_AUTH_PASSWORD || "";

// Empty password means no basic auth in front of the instance (local runs).
const BASIC_HEADER = BASIC_PASSWORD
  ? { authorization: "Basic " + Buffer.from(`${BASIC_USER}:${BASIC_PASSWORD}`).toString("base64") }
  : {};

let cookie = "";

async function api(path, { method = "GET", body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...BASIC_HEADER,
      "content-type": "application/json",
      // Node's fetch sends `sec-fetch-mode: cors` (unlike a browser it never adds
      // Origin itself), which trips better-auth's CSRF check unless we set it.
      origin: BASE,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const setCookies = res.headers.getSetCookie();
  if (setCookies.length > 0) {
    cookie = setCookies.map((entry) => entry.split(";")[0]).join("; ");
  }

  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`${method} ${path} -> ${res.status}: ${text}`);
    error.status = res.status;
    error.bodyText = text;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}

const pad = (n) => String(n).padStart(2, "0");
/** Local YYYY-MM-DD, never via UTC — same rule as lib/date-utils.ts. */
const iso = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

function daysOfMonth(monthOffset) {
  const today = new Date();
  const first = new Date(today.getFullYear(), today.getMonth() + monthOffset, 1);
  const days = [];
  for (let day = new Date(first); day.getMonth() === first.getMonth(); day.setDate(day.getDate() + 1)) {
    days.push(new Date(day));
  }
  return days;
}

async function signUp({ email, password, name }) {
  return api("/api/auth/sign-up/email", { method: "POST", body: { email, password, name } });
}

async function signIn({ email, password }) {
  cookie = "";
  return api("/api/auth/sign-in/email", { method: "POST", body: { email, password } });
}

async function main() {
  try {
    await signUp({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: "Preview Admin" });
  } catch (error) {
    // Narrow on purpose: better-auth's actual duplicate-user answer only, not any
    // error whose body happens to contain "exist" (e.g. a misrouted 404 page).
    let code;
    try {
      code = JSON.parse(error.bodyText || "").code;
    } catch {
      // not JSON — falls through, code stays undefined, error propagates below
    }
    if (error.status === 422 && code === "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL") {
      console.log("Instance is already seeded — nothing to do.");
      return;
    }
    throw error;
  }
  console.log(`Admin created: ${ADMIN_EMAIL}`);

  await signUp({ email: MEMBER_EMAIL, password: ADMIN_PASSWORD, name: "Max Mitarbeiter" });
  await signIn({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

  const team = await api("/api/calendars", {
    method: "POST",
    body: { name: "Dienstplan Team A", color: "#3b82f6" },
  });
  await api("/api/calendars", {
    method: "POST",
    body: { name: "Urlaubsplanung", color: "#f59e0b" },
  });
  console.log("Two calendars created.");

  const bundles = await api(`/api/calendars/${team.id}/bundles`);
  const contribute = bundles.find((bundle) => bundle.name === "Contribute") || bundles[0];
  const found = await api(`/api/users/search?calendarId=${team.id}&q=Max`);
  const member = (Array.isArray(found) ? found : found.users || []).find(
    (candidate) => candidate.email === MEMBER_EMAIL
  );
  if (member) {
    await api(`/api/calendars/${team.id}/shares`, {
      method: "POST",
      body: { userId: member.id, bundleId: contribute.id },
    });
    console.log(`Calendar shared with ${MEMBER_EMAIL} (bundle ${contribute.name}).`);
  } else {
    console.warn(
      `No user ${MEMBER_EMAIL} found — skipping the share and the shift signups.`
    );
  }

  await api(`/api/calendars/${team.id}/custom-fields`, {
    method: "POST",
    body: {
      key: "dienstort",
      label: "Dienstort",
      type: "select",
      options: [
        { id: "zentrale", label: "Zentrale" },
        { id: "aussenstelle", label: "Außenstelle" },
      ],
      required: false,
      showInCalendar: true,
    },
  });

  const presetDefinitions = [
    { title: "Frühdienst", startTime: "06:00", endTime: "14:00", color: "#22c55e" },
    { title: "Spätdienst", startTime: "14:00", endTime: "22:00", color: "#3b82f6" },
    { title: "Nachtdienst", startTime: "22:00", endTime: "06:00", color: "#6366f1" },
    { title: "Urlaub", isAllDay: true, color: "#f97316" },
  ];
  const presets = [];
  for (const definition of presetDefinitions) {
    presets.push(await api("/api/presets", { method: "POST", body: { calendarId: team.id, ...definition } }));
  }
  console.log(`${presets.length} presets created.`);

  const rotation = presets.slice(0, 3);
  let shiftCount = 0;
  for (const monthOffset of [0, 1]) {
    for (const day of daysOfMonth(monthOffset)) {
      if (day.getDay() === 0) continue; // Sundays stay empty so the plan does not look uniformly filled
      const preset = rotation[shiftCount % rotation.length];
      await api("/api/shifts", {
        method: "POST",
        body: {
          calendarId: team.id,
          date: iso(day),
          title: preset.title,
          startTime: preset.startTime,
          endTime: preset.endTime,
          color: preset.color,
          presetId: preset.id,
          customFields: { dienstort: shiftCount % 2 === 0 ? "zentrale" : "aussenstelle" },
          ...(shiftCount % 5 === 0 && member
            ? { signupCapacity: 2, signupUserIds: [member.id] }
            : {}),
        },
      });
      shiftCount += 1;
    }
  }
  console.log(`${shiftCount} shifts created.`);

  const [firstDay] = daysOfMonth(0);
  const notes = [
    { offset: 4, note: "Teambesprechung 10:00", type: "event", color: "#ef4444" },
    { offset: 11, note: "Dienstplan für den Folgemonat abstimmen", type: "note", color: "#3b82f6" },
    { offset: 19, note: "Betriebsausflug", type: "event", color: "#22c55e" },
  ];
  for (const entry of notes) {
    const date = new Date(firstDay);
    date.setDate(date.getDate() + entry.offset);
    await api("/api/notes", {
      method: "POST",
      body: { calendarId: team.id, date: iso(date), note: entry.note, type: entry.type, color: entry.color },
    });
  }
  console.log(`${notes.length} notes created.`);
  console.log("Seed complete.");
}

try {
  await main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
