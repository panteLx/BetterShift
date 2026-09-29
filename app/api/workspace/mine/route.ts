import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/sessions";
import { getRequestWorkspace } from "@/lib/workspace";
import { MULTI_TENANT } from "@/lib/auth/env";
import { myWorkspacesPayload } from "@/lib/workspaces";

export async function GET(request: NextRequest) {
  if (!MULTI_TENANT) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const workspace = await getRequestWorkspace();
  if (!workspace) return NextResponse.json({ error: "Not found", code: "not_found" }, { status: 404 });
  const user = await getSessionUser(request.headers);
  if (!user) return NextResponse.json({ error: "Authentication required", code: "unauthorized" }, { status: 401 });
  return NextResponse.json(await myWorkspacesPayload(user.id));
}
