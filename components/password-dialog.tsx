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
      const response = await fetch(
        `/api/calendars/${calendarId}/verify-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        }
      );

      const data = await response.json();

      if (data.valid) {
        // Store password in localStorage
        localStorage.setItem(`calendar_password_${calendarId}`, password);
        onSuccess(password);
        onOpenChange(false);
      } else {
        setError(t("password.errorIncorrect"));
      }
    } catch (error) {
      console.error("Failed to verify password:", error);
      setError(t("password.errorIncorrect"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {t("password.password")} {t("common.required")}
          </DialogTitle>
          <DialogDescription>
            {t("password.enter", { name: calendarName })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="password">{t("password.password")}</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password.enterCalendarPassword")}
              autoFocus
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading || !password}>
              {loading ? t("common.loading") : t("password.unlock")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
