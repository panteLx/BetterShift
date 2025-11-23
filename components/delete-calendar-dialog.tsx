"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle } from "lucide-react";

interface DeleteCalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarName: string;
  hasPassword: boolean;
  onConfirm: (password?: string) => void;
}

export function DeleteCalendarDialog({
  open,
  onOpenChange,
  calendarName,
  hasPassword,
  onConfirm,
}: DeleteCalendarDialogProps) {
  const t = useTranslations();
  const [password, setPassword] = useState("");

  useEffect(() => {
    if (!open) {
      setPassword("");
    }
  }, [open]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(hasPassword ? password : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            {t("calendar.deleteCalendar")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2 pt-2">
              <div className="font-semibold">
                {t("calendar.deleteConfirm", { name: calendarName })}
              </div>
              <div className="text-sm text-muted-foreground">
                {t("calendar.deleteWarning", {
                  default:
                    "This action cannot be undone. All shifts, presets, and notes will be permanently deleted.",
                })}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="password">{t("password.password")}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("password.passwordPlaceholder")}
                required
                autoFocus
              />
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" variant="destructive">
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
