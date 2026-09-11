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
      await signOut({
        fetchOptions: {
          onSuccess: () => {
            toast.success(t("auth.logoutSuccess"));
          },
        },
      });
      router.replace("/login");
    } catch (error) {
      console.error("Sign out error:", error);
      toast.error(t("common.error"));
    }
  };
}
