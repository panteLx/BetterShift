import type { DistributionEntry, HistoryPoint, PublicAggregate, VersionEntry } from "./aggregate";

const HISTORY_DAYS = 90;
// Mirrors MAX_DISTRIBUTION_ENTRIES in aggregate.ts, for the footer wording only.
const MAX_DISTRIBUTION_ENTRIES = 25;
const REPO = "https://github.com/panteLx/bettershift";
const DOCS_URL = `${REPO}/blob/main/docs/TELEMETRY.md`;

const ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);
}

const esc = escapeHtml;

function count(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toLocaleString("en-US") : "0";
}

/** Keeps the one decimal aggregate.ts computes for avgUptimeHours. */
function decimal(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return (Math.round(n * 10) / 10).toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function percent(share: number): string {
  if (!Number.isFinite(share)) return "0%";
  const pct = share * 100;
  if (pct > 0 && pct < 1) return "<1%";
  return `${pct >= 10 || Number.isInteger(pct) ? Math.round(pct) : Math.round(pct * 10) / 10}%`;
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Renders the ISO timestamp as a stable UTC string; a bad value is passed through. */
function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`
  );
}

const DIMENSION_LABELS: Record<string, string> = {
  versions: "Release",
  types: "Type in use",
  node: "Node.js version",
  platform: "Operating system",
  arch: "CPU architecture",
  sqlite: "SQLite version",
  timezone: "Time zone",
  auth_enabled: "Authentication enabled",
  guest_access: "Guest access allowed",
  registration_open: "Open registration",
  update_check_enabled: "Update check enabled",
  default_locale: "Default language",
  rate_limit_overrides: "Rate-limit overrides set",
  users: "User accounts",
  calendars: "Calendars",
  shifts: "Shifts",
  presets: "Shift presets",
  notes: "Notes",
  bundles: "Permission bundles",
  shares: "Calendar shares",
  access_tokens: "Share links",
  signups: "Shift signups",
  external_syncs: "External calendar syncs",
  calendar_view_overrides: "Calendars with a pinned view",
  custom_fields_count: "Custom field definitions",
  archived_presets: "Has archived presets",
  split_shifts: "Split shifts enabled",
};

const BOOLEAN_DIMENSIONS = new Set([
  "auth_enabled",
  "guest_access",
  "registration_open",
  "update_check_enabled",
  "archived_presets",
  "split_shifts",
]);

const ORDER: Record<string, string[]> = {
  environment: ["node", "platform", "arch", "sqlite", "timezone"],
  configuration: [
    "auth_enabled",
    "guest_access",
    "registration_open",
    "update_check_enabled",
    "default_locale",
    "rate_limit_overrides",
  ],
  sizes: [
    "users",
    "calendars",
    "shifts",
    "presets",
    "notes",
    "bundles",
    "shares",
    "access_tokens",
    "signups",
  ],
  features: [
    "external_syncs",
    "calendar_view_overrides",
    "custom_fields_count",
    "archived_presets",
    "split_shifts",
  ],
};

function dimensionLabel(key: string): string {
  return DIMENSION_LABELS[key] ?? key.replace(/_/g, " ");
}

function valueLabel(dimension: string, value: string): string {
  if (BOOLEAN_DIMENSIONS.has(dimension)) {
    if (value === "1" || value === "true") return "Yes";
    if (value === "0" || value === "false") return "No";
  }
  if (value === "unknown") return "not set";
  return value;
}

/** Orders known dimensions first, then anything the aggregate added later. */
function orderedKeys(group: Record<string, DistributionEntry[]>, section: string): string[] {
  const preferred = ORDER[section] ?? [];
  const present = Object.keys(group).filter((key) => group[key] && group[key].length > 0);
  const known = preferred.filter((key) => present.includes(key));
  const rest = present.filter((key) => !preferred.includes(key)).sort();
  return [...known, ...rest];
}

interface BarOptions {
  dimension: string;
  note?: (entry: DistributionEntry, index: number) => string | null;
}

// Structural, not by label: reported values are attacker-supplied and could
// otherwise impersonate the remainder entry's styling.
const isRemainder = (entry: DistributionEntry): boolean => entry.remainder === true;

/**
 * Entries are indexed by position, never by `value`: values are truncated to 64
 * characters, so two entries can legitimately carry the same label.
 */
function renderBars(entries: DistributionEntry[], options: BarOptions): string {
  const rows = entries
    .map((entry, index) => {
      const label = valueLabel(options.dimension, entry.value);
      const remainder = isRemainder(entry);
      // A multi-select dimension counts an instance once per value it holds, so a
      // summed remainder can exceed the population. A share above 1 is not a share
      // there — while in a single-select dimension it would signal a counting bug,
      // which must stay visible, so the suppression is scoped to the remainder.
      const unshareable = remainder && (entry.share || 0) > 1;
      const width = Math.max(0.8, Math.min(100, (entry.share || 0) * 100));
      const note = options.note?.(entry, index);
      return `<li class="bar${remainder ? " bar-other" : ""}">
  <div class="bar-head">
    <span class="bar-label">${esc(label)}${remainder ? '<span class="bar-hint"> — long tail, summed to keep this page small</span>' : ""}</span>
    <span class="bar-value">${unshareable ? "" : `<b>${esc(percent(entry.share))}</b>`}<span class="bar-count">${esc(count(entry.instances))}</span></span>
  </div>
  <div class="track">${
    // No claimable share, so no fill: an empty track beats drawing the widest bar
    // on the card for a number the page just refused to print.
    unshareable ? "" : `<div class="fill" style="width:${esc(width.toFixed(1))}%"></div>`
  }</div>
  ${note ? `<p class="bar-note">${esc(note)}</p>` : ""}
</li>`;
    })
    .join("\n");

  return `<ul class="bars">\n${rows}\n</ul>`;
}

function renderGroup(key: string, entries: DistributionEntry[], note?: BarOptions["note"]): string {
  return `<div class="dim">
  <h3>${esc(dimensionLabel(key))}</h3>
  ${renderBars(entries, { dimension: key, note })}
</div>`;
}

function renderDistributionSection(
  id: string,
  title: string,
  caption: string,
  group: Record<string, DistributionEntry[]>,
): string {
  const keys = orderedKeys(group ?? {}, id);
  if (keys.length === 0) return "";
  const body = keys.map((key) => renderGroup(key, group[key])).join("\n");
  return `<section id="${esc(id)}">
  <h2>${esc(title)}</h2>
  <p class="caption">${esc(caption)}</p>
  <div class="dims">
${body}
  </div>
</section>`;
}

function renderVersions(versions: VersionEntry[]): string {
  if (versions.length === 0) return "";
  const note = (_entry: DistributionEntry, index: number) => {
    const dev = versions[index]?.devInstances ?? 0;
    return dev > 0 ? `includes ${count(dev)} development ${plural(dev, "build", "builds")}` : null;
  };
  return `<section id="versions">
  <h2>Versions in use</h2>
  <p class="caption">The release each reporting instance was running when it last checked in.</p>
  <div class="dims">
${renderGroup("versions", versions, note)}
  </div>
</section>`;
}

const DAY_MS = 86_400_000;

function dayNumber(day: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  if (!match) return null;
  const time = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(time) ? null : Math.round(time / DAY_MS);
}

function niceMax(value: number): number {
  if (value <= 5) return Math.max(1, value);
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  for (const step of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) {
    const candidate = step * magnitude;
    if (candidate >= value) return candidate;
  }
  return value;
}

interface Point {
  day: string;
  n: number;
  instances: number;
}

/**
 * A sparse series: a day on which nothing reported is absent from the data, not
 * zero. Gaps stay gaps — zero-filling would draw a dip that never happened. Only
 * runs of consecutive days are joined by a line.
 */
function renderHistory(points: HistoryPoint[]): string {
  const caption = `Distinct instances that reported on each of the last ${HISTORY_DAYS} days.`;

  const parsed: Point[] = points
    .map((point) => ({
      day: String(point.day),
      n: dayNumber(String(point.day)),
      instances: Number(point.instances),
    }))
    .filter(
      (point): point is Point => point.n !== null && Number.isFinite(point.instances) && point.instances > 0,
    )
    .sort((a, b) => a.n - b.n);

  if (parsed.length === 0) {
    return `<section id="history">
  <h2>Reports over time</h2>
  <p class="caption">${esc(caption)}</p>
  <div class="empty-chart">
    <div class="empty-baseline"></div>
    <p class="empty-title">Nothing to plot yet</p>
    <p class="empty-body">No instance has reported on any day in this window, so there is no series to draw. The chart appears with the first day that carries a report.</p>
  </div>
</section>`;
  }

  const width = 720;
  const height = 220;
  const padL = 40;
  const padR = 16;
  const padT = 28;
  const padB = 30;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const first = parsed[0];
  const last = parsed[parsed.length - 1];
  const span = Math.max(1, last.n - first.n);
  const yMax = niceMax(Math.max(...parsed.map((point) => point.instances)));

  const x = (n: number) => padL + (parsed.length === 1 ? plotW / 2 : ((n - first.n) / span) * plotW);
  const y = (v: number) => padT + plotH - (v / yMax) * plotH;

  // Split into runs of calendar-consecutive days; a break in the data breaks the line.
  const runs: Point[][] = [];
  for (const point of parsed) {
    const current = runs[runs.length - 1];
    if (current && point.n - current[current.length - 1].n === 1) current.push(point);
    else runs.push([point]);
  }

  const lines = runs
    .filter((run) => run.length > 1)
    .map(
      (run) =>
        `<polyline class="line" points="${esc(
          run.map((point) => `${x(point.n).toFixed(1)},${y(point.instances).toFixed(1)}`).join(" "),
        )}" />`,
    )
    .join("");

  // Dots stay affordable while the series is short; otherwise only isolated days
  // and the endpoint are marked, so a gap still reads as a gap.
  const dense = parsed.length > 20;
  const dots = parsed
    .filter((point, index) => {
      if (!dense) return true;
      const prev = parsed[index - 1];
      const next = parsed[index + 1];
      const isolated = (!prev || point.n - prev.n > 1) && (!next || next.n - point.n > 1);
      return isolated || point === last;
    })
    .map(
      (point) =>
        `<circle class="dot" cx="${esc(x(point.n).toFixed(1))}" cy="${esc(y(point.instances).toFixed(1))}" r="4"><title>${esc(point.day)}: ${esc(count(point.instances))} ${esc(plural(point.instances, "instance", "instances"))}</title></circle>`,
    )
    .join("");

  // Instance counts are integers: a mid tick at 2.5 labelled "3" would put a
  // 3-instance day below its own gridline, so it is only drawn when it is whole.
  const tickValues = yMax % 2 === 0 ? [0, yMax / 2, yMax] : [0, yMax];
  const ticks = tickValues.map(
    (value) =>
      `<line class="grid" x1="${esc(padL)}" x2="${esc(width - padR)}" y1="${esc(y(value).toFixed(1))}" y2="${esc(y(value).toFixed(1))}" />` +
      `<text class="tick" x="${esc(padL - 8)}" y="${esc((y(value) + 4).toFixed(1))}" text-anchor="end">${esc(count(value))}</text>`,
  );

  // padT leaves room for the end label to sit above the last point without clipping.
  const endLabel = `<text class="end-label" x="${esc((x(last.n) - 8).toFixed(1))}" y="${esc((y(last.instances) - 12).toFixed(1))}" text-anchor="end">${esc(count(last.instances))}</text>`;

  const gapNote =
    parsed.length < span + 1
      ? "Where the line breaks, no instance reported that day at all. A break is not a drop to zero."
      : "Every day in this range carries at least one report, so the line is unbroken.";

  return `<section id="history">
  <h2>Reports over time</h2>
  <p class="caption">${esc(caption)}</p>
  <div class="chart">
    <svg viewBox="0 0 ${esc(width)} ${esc(height)}" role="img" aria-label="${esc(`Instances reporting per day, ${first.day} to ${last.day}`)}" preserveAspectRatio="xMidYMid meet">
      ${ticks.join("")}
      ${lines}
      ${dots}
      ${endLabel}
      <text class="tick" x="${esc(padL)}" y="${esc(height - 8)}">${esc(first.day)}</text>
      <text class="tick" x="${esc(width - padR)}" y="${esc(height - 8)}" text-anchor="end">${esc(last.day)}</text>
    </svg>
  </div>
  <p class="note">${esc(gapNote)}</p>
</section>`;
}

