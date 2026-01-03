import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Debug endpoint to check request headers and session validation
 * DELETE THIS FILE after debugging!
 */
export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};

  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  // Try to get current session from Better Auth
  let session = null;
  let sessionError = null;
  try {
    session = await auth.api.getSession({ headers: req.headers });
  } catch (error) {
    sessionError = error instanceof Error ? error.message : String(error);
  }

  return NextResponse.json({
    url: req.url,
    nextUrl: req.nextUrl.toString(),
    headers,
    cookies: req.cookies.getAll(),
    session: session
      ? {
          userId: session.user?.id,
          userEmail: session.user?.email,
          sessionId: session.session?.id,
          expiresAt: session.session?.expiresAt,
        }
      : null,
    sessionError,
  });
}
