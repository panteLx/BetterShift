import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { AuthHeader } from "@/components/auth-header";
import { AppFooter } from "@/components/app-footer";
import { useVersionInfo } from "@/hooks/useVersionInfo";
import { Calendar as CalendarIcon, Plus } from "lucide-react";

interface EmptyCalendarStateProps {
  onCreateCalendar: () => void;
  showUserMenu?: boolean;
}

export function EmptyCalendarState({
  onCreateCalendar,
  showUserMenu = false,
}: EmptyCalendarStateProps) {
  const t = useTranslations();
  const versionInfo = useVersionInfo();

  return (
    <div className="min-h-screen flex flex-col">
      <AuthHeader showUserMenu={showUserMenu} />
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
            className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
          >
            <CalendarIcon className="h-10 w-10 text-primary" />
          </motion.div>
          <div className="space-y-3">
            <h1 className="text-2xl sm:text-3xl font-bold">
              {t("onboarding.welcome")}
            </h1>
            <p className="text-muted-foreground text-sm sm:text-base leading-relaxed">
              {t("onboarding.description")}
            </p>
          </div>
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={onCreateCalendar}
              size="lg"
              className="h-12 px-8 text-base font-semibold shadow-lg shadow-primary/20"
            >
              <Plus className="mr-2 h-5 w-5" />
              {t("onboarding.createCalendar")}
            </Button>
          </motion.div>
        </motion.div>
      </div>
      <AppFooter versionInfo={versionInfo} />
    </div>
  );
}