function renderHealth(health: PublicAggregate["health"]): string {
  // Zero is a true and useful answer here — "no instance reported a failed sync"
  // is a statement worth publishing, so this section never disappears.
  const uptime = Number(health?.avgUptimeHours ?? 0);
  const failures = Number(health?.instancesWithSyncFailures ?? 0);
  return `<section id="health">
  <h2>Health</h2>
  <p class="caption">Two plain figures, across the instances that reported.</p>
  <div class="figures">
    <div class="figure"><span class="figure-value">${esc(decimal(uptime))} h</span><span class="figure-label">Average uptime since the last restart</span></div>
    <div class="figure"><span class="figure-value">${esc(count(failures))}</span><span class="figure-label">Instances with a failed calendar sync in the last 24 hours</span></div>
  </div>
</section>`;
}

/** Nothing is being withheld here — no instance has reported in the window. */
function renderNoReportsNotice(hasHistory: boolean): string {
  const tail = hasHistory
    ? " The chart below still reaches back 90 days, so the last reports that did come in are plotted there."
    : "";
  return `<section id="no-reports">
  <div class="notice">
    <p class="notice-title">No instance has reported in the last 30 days</p>
    <p>There is nothing to break down, because nothing has come in. That is the normal state for a freshly deployed hub, and it is also what this page shows once every instance that once reported has aged out of the 30-day window. Nothing is being withheld.${tail}</p>
  </div>
</section>`;
}

