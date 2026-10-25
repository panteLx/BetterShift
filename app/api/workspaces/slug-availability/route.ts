import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { MULTI_TENANT } from "@/lib/auth/env";
import { rateLimit } from "@/lib/rate-limiter";
import { checkSlugAvailability } from "@/lib/workspaces";

export async function GET(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });
  const limited = rateLimit(request, user.id, "slug-check");
  if (limited) return limited;
  const slug = request.nextUrl.searchParams.get("slug") ?? "";
  return NextResponse.json({ slug, status: await checkSlugAvailability(slug) });
}
