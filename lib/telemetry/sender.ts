import { logSystemEvent, type TelemetrySendMetadata } from "@/lib/audit-log";
import { getSystemSettings } from "@/lib/system-settings";
import { collectTelemetryPayload } from "@/lib/telemetry/collect";
import {
  getTelemetryEndpoint,
  isTelemetryForcedByEnv,
  resolveTelemetryEnabled,
} from "@/lib/telemetry/config";
import { ensureTelemetryInstanceId } from "@/lib/telemetry/instance-id";
import { TELEMETRY_SCHEMA_VERSION } from "@/lib/telemetry/schema";

const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 5000;

// Without a random first delay every instance restarting after a release tag
// would fire at the same moment.
const MIN_START_DELAY_MS = 5 * 60 * 1000;
const MAX_START_DELAY_MS = 30 * 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let stopped = false;

export type TelemetrySendResult =
  | { status: "sent" }
  | { status: "disabled" }
  | { status: "consent-outdated" }
  | { status: "dev-build" }
  | { status: "failed"; reason: "timeout" | "network" | "http" };

// Shared by the daily timer and the admin "send now" button. Throws on DB
// errors; only the network leg is turned into a result.
export async function sendTelemetryNow(): Promise<TelemetrySendResult> {
  const settings = await getSystemSettings();
  if (!resolveTelemetryEnabled(settings.telemetryEnabled)) {
    return { status: "disabled" };
  }
  // A consent given for an older schema does not cover new data categories;
  // the env override is the operator's own standing decision and needs none.
  if (
    !isTelemetryForcedByEnv() &&
    (settings.telemetryConsentedSchema ?? 0) < TELEMETRY_SCHEMA_VERSION
  ) {
    return { status: "consent-outdated" };
  }

  await ensureTelemetryInstanceId();
  const payload = await collectTelemetryPayload("telemetry");
  if (payload.app.isDev) return { status: "dev-build" };

  const controller = new AbortController();
  const abort = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(getTelemetryEndpoint(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return response.ok
      ? { status: "sent" }
      : { status: "failed", reason: "http" };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { status: "failed", reason: timedOut ? "timeout" : "network" };
  } finally {
    clearTimeout(abort);
  }
}

/** Outcome for the audit log; never the endpoint URL, which can be private. */
export function toSendAuditMetadata(
  result: Extract<TelemetrySendResult, { status: "sent" | "failed" }>
): TelemetrySendMetadata {
  return result.status === "sent"
    ? { result: "sent" }
    : { result: "failed", reason: result.reason };
}

// Fire-and-forget on purpose: no retry, no backoff, no console output. An
// instance whose logs fill with telemetry errors is worse than a missing data
// point; the one audit entry per attempt is what shows the last outcome.
// The whole body is one try/catch -- sendTelemetryNow can throw too (DB lock,
// query error), not just fetch.
async function sendOnce(): Promise<void> {
  try {
    const result = await sendTelemetryNow();
    if (result.status === "sent" || result.status === "failed") {
      await logSystemEvent<TelemetrySendMetadata>({
        action: "system.telemetry_send",
        resourceType: "system_settings",
        metadata: toSendAuditMetadata(result),
      });
    }
  } catch {
    // ignored on purpose
  }
}

function schedule(delay: number): void {
  if (stopped) return;
  timer = setTimeout(() => {
    // .catch() belt-and-braces alongside sendOnce()'s own try/catch: a throw
    // here must never become an unhandled rejection that kills the process.
    void sendOnce()
      .catch(() => {})
      .finally(() => schedule(DAY_MS));
  }, delay);
}

export const telemetryService = {
  start(): void {
    if (timer) return;
    stopped = false;
    const jitter =
      MIN_START_DELAY_MS +
      Math.random() * (MAX_START_DELAY_MS - MIN_START_DELAY_MS);
    schedule(jitter);
  },
  stop(): void {
    // An in-flight send's .finally() would otherwise re-arm a 24h timer.
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
  },
};
