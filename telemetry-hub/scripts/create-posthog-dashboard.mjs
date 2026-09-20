#!/usr/bin/env node
// Creates the "BetterShift Instanzen" dashboards in PostHog from the instance_ping events.
//
//   npm run dashboard [-- --dry-run]
//
// Settings come from telemetry-hub/.env (copy .env.example) or the environment; the environment wins.
// Only POSTHOG_PERSONAL_API_KEY is required, everything else has a default:
//   POSTHOG_PERSONAL_API_KEY  personal key (phx_..., not the phc_ project key) with the
//                             dashboard:write and insight:write scopes, plus project:read for
//                             finding the project id
//   POSTHOG_PROJECT_ID        only needed if the key can see more than one project
//   POSTHOG_HOST              app host, default https://eu.posthog.com (not the eu.i. ingest host)
//   DASHBOARD_NAME            default "BetterShift Instanzen"
//   DASHBOARD_VARIANTS        all,no-dev,dev-only,no-ids (default: all four)
//   EXCLUDE_INSTANCE_IDS      id1,id2 for the no-ids dashboard
//
// One run builds up to four dashboards with the same insights and a different filter each:
//   all       "<name>"                     no filter
//   no-dev    "<name> · ohne Dev-Builds"   instances running a dev build left out
//   dev-only  "<name> · nur Dev-Builds"    only instances running a dev build
//   no-ids    "<name> · ohne Test-Instanzen"  EXCLUDE_INSTANCE_IDS left out
// A dashboard that already exists (matched by name) is updated in place, insight by insight,
// so new instance ids can be added later by running the script again.

import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

