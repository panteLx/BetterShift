import { NextRequest, NextResponse } from "next/server";
import { getUserSessions, revokeAllSessions } from "@/lib/auth/sessions";
import { logAuditEvent } from "@/lib/audit-log";
import { isAuthEnabled } from "@/lib/auth/feature-flags";
import { auth } from "@/lib/auth";

/**
 * GET /api/auth/sessions
 * List all active sessions for the current user
 */
export async function GET(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Authentication is disabled" },
      { status: 403 }
    );
  }

  // Get current session with Better Auth API
  const sessionData = await auth.api.getSession({ headers: request.headers });
  if (!sessionData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessions = await getUserSessions(sessionData.user.id);

  return NextResponse.json({ sessions });
}

/**
 * DELETE /api/auth/sessions
 * Revoke all sessions except the current one (logout from all devices)
 */
export async function DELETE(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json(
      { error: "Authentication is disabled" },
      { status: 403 }
    );
  }

  // Get current session with Better Auth API (includes session ID)
  const sessionData = await auth.api.getSession({ headers: request.headers });
  if (!sessionData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const revokedCount = await revokeAllSessions(
    sessionData.user.id,
    sessionData.session.id
  );

  // Log audit event
  await logAuditEvent({
    action: "auth.session.revoked",
    userId: sessionData.user.id,
    resourceType: "session",
    metadata: {
      revokedBy: "user",
      count: revokedCount,
    },
    request,
    severity: "warning",
    isUserVisible: true,
  });

  return NextResponse.json({
    success: true,
    revokedCount,
    message: `Logged out from ${revokedCount} device(s)`,
  });
}