const STYLES = `
:root{color-scheme:light;--plane:#f9f9f7;--surface:#fcfcfb;--ink:#0b0b0b;--ink-2:#52514e;--muted:#898781;--grid:#e1e0d9;--border:rgba(11,11,11,.10);--series:#2a78d6;--track:#cde2fb;--accent-soft:#eef4fd}
@media (prefers-color-scheme:dark){:root{color-scheme:dark;--plane:#0d0d0d;--surface:#1a1a19;--ink:#fff;--ink-2:#c3c2b7;--muted:#898781;--grid:#2c2c2a;--border:rgba(255,255,255,.10);--series:#3987e5;--track:#0d366b;--accent-soft:#14202e}}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--plane);color:var(--ink);font:400 16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif;overflow-wrap:break-word}
.wrap{max-width:860px;margin:0 auto;padding:40px 16px 56px}
a{color:var(--series)}
h1{font-size:28px;line-height:1.2;letter-spacing:-.02em;margin:0 0 8px}
h2{font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);margin:0 0 4px;font-weight:600}
h3{font-size:14px;font-weight:600;margin:0 0 10px;color:var(--ink)}
p{margin:0 0 12px}
.lede{font-size:17px;color:var(--ink-2);margin:0 0 20px;max-width:56ch}
.promise{border:1px solid var(--border);border-left:3px solid var(--series);background:var(--accent-soft);border-radius:10px;padding:14px 16px;margin:0 0 36px}
.promise p{margin:0 0 6px;font-size:14px;color:var(--ink-2)}
.promise p:last-child{margin:0}
.promise b{color:var(--ink)}
section{margin:0 0 40px}
.caption{color:var(--muted);font-size:13px;margin:0 0 16px;max-width:64ch}
.note{color:var(--muted);font-size:13px;margin:10px 0 0;max-width:64ch}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:0 0 40px}
.tile{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}
.tile-value{display:block;font-size:30px;font-weight:600;letter-spacing:-.02em;line-height:1.1}
.tile.hero .tile-value{font-size:52px}
.tile-label{display:block;color:var(--ink-2);font-size:13px;margin-top:6px}
.chart{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:12px 8px}
.chart svg{display:block;width:100%;height:auto}
.grid{stroke:var(--grid);stroke-width:1}
.line{fill:none;stroke:var(--series);stroke-width:2;stroke-linejoin:round;stroke-linecap:round}
.dot{fill:var(--series);stroke:var(--surface);stroke-width:2}
.tick{fill:var(--muted);font-size:11px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.end-label{fill:var(--ink-2);font-size:12px;font-weight:600;font-family:system-ui,-apple-system,"Segoe UI",sans-serif}
.empty-chart{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:22px 18px}
.empty-baseline{height:1px;background:repeating-linear-gradient(90deg,var(--grid) 0 6px,transparent 6px 12px);margin-bottom:16px}
.empty-title{font-weight:600;margin:0 0 6px}
.empty-body{color:var(--ink-2);font-size:14px;margin:0;max-width:64ch}
.dims{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:14px}
.dim{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px}
.bars{list-style:none;margin:0;padding:0}
.bar+.bar{margin-top:12px}
.bar-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:5px}
.bar-label{font-size:14px;min-width:0}
.bar-other .bar-label{color:var(--ink-2);font-style:italic}
.bar-value{font-size:13px;color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}
.bar-value b{color:var(--ink);font-weight:600}
.bar-count{color:var(--muted);margin-left:8px}
.track{height:10px;background:var(--track);border-radius:2px;overflow:hidden}
.fill{height:100%;background:var(--series);border-radius:0 4px 4px 0}
.bar-note{color:var(--muted);font-size:12px;margin:5px 0 0}
.bar-hint{color:var(--muted);font-size:12px;font-style:normal}
.figures{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}
.figure{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:18px}
.figure-value{display:block;font-size:30px;font-weight:600;letter-spacing:-.02em}
.figure-label{display:block;color:var(--ink-2);font-size:13px;margin-top:6px}
.notice{background:var(--surface);border:1px solid var(--border);border-left:3px solid var(--series);border-radius:10px;padding:18px}
.notice p{color:var(--ink-2);font-size:14px;margin:0}
.notice p.notice-title{font-size:16px;font-weight:600;color:var(--ink);margin:0 0 10px}
footer{border-top:1px solid var(--border);padding-top:20px;color:var(--muted);font-size:13px}
footer p{margin:0 0 8px;max-width:72ch}
footer .stamp{color:var(--ink-2);font-variant-numeric:tabular-nums}
@media (max-width:420px){.wrap{padding:28px 16px 40px}h1{font-size:24px}.tile.hero .tile-value{font-size:44px}}
`;

