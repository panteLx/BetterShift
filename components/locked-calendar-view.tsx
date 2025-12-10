import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as CalendarIcon } from "lucide-react";
import { verifyAndCachePassword } from "@/lib/password-cache";

interface LockedCalendarViewProps {
  calendarId: string;
  onUnlock: () => void;
}

export function LockedCalendarView({
  calendarId,
  onUnlock,
}: LockedCalendarViewProps) {
  const t = useTranslations();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;

    if (password && calendarId) {
      const result = await verifyAndCachePassword(calendarId, password);

      if (result.valid) {
        onUnlock();
      } else {
        toast.error(t("validation.passwordIncorrect"));
      }
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl border border-border/50 rounded-2xl p-8">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6 mx-auto">
            <CalendarIcon className="h-10 w-10 text-primary" />
          </div>
          <h3 className="text-2xl font-semibold mb-2 text-center">
            {t("password.currentlyLocked")}
          </h3>
          <p className="text-muted-foreground text-center mb-8">
            {t("password.enterCalendarPassword")}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="unlock-password" className="text-sm font-medium">
                {t("form.passwordLabel")}
              </Label>
              <Input
                id="unlock-password"
                name="password"
                type="password"
                placeholder={t("form.passwordPlaceholder")}
                className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20"
                autoFocus
              />
            </div>
            <Button
              type="submit"
              className="w-full h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25"
            >
              {t("common.unlock")}
            </Button>
          </form>
        </div>
      </motion.div>
    </div>
  );
}
