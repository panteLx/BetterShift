import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { isFirstUser } from "@/lib/auth/first-user";
import { DEFAULT_WORKSPACE_ID } from "@/lib/workspace";

// Single-tenant only: the first account becomes owner of `default`, mirroring the superadmin rule.
export async function handleSingleTenantMembership(
  userId: string
): Promise<void> {
  const isFirst = await isFirstUser(userId);
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: DEFAULT_WORKSPACE_ID,
    userId,
    role: isFirst ? "owner" : "member",
  });
}