function renderFooter(computedAt: string | null): string {
  const stamp = computedAt
    ? `Figures computed ${esc(formatTimestamp(computedAt))}, recomputed hourly.`
    : "No figures have been computed yet.";
  return `<footer>
  <p class="stamp">${stamp}</p>
  <p>BetterShift telemetry is <b>opt-in and off by default</b>. A self-hosted instance sends nothing until an administrator explicitly agrees; declining is permanent, and nothing here was counted without that consent.</p>
  <p>Percentages are shares of the instances that reported within the last 30 days — not of all BetterShift installations. A single instance can hold more than one value in some breakdowns (the custom field types it uses, for one), so the shares in a card need not add up to 100%.</p>
  <p>Each breakdown lists its ${esc(String(MAX_DISTRIBUTION_ENTRIES))} largest values and sums everything past that into one <i>other (N more values)</i> entry. That is a size guard — the reported strings are arbitrary and a page has to stay small — not a privacy rule: nothing is withheld for being rare, and a value held by a single instance is published with its count of one.</p>
  <p>Every field an instance can send is documented in <a href="${esc(DOCS_URL)}" rel="noopener">docs/TELEMETRY.md</a>.</p>
</footer>`;
}

function page(main: string, computedAt: string | null): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="Anonymous, opt-in usage statistics from self-hosted BetterShift instances.">
<title>BetterShift — public statistics</title>
<style>${STYLES}</style>
</head>
<body>
<div class="wrap">
<header>
<h1>BetterShift in the wild</h1>
<p class="lede">What self-hosted BetterShift instances look like, as reported by the ones whose administrators chose to share.</p>
<div class="promise">
<p><b>Nobody is counted without agreeing first.</b> Telemetry is opt-in and off by default; an instance sends nothing until an admin says yes.</p>
<p><b>No names, no URLs, no IP addresses.</b> Sizes travel as buckets, never as exact counts.</p>
<p><b>One snapshot a day, nothing in between.</b> No page tracking, no analytics script, no cookie — and every field an instance can send is documented before an admin agrees to it.</p>
</div>
</header>
${main}
${renderFooter(computedAt)}
</div>
</body>
</html>
`;
}

export function renderPage(aggregate: PublicAggregate | null): string {
  if (!aggregate || !aggregate.instances) {
    return page(
      `<section id="empty">
  <div class="notice">
    <p class="notice-title">No data yet</p>
    <p>No statistics have been computed so far. This page fills in once instances have opted in and reported — until then there is genuinely nothing to show.</p>
  </div>
