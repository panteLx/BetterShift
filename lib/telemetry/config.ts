export const DEFAULT_TELEMETRY_ENDPOINT = "https://telemetry.bettershift.app/";

/** Tri-state, mirroring the nullable column: unset means the instance decides. */
function envOverride(): boolean | null {
  const raw = process.env.TELEMETRY_ENABLED;
  if (raw === undefined || raw === "") return null;
  return raw === "true";
}

export function isTelemetryForcedByEnv(): boolean {
  return envOverride() !== null;
}

/** A set env var always wins over the database, in both directions. */
export function resolveTelemetryEnabled(stored: boolean | null): boolean {
  return envOverride() ?? stored === true;
}

export function getTelemetryEndpoint(): string {
  return process.env.TELEMETRY_ENDPOINT || DEFAULT_TELEMETRY_ENDPOINT;
}
