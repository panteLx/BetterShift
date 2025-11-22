import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // This middleware doesn't need to do anything
  // Locale detection is handled in i18n.ts
  return NextResponse.next();
}

export const config = {
  // Skip middleware for api, static files, etc.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