</section>`,
      null,
    );
  }

  const instances = aggregate.instances;
  const total = Number(instances.total ?? 0);

  const tiles = `<section id="headline">
  <h2>Reporting instances</h2>
  <p class="caption">Instances that sent a report within the last 30 days.</p>
  <div class="tiles">
    <div class="tile hero"><span class="tile-value">${esc(count(total))}</span><span class="tile-label">${esc(plural(total, "instance reporting", "instances reporting"))}</span></div>
    <div class="tile"><span class="tile-value">${esc(count(Number(instances.activeLast7Days ?? 0)))}</span><span class="tile-label">Active in the last 7 days</span></div>
    <div class="tile"><span class="tile-value">${esc(count(Number(instances.newLast30Days ?? 0)))}</span><span class="tile-label">First seen in the last 30 days</span></div>
  </div>
</section>`;

  const history = Array.isArray(aggregate.history) ? aggregate.history : [];

  // The history window is 90 days and the headline window is 30, so days can
  // outlive the instances that reported them. Keep the chart in that case.
  if (total <= 0) {
    const hasHistory = history.length > 0;
    const main = tiles + renderNoReportsNotice(hasHistory) + (hasHistory ? renderHistory(history) : "");
    return page(main, aggregate.computedAt ?? null);
  }

  const versions = Array.isArray(aggregate.versions) ? aggregate.versions : [];
  const environment = aggregate.environment ?? {};
  const configuration = aggregate.configuration ?? {};
  const sizes = aggregate.sizes ?? {};
  const features = aggregate.features ?? {};
  const customFieldTypes = Array.isArray(aggregate.customFieldTypes) ? aggregate.customFieldTypes : [];

  const customFields =
    customFieldTypes.length > 0
      ? `<section id="custom-fields">
  <h2>Custom field types</h2>
  <p class="caption">Which custom field types are in use. Field keys and labels are never collected — only the type. An instance appears once per type it uses, so these counts describe types, not a split of the instance population.</p>
  <div class="dims">
${renderGroup("types", customFieldTypes)}
  </div>
</section>`
      : "";

  const main = [
    tiles,
    renderHistory(history),
    renderVersions(versions),
    renderDistributionSection("environment", "Runtime environment", "What the app runs on.", environment),
    renderDistributionSection(
      "configuration",
      "Configuration",
      "How instances are set up. Each setting is counted on its own.",
      configuration,
    ),
    renderDistributionSection(
      "sizes",
      "Size of an instance",
      "Reported as buckets, never as exact counts.",
      sizes,
    ),
    renderDistributionSection(
      "features",
      "Feature use",
      "Which optional parts of the app are in use.",
      features,
    ),
    customFields,
    renderHealth(aggregate.health),
  ]
    .filter(Boolean)
    .join("\n");

  return page(main, aggregate.computedAt ?? null);
}
