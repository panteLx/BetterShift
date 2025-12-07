"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { verifyAndCachePassword } from "@/lib/password-cache";

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  onSuccess: (password: string) => void;
}

export function PasswordDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  onSuccess,
}: PasswordDialogProps) {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPassword("");
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await verifyAndCachePassword(calendarId, password);

      if (result.valid) {
        onSuccess(password);
        onOpenChange(false);
      } else {
        setError(t("validation.passwordIncorrect"));
      }
    } catch (error) {
      console.error("Failed to verify password:", error);
      setError(t("validation.passwordIncorrect"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px] p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("form.passwordLabel")} {t("common.required")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-red-500 to-red-500/50 rounded-full"></div>
              {t("password.enter", { name: calendarName })}
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="space-y-2.5">
            <Label
              htmlFor="password"
              className="text-sm font-medium flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-red-500 to-red-500/50 rounded-full"></div>
              {t("form.passwordLabel")}
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password.enterCalendarPassword")}
              className="h-11 border-red-500/30 focus:border-red-500/50 focus:ring-red-500/20 bg-background/50"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1.5 bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                {error}
              </p>
            )}
          </div>
          <div className="flex gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 h-11 border-border/50 hover:bg-muted/50"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              disabled={loading || !password}
              className="flex-1 h-11 bg-gradient-to-r from-red-500 to-red-500/90 hover:from-red-500/90 hover:to-red-500/80 shadow-lg shadow-red-500/25 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? t("common.loading") : t("common.unlock")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
