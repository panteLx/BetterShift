"use client";

import { motion } from "motion/react";
import { useTranslations, useLocale } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { UserMenu } from "@/components/user-menu";
import { Calendar as CalendarIcon, Bell, ExternalLink } from "lucide-react";
import { useVersionUpdateCheck } from "@/hooks/useVersionUpdate";
import { ChangelogDialog } from "@/components/changelog-dialog";

/**
 * Simplified header for authentication pages
 * Shows only logo, app name, and user menu (for profile page)
 * No calendar-related elements
 */
interface AuthHeaderProps {
  showUserMenu?: boolean;
}

export function AuthHeader({ showUserMenu = false }: AuthHeaderProps) {
  const t = useTranslations();
  const locale = useLocale();
  const { versionInfo } = useVersionUpdateCheck();
  const [showChangelog, setShowChangelog] = useState(false);

  return (
    <>
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-sm">
        <div className="container max-w-4xl mx-auto p-3 sm:p-4">
          <div className="space-y-3 sm:space-y-4">
            {/* Header with Logo and optional User Menu */}
            <div className="flex items-center justify-between gap-4">
              {/* Logo Section - Clickable to go home */}
              <Link href="/" className="flex items-center gap-3 group">
                <motion.div
                  className="flex items-center gap-3"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-700 dark:from-slate-800 dark:via-slate-700 dark:to-slate-600 flex items-center justify-center shadow-xl shadow-slate-900/50 dark:shadow-slate-950/70 ring-2 ring-slate-700/50 dark:ring-slate-600/50 transition-transform group-hover:scale-105">
                      <CalendarIcon className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold bg-gradient-to-r from-foreground via-foreground to-foreground/70 bg-clip-text transition-all group-hover:from-primary group-hover:via-primary group-hover:to-primary/70">
                      {t("app.title")}
                    </h1>
                    <p className="text-xs text-muted-foreground font-medium">
                      {t("app.subtitle", { default: "Organize your shifts" })}
                    </p>
                  </div>
                </motion.div>
              </Link>

              {/* User Menu (optional - shown on profile page) */}
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: 0.15 }}
                >
                  <UserMenu />
                </motion.div>
              )}
            </div>

            {/* Update Notification Banner */}
            {versionInfo?.hasUpdate && !versionInfo.isDev && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="relative"
              >
                <button
                  onClick={() => setShowChangelog(true)}
                  className="w-full bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 backdrop-blur-sm border border-primary/30 rounded-xl p-3 sm:p-3.5 flex items-center justify-between gap-3 hover:from-primary/15 hover:via-primary/10 hover:to-primary/15 hover:border-primary/40 transition-all shadow-sm hover:shadow-md active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-2.5 sm:gap-3 flex-1 min-w-0">
                    <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-primary group-hover:scale-110 transition-transform" />
                      <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full animate-pulse shadow-sm"></div>
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-sm sm:text-base font-semibold text-primary mb-0.5">
                        {t("update.available")}
                      </p>
                      <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                        {t("update.newVersion", {
                          version: versionInfo.latestVersion || "unknown",
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-2 text-primary">
                    <span className="text-xs sm:text-sm font-medium hidden sm:inline">
                      {t("update.viewChangelog")}
                    </span>
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                      <ExternalLink className="h-4 w-4 group-hover:rotate-12 transition-transform" />
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Changelog Dialog */}
      <ChangelogDialog
        open={showChangelog}
        onOpenChange={setShowChangelog}
        locale={locale}
      />
    </>
  );
}
