import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to check request headers
 * DELETE THIS FILE after debugging!
 */
export async function GET(req: NextRequest) {
  const headers: Record<string, string> = {};

  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return NextResponse.json({
    url: req.url,
    nextUrl: req.nextUrl.toString(),
    headers,
    cookies: req.cookies.getAll(),
  });
}
