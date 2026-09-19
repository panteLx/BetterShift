import { NextRequest, NextResponse } from "next/server";
import { getValidatedAdminUser, isErrorResponse } from "@/lib/auth/admin-helpers";
import { canManageSystemSettings } from "@/lib/auth/admin";
import { rateLimit } from "@/lib/rate-limiter";
import { collectTelemetryPayload } from "@/lib/telemetry/collect";
import { ensureTelemetryInstanceId } from "@/lib/telemetry/instance-id";

/**
 * Admin preview of the telemetry payload.
 *
 * GET /api/admin/telemetry/payload?profile=telemetry|diagnostics
 *
 * Permission: Admin or Superadmin only
 */
export async function GET(request: NextRequest) {
  const currentUser = await getValidatedAdminUser(request);
  if (isErrorResponse(currentUser)) return currentUser;

  if (!canManageSystemSettings(currentUser)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const limited = rateLimit(request, currentUser.id, "telemetry-payload");
  if (limited) return limited;

  const profile =
    request.nextUrl.searchParams.get("profile") === "diagnostics"
      ? "diagnostics"
      : "telemetry";

  try {
    await ensureTelemetryInstanceId();
    const payload =
      profile === "diagnostics"
        ? await collectTelemetryPayload("diagnostics")
        : await collectTelemetryPayload("telemetry");
    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Failed to collect telemetry payload:", error);
    return NextResponse.json(
      { error: "Failed to collect telemetry payload" },
      { status: 500 }
    );
  }
}
