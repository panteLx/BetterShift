"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { signOut } from "@/lib/auth/client";

/** Ends the session, confirms it and returns to the sign-in page. */
export function useSignOut() {
  const t = useTranslations();
  const router = useRouter();

  return async () => {
    try {
      // Better Auth resolves with `{ error }` instead of rejecting, so a failed
      // sign-out must be caught here — navigating anyway would bounce the still
      // signed-in user straight back from /login.
      const { error } = await signOut();

      if (error) {
        if (error.status === 429) {
          toast.error(t("rateLimit.title"), { description: t("rateLimit.fallback") });
        } else {
          toast.error(error.message || t("common.error"));
        }
        return;
      }

      toast.success(t("auth.logoutSuccess"));
      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("common.error"));
    }
  };
}
