// Mirrors lib/telemetry/schema.ts's TelemetryPayload (schemaVersion 1) by value.
// This project must not import from the main app — see telemetry-hub's isolation note.
export interface PayloadV1 {
  schemaVersion: 1;
  instanceId: string | null;
  sentAt: string;
  app: { version: string; isDev: boolean; migrations: number };
  runtime: { node: string; arch: string; platform: string; sqlite: string; timezone: string };
  config: {
    authEnabled: boolean;
    guestAccess: boolean;
    registrationOpen: boolean;
    defaultLocale: string;
    updateCheckEnabled: boolean;
    rateLimitOverrides: number;
  };
  scale: {
    users: string;
    calendars: string;
    shifts: string;
    presets: string;
    notes: string;
    bundles: string;
    shares: string;
    accessTokens: string;
    signups: string;
  };
  features: {
    externalSyncs: string;
    calendarViewOverrides: string;
    customFields: { count: string; types: string[] };
    archivedPresets: boolean;
    splitShifts: boolean;
  };
  health: { uptimeHours: number; syncRuns24h: number; syncFailures24h: number };
}

const BUCKETS = new Set(["0", "1-5", "6-20", "21-100", "101-500", "500+"]);
const SCALE_KEYS = [
  "users",
  "calendars",
  "shifts",
  "presets",
  "notes",
  "bundles",
  "shares",
  "accessTokens",
  "signups",
] as const;

/** Returns null for anything that is not a well-formed v1 payload. */
export function parseV1(input: unknown): PayloadV1 | null {
  if (typeof input !== "object" || input === null) return null;
  const p = input as Record<string, unknown>;
  if (p.schemaVersion !== 1) return null;
  if (typeof p.sentAt !== "string") return null;
  if (p.instanceId !== null && typeof p.instanceId !== "string") return null;

  const scale = p.scale;
  if (typeof scale !== "object" || scale === null) return null;
  const scaleRecord = scale as Record<string, unknown>;
  for (const key of SCALE_KEYS) {
    const value = scaleRecord[key];
    if (typeof value !== "string" || !BUCKETS.has(value)) return null;
  }

  const app = p.app;
  if (typeof app !== "object" || app === null) return null;
  const appRecord = app as Record<string, unknown>;
  if (typeof appRecord.version !== "string") return null;
  if (typeof appRecord.isDev !== "boolean") return null;
  if (typeof appRecord.migrations !== "number") return null;

  const runtime = p.runtime;
  if (typeof runtime !== "object" || runtime === null) return null;
  const runtimeRecord = runtime as Record<string, unknown>;
  for (const key of ["node", "arch", "platform", "sqlite", "timezone"]) {
    if (typeof runtimeRecord[key] !== "string") return null;
  }

  const config = p.config;
  if (typeof config !== "object" || config === null) return null;
  const configRecord = config as Record<string, unknown>;
  for (const key of ["authEnabled", "guestAccess", "registrationOpen", "updateCheckEnabled"]) {
    if (typeof configRecord[key] !== "boolean") return null;
  }
  if (typeof configRecord.defaultLocale !== "string") return null;
  if (typeof configRecord.rateLimitOverrides !== "number") return null;

  const features = p.features;
  if (typeof features !== "object" || features === null) return null;
  const featuresRecord = features as Record<string, unknown>;
  if (typeof featuresRecord.externalSyncs !== "string" || !BUCKETS.has(featuresRecord.externalSyncs))
    return null;
  if (
    typeof featuresRecord.calendarViewOverrides !== "string" ||
    !BUCKETS.has(featuresRecord.calendarViewOverrides)
  )
    return null;
  const customFields = featuresRecord.customFields;
  if (typeof customFields !== "object" || customFields === null) return null;
  const customFieldsRecord = customFields as Record<string, unknown>;
  if (typeof customFieldsRecord.count !== "string" || !BUCKETS.has(customFieldsRecord.count))
    return null;
  if (
    !Array.isArray(customFieldsRecord.types) ||
    !customFieldsRecord.types.every((t) => typeof t === "string")
  )
    return null;
  if (typeof featuresRecord.archivedPresets !== "boolean") return null;
  if (typeof featuresRecord.splitShifts !== "boolean") return null;

  const health = p.health;
  if (typeof health !== "object" || health === null) return null;
  const healthRecord = health as Record<string, unknown>;
  for (const key of ["uptimeHours", "syncRuns24h", "syncFailures24h"]) {
    if (typeof healthRecord[key] !== "number") return null;
  }

  return p as unknown as PayloadV1;
}
