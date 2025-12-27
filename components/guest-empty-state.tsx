"use client";

import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { Calendar as CalendarIcon, LogIn } from "lucide-react";
import { useRouter } from "next/navigation";

/**
 * Empty state shown to guests when no public calendars are available
 * Displays a message prompting them to log in
 */
export function GuestEmptyState() {
  const t = useTranslations();
  const router = useRouter();
  const versionInfo = useVersionInfo();

  const handleLoginClick = () => {
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader showUserMenu={false} />
      <div className="flex-1 flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-primary/5">
        <motion.div
          className="text-center space-y-6 max-w-md"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-muted/50 to-muted/20 flex items-center justify-center"
          >
            <CalendarIcon className="h-10 w-10 text-muted-foreground" />
          </motion.div>
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {t("guestEmptyState.title")}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {t("guestEmptyState.description")}
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleLoginClick}
              size="lg"
              className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20"
            >
              <LogIn className="mr-2 h-5 w-5" />
              {t("guestEmptyState.loginButton")}
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
