import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { Calendar as CalendarIcon } from "lucide-react";

export function LoadingState() {
  const t = useTranslations();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20">
      <motion.div
        className="text-center space-y-4"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        >
          <CalendarIcon className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-primary" />
        </motion.div>
        <p className="text-sm sm:text-base text-muted-foreground font-medium">
          {t("common.loading")}
        </p>
      </motion.div>
    </div>
  );
}
