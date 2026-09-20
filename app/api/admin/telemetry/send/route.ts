import { NextRequest, NextResponse } from "next/server";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { canManageSystemSettings } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/rate-limiter";
import { logAdminAction, type TelemetrySendMetadata } from "@/lib/audit-log";
import { sendTelemetryNow, toSendAuditMetadata } from "@/lib/telemetry/sender";

/**
 * Sends the telemetry payload right away instead of waiting for the daily timer.
 *
 * POST /api/admin/telemetry/send
 *
 * Same guards as the daily send: nothing is sent unless telemetry is on, the
 * consent covers the current schema, and the build is not a dev build.
 *
 * Permission: Admin or Superadmin only
 */
export async function POST(request: NextRequest) {
  const currentUser = await getValidatedAdminUser(request);
  if (isErrorResponse(currentUser)) return currentUser;

  if (!canManageSystemSettings(currentUser)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const limited = rateLimit(request, currentUser.id, "telemetry-send");
  if (limited) return limited;

  try {
    const result = await sendTelemetryNow();

    if (result.status === "sent" || result.status === "failed") {
      await logAdminAction<TelemetrySendMetadata>({
        action: "admin.telemetry_send",
        userId: currentUser.id,
        resourceType: "system_settings",
        request,
        metadata: toSendAuditMetadata(result),
      });
    }

    if (result.status === "sent") {
      return NextResponse.json({ ok: true });
    }
    if (result.status === "failed") {
      return NextResponse.json(
        { error: "Telemetry endpoint did not accept the request", reason: result.reason },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "Telemetry is not sendable", reason: result.status },
      { status: 409 }
    );
  } catch (error) {
    console.error("Failed to send telemetry:", error);
    return NextResponse.json({ error: "Failed to send telemetry" }, { status: 500 });
  }
}
