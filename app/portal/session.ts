import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// The proxy only checks cookie presence; this validates the session itself.
export async function requirePortalUser(returnPath: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect(`/login?returnUrl=${encodeURIComponent(returnPath)}`);
  return session.user;
}
