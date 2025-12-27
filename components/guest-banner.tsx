"use client";

import { useTranslations } from "next-intl";
import { Info, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion } from "motion/react";
import Link from "next/link";

interface GuestBannerProps {
  variant?: "default" | "compact";
}

export function GuestBanner({ variant = "default" }: GuestBannerProps) {
  const t = useTranslations();

  if (variant === "compact") {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-lg p-3 flex items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <p className="text-sm text-blue-900 dark:text-blue-100 truncate">
            {t("guest.viewingAsGuest")}
          </p>
        </div>
        <Button asChild size="sm" variant="outline" className="shrink-0">
          <Link href="/login">
            <LogIn className="h-3.5 w-3.5 mr-1.5" />
            {t("auth.login")}
          </Link>
        </Button>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200 dark:border-blue-900/50 rounded-xl p-4 shadow-sm"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5 shrink-0">
            <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center">
              <Info className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
              {t("guest.viewingAsGuest")}
            </h3>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              {t("guest.bannerMessage")}
            </p>
          </div>
        </div>
        <Button
          asChild
          size="sm"
          className="bg-blue-600 hover:bg-blue-700 text-white shrink-0"
        >
          <Link href="/login">
            <LogIn className="h-4 w-4 mr-2" />
            {t("guest.loginForFullAccess")}
          </Link>
        </Button>
      </div>
    </motion.div>
  );
}