// loadEnvFile never overrides variables that are already set.
const envFile = fileURLToPath(new URL("../.env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");

const HOST = (process.env.POSTHOG_HOST || "https://eu.posthog.com").replace(/\/$/, "");
const KEY = process.env.POSTHOG_PERSONAL_API_KEY;
let PROJECT = process.env.POSTHOG_PROJECT_ID;
const DASHBOARD_NAME = process.env.DASHBOARD_NAME || "BetterShift Instanzen";
const EVENT = "instance_ping";
const TAG = "bettershift-telemetry";

function fail(message) {
  console.error(`Fehler: ${message}`);
  process.exit(1);
}

const excluded = (process.env.EXCLUDE_INSTANCE_IDS || "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);
// The ids end up inside SQL, so only the characters of a UUID are accepted.
for (const id of excluded) {
  if (!/^[A-Za-z0-9-]+$/.test(id)) fail(`Ungültige Instanz-ID in EXCLUDE_INSTANCE_IDS: ${id}`);
}

// Dev builds send like any other; app_is_dev only exists to tell them apart here.
const IS_DEV = `toString(coalesce(properties.app_is_dev, 'false')) IN ('true', '1')`;
const VARIANTS = {
  all: { suffix: "", condition: "" },
  "no-dev": { suffix: " · ohne Dev-Builds", condition: `NOT (${IS_DEV})` },
  "dev-only": { suffix: " · nur Dev-Builds", condition: IS_DEV },
  "no-ids": {
    suffix: " · ohne Test-Instanzen",
    condition: excluded.length ? `distinct_id NOT IN (${excluded.map((id) => `'${id}'`).join(", ")})` : "",
  },
};

const requested = (process.env.DASHBOARD_VARIANTS || "").split(",").map((v) => v.trim()).filter(Boolean);
for (const key of requested) {
  if (!VARIANTS[key]) fail(`Unbekannte Variante in DASHBOARD_VARIANTS: ${key} (erlaubt: ${Object.keys(VARIANTS).join(", ")})`);
}
if (requested.includes("no-ids") && !excluded.length) fail("Variante no-ids braucht EXCLUDE_INSTANCE_IDS.");
const variantKeys = (requested.length ? requested : Object.keys(VARIANTS)).filter(
  (key) => key !== "no-ids" || excluded.length
);
if (!requested.length && !excluded.length) console.log("Ohne EXCLUDE_INSTANCE_IDS entfällt das Dashboard \"ohne Test-Instanzen\".");


/** All insights of one dashboard; `condition` is the HogQL filter of its variant (may be empty). */
function buildInsights(condition) {
  const andNotExcluded = condition ? ` AND ${condition}` : "";
  const trendProperties = condition ? [{ type: "hogql", key: condition }] : [];

  // ---------------------------------------------------------------------------
  // Query builders
  // ---------------------------------------------------------------------------

  /** Trends over unique instances (distinct_id), never over raw pings. */
  function trends({ display, interval = "week", from = "-30d", math = "dau", mathProperty, breakdown }) {
    return {
      kind: "InsightVizNode",
      source: {
        kind: "TrendsQuery",
        series: [
          {
            kind: "EventsNode",
            event: EVENT,
            name: EVENT,
            math,
            ...(mathProperty && { math_property: mathProperty, math_property_type: "event_properties" }),
          },
        ],
        interval,
        dateRange: { date_from: from },
        properties: trendProperties,
        filterTestAccounts: false,
        ...(breakdown && { breakdownFilter: { breakdowns: [{ property: breakdown, type: "event" }] } }),
        trendsFilter: { display },
        version: 2,
      },
    };
  }

  function sql(query) {
    return { kind: "DataVisualizationNode", source: { kind: "HogQLQuery", query: query.trim() } };
  }

  /** Latest ping per instance in the last 30 days, so every instance counts once. */
  function latestPerInstance(columns) {
    return `
  SELECT distinct_id, ${columns}
  FROM events
  WHERE event = '${EVENT}' AND timestamp > now() - INTERVAL 30 DAY${andNotExcluded}
  GROUP BY distinct_id`;
  }

  const bars = (name, description, breakdown) => ({
    name,
    description,
    query: trends({ display: "ActionsBarValue", breakdown }),
  });
  const pie = (name, description, breakdown) => ({
    name,
    description,
    query: trends({ display: "ActionsPie", breakdown }),
  });

  // A boolean breakdown would only show a bare instance count, so yes/no flags get an explicit table.
  const yesNo = (name, property) => ({
    name,
    description: "Jede Instanz zählt einmal, mit dem Wert ihres letzten Pings (letzte 30 Tage).",
    query: sql(`
  SELECT multiIf(flag IN ('true', '1'), 'Ja', flag IN ('false', '0'), 'Nein', 'Unbekannt') AS Wert, count() AS Instanzen
  FROM (${latestPerInstance(`toString(argMax(properties.${property}, timestamp)) AS flag`)})
  GROUP BY Wert
  ORDER BY Instanzen DESC`),
  });

  const BY_INSTANCE = "Aktive Instanzen der letzten 30 Tage, aufgeteilt nach dem gemeldeten Wert.";

  // ---------------------------------------------------------------------------
  // Insights, in dashboard order
  // ---------------------------------------------------------------------------

  const insights = [
    // Growth
    {
      name: "Wachstum · Aktive Instanzen (7 Tage)",
      description: "Instanzen, die in den letzten 7 Tagen mindestens einmal gemeldet haben.",
      query: trends({ display: "BoldNumber", from: "-7d", interval: "day" }),
    },
    {
      name: "Wachstum · Bekannte Instanzen (gesamt)",
      description: "Alle Instanzen, die je einen Ping gesendet haben.",
      query: sql(`
  SELECT count(DISTINCT distinct_id) AS instances
  FROM events
  WHERE event = '${EVENT}'${andNotExcluded}`),
    },
    {
      name: "Wachstum · Neue Instanzen (30 Tage)",
      description: "Instanzen, deren erster Ping in den letzten 30 Tagen liegt.",
      query: sql(`
  SELECT count() AS new_instances
  FROM (
    SELECT distinct_id, min(timestamp) AS first_seen
    FROM events
    WHERE event = '${EVENT}'${andNotExcluded}
    GROUP BY distinct_id
    HAVING first_seen > now() - INTERVAL 30 DAY
  )`),
    },
    {
      name: "Wachstum · Aktive Instanzen pro Woche",
      description: "Eindeutige Instanzen je Woche, unabhängig von der Zahl der Pings.",
      query: trends({ display: "ActionsLineGraph", from: "-180d" }),
    },
    {
      name: "Wachstum · Neu, wiederkehrend, inaktiv",
      description: "Lebenszyklus der Instanzen je Woche.",
      query: {
        kind: "InsightVizNode",
        source: {
          kind: "LifecycleQuery",
          series: [{ kind: "EventsNode", event: EVENT, name: EVENT, math: "total" }],
          interval: "week",
          dateRange: { date_from: "-90d" },
          properties: trendProperties,
          filterTestAccounts: false,
          lifecycleFilter: { showLegend: true },
        },
      },
    },
    {
      name: "Wachstum · Verbleib (Retention)",
      description: "Wie viele Instanzen nach ihrem ersten Ping in den Folgewochen weiter melden.",
      query: {
        kind: "InsightVizNode",
        source: {
          kind: "RetentionQuery",
          dateRange: { date_from: "-12w" },
          properties: trendProperties,
          filterTestAccounts: false,
          retentionFilter: {
            period: "Week",
            totalIntervals: 12,
            retentionType: "retention_first_time",
            targetEntity: { id: EVENT, name: EVENT, type: "events" },
            returningEntity: { id: EVENT, name: EVENT, type: "events" },
          },
        },
      },
    },

    // Versions
    bars("Version · Aktive Instanzen je Version", BY_INSTANCE, "app_version"),
    {
      name: "Version · Aktuelle Version je Instanz",
      description: "Jede Instanz zählt einmal, mit ihrer zuletzt gemeldeten Version.",
      query: sql(`
  SELECT version, count() AS instances
  FROM (${latestPerInstance("argMax(properties.app_version, timestamp) AS version")})
  GROUP BY version
  ORDER BY instances DESC`),
    },
    yesNo("Version · Dev-Builds", "app_is_dev"),
    bars("Version · Datenbank-Migrationen", `${BY_INSTANCE} Zeigt, wie aktuell das Schema ist.`, "app_migrations"),

    // Environment
    bars("Umgebung · Node.js", BY_INSTANCE, "runtime_node"),
    pie("Umgebung · Plattform", BY_INSTANCE, "runtime_platform"),
    pie("Umgebung · Architektur", BY_INSTANCE, "runtime_arch"),
    bars("Umgebung · SQLite", BY_INSTANCE, "runtime_sqlite"),
    bars("Umgebung · Zeitzone", BY_INSTANCE, "runtime_timezone"),
    pie("Umgebung · Standardsprache", BY_INSTANCE, "config_default_locale"),

    // Scale (buckets)
    bars("Größe · Nutzer", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_users"),
    bars("Größe · Kalender", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_calendars"),
    bars("Größe · Schichten", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_shifts"),
    bars("Größe · Schichtvorlagen", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_presets"),
    bars("Größe · Notizen", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_notes"),
    bars("Größe · Berechtigungs-Bundles", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_bundles"),
    bars("Größe · Freigaben", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_shares"),
    bars("Größe · Freigabe-Links", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_access_tokens"),
    bars("Größe · Schicht-Anmeldungen", `${BY_INSTANCE} Größenklassen, keine genauen Zahlen.`, "scale_signups"),

    // Configuration
    yesNo("Konfiguration · Authentifizierung aktiv", "config_auth_enabled"),
    yesNo("Konfiguration · Gastzugang erlaubt", "config_guest_access"),
    yesNo("Konfiguration · Registrierung offen", "config_registration_open"),
    yesNo("Konfiguration · Update-Prüfung aktiv", "config_update_check_enabled"),
    bars("Konfiguration · Rate-Limit-Überschreibungen", `${BY_INSTANCE} Anzahl gesetzter RATE_LIMIT_*-Variablen.`, "config_rate_limit_overrides"),

    // Features
    bars("Funktionen · Externe Synchronisierungen", `${BY_INSTANCE} Größenklassen.`, "features_external_syncs"),
    bars("Funktionen · Kalender mit eigener Ansicht", `${BY_INSTANCE} Größenklassen.`, "features_calendar_view_overrides"),
    bars("Funktionen · Eigene Felder (Anzahl)", `${BY_INSTANCE} Größenklassen.`, "features_custom_fields_count"),
    {
      name: "Funktionen · Typen eigener Felder",
      description: "Wie viele Instanzen welchen Feldtyp nutzen (letzte 30 Tage).",
      query: sql(`
  SELECT field_type, count(DISTINCT distinct_id) AS instances
  FROM (
    SELECT
      distinct_id,
      arrayJoin(JSONExtractArrayRaw(coalesce(properties.features_custom_field_types, '[]'))) AS raw_type,
      trim(BOTH '"' FROM raw_type) AS field_type
    FROM events
    WHERE event = '${EVENT}' AND timestamp > now() - INTERVAL 30 DAY${andNotExcluded}
  )
  GROUP BY field_type
  ORDER BY instances DESC`),
    },
    yesNo("Funktionen · Archivierte Vorlagen", "features_archived_presets"),
    yesNo("Funktionen · Geteilte Schichten", "features_split_shifts"),

    // Operations
    {
      name: "Betrieb · Ø Laufzeit (Stunden)",
      description: "Durchschnittliche Zeit seit dem letzten Neustart, je Woche.",
      query: trends({ display: "ActionsLineGraph", math: "avg", mathProperty: "health_uptime_hours", from: "-90d" }),
    },
    {
      name: "Betrieb · Ø Sync-Läufe je Instanz (24 h)",
      description: "Durchschnitt der gemeldeten Sync-Läufe der letzten 24 Stunden, je Woche.",
      query: trends({ display: "ActionsLineGraph", math: "avg", mathProperty: "health_sync_runs_24h", from: "-90d" }),
    },
    {
      name: "Betrieb · Ø Sync-Fehler je Instanz (24 h)",
      description: "Durchschnitt der gemeldeten Sync-Fehler der letzten 24 Stunden, je Woche.",
      query: trends({ display: "ActionsLineGraph", math: "avg", mathProperty: "health_sync_failures_24h", from: "-90d" }),
    },
    {
      name: "Betrieb · Instanzen mit Sync-Fehlern",
      description: "Instanzen, deren letzter Ping Sync-Fehler in den letzten 24 Stunden meldet.",
      query: sql(`
  SELECT distinct_id, version, sync_runs, sync_failures, last_seen
  FROM (${latestPerInstance(`
    argMax(properties.app_version, timestamp) AS version,
    argMax(properties.health_sync_runs_24h, timestamp) AS sync_runs,
    argMax(properties.health_sync_failures_24h, timestamp) AS sync_failures,
    max(timestamp) AS last_seen`)})
  WHERE sync_failures > 0
  ORDER BY sync_failures DESC`),
    },

    // Overview table
    {
      name: "Instanzen · Letzter Stand je Instanz",
      description: "Eine Zeile je Instanz mit den Werten ihres letzten Pings.",
      query: sql(`
  SELECT
    distinct_id,
    max(timestamp) AS last_seen,
    argMax(properties.app_version, timestamp) AS version,
    argMax(properties.runtime_platform, timestamp) AS platform,
    argMax(properties.runtime_arch, timestamp) AS arch,
    argMax(properties.runtime_node, timestamp) AS node,
    argMax(properties.scale_users, timestamp) AS users,
    argMax(properties.scale_calendars, timestamp) AS calendars,
    argMax(properties.scale_shifts, timestamp) AS shifts,
    argMax(properties.health_uptime_hours, timestamp) AS uptime_hours
  FROM events
  WHERE event = '${EVENT}' AND timestamp > now() - INTERVAL 30 DAY${andNotExcluded}
  GROUP BY distinct_id
  ORDER BY last_seen DESC`),
    },
  ];

  return insights;
}

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

async function api(method, path, body) {
  return request(method, `/api/projects/${PROJECT}${path}`, body);
}

async function request(method, path, body) {
  const response = await fetch(`${HOST}${path}`, {
    method,
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

/** Uses the only project the key can see; with several (or no project:read scope) the id must be set. */
async function findProject() {
  let projects;
  try {
    projects = (await request("GET", "/api/projects/")).results ?? [];
  } catch (error) {
    fail(`POSTHOG_PROJECT_ID fehlt und die Projektliste ließ sich nicht laden (${error.message}).`);
  }
  if (projects.length !== 1) {
    const list = projects.map((p) => `  ${p.id}  ${p.name}`).join("\n");
    fail(`POSTHOG_PROJECT_ID fehlt und der Key sieht ${projects.length} Projekte:\n${list}`);
  }
  console.log(`Projekt "${projects[0].name}" (ID ${projects[0].id}) automatisch gewählt.`);
  return projects[0].id;
}

/** Creates or updates the insights of one dashboard; returns the names that failed. */
async function syncInsights(dashboardId, existingTiles, insights) {
  const byName = new Map(existingTiles.filter((t) => t.insight).map((t) => [t.insight.name, t.insight.id]));
  const failures = [];
  for (const insight of insights) {
    const id = byName.get(insight.name);
    try {
      if (id) {
        await api("PATCH", `/insights/${id}/`, { description: insight.description, query: insight.query });
      } else {
        await api("POST", "/insights/", {
          name: insight.name,
          description: insight.description,
          query: insight.query,
          dashboards: [dashboardId],
          tags: [TAG],
        });
      }
      console.log(`  ${id ? "aktual." : "neu    "} ${insight.name}`);
    } catch (error) {
      failures.push(insight.name);
      console.error(`  FEHLER  ${insight.name}\n          ${error.message}`);
    }
  }
  return failures;
}

async function main() {
  const plan = variantKeys.map((key) => ({
    key,
    name: DASHBOARD_NAME + VARIANTS[key].suffix,
    insights: buildInsights(VARIANTS[key].condition),
  }));

  if (dryRun) {
    for (const { key, name, insights } of plan) {
      console.log(`Trockenlauf: ${insights.length} Insights für "${name}" (${key})`);
    }
    for (const insight of plan[0].insights) console.log(`  - ${insight.name}`);
    if (excluded.length) console.log(`Ausgeschlossene Instanzen: ${excluded.length}`);
    return;
  }

  if (!KEY) {
    fail("POSTHOG_PERSONAL_API_KEY fehlt. In telemetry-hub/.env eintragen (Vorlage: .env.example) oder als Variable setzen.");
  }
  if (!PROJECT) PROJECT = await findProject();

  const existing = (await api("GET", "/dashboards/?limit=200")).results ?? [];
  let failed = 0;

  for (const { name, insights } of plan) {
    const found = existing.find((d) => d.name === name && !d.deleted);
    let dashboard = found;
    let tiles = [];
    if (found) {
      // The list endpoint carries no tiles, so fetch the dashboard itself.
      tiles = (await api("GET", `/dashboards/${found.id}/`)).tiles ?? [];
      console.log(`\nDashboard "${name}" existiert (ID ${found.id}), wird aktualisiert.`);
    } else {
      dashboard = await api("POST", "/dashboards/", {
        name,
        description: "Anonyme Instanz-Pings von BetterShift. Gezählt werden eindeutige Instanzen, nicht Pings.",
        tags: [TAG],
      });
      console.log(`\nDashboard "${name}" angelegt (ID ${dashboard.id}).`);
    }

    const failures = await syncInsights(dashboard.id, tiles, insights);
    failed += failures.length;
    console.log(`${insights.length - failures.length} von ${insights.length} Insights synchronisiert.`);
    console.log(`${HOST}/project/${PROJECT}/dashboard/${dashboard.id}`);
  }

  if (failed) process.exit(1);
}

main().catch((error) => fail(error.message));
