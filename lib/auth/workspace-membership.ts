import { db } from "@/lib/db";
import { member } from "@/lib/db/schema";
import { isFirstUser } from "@/lib/auth/first-user";

const DEFAULT_WORKSPACE_ID = "default";

/**
 * Single-tenant mode only: every new account joins the `default` workspace,
 * as its owner if it's the very first account on the instance (mirrors
 * handleFirstUserPromotion's superadmin rule). Multi-tenant mode gives a new
 * user no membership at all — sub-project 3 creates their own workspace.
 */
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
