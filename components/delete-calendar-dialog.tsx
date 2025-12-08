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
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border border-destructive/50 bg-gradient-to-b from-background via-background to-destructive/5 backdrop-blur-xl shadow-2xl shadow-destructive/10">
        <DialogHeader className="border-b border-destructive/30 bg-gradient-to-r from-destructive/15 via-destructive/10 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="flex items-center gap-2.5 text-destructive text-xl font-semibold">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-destructive to-destructive/80 flex items-center justify-center shadow-lg shadow-destructive/30">
              <AlertTriangle className="h-5 w-5 text-white" />
            </div>
            {t("calendar.deleteCalendar")}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-2.5 pt-2 pl-12">
              <div className="font-semibold text-foreground flex items-center gap-2">
                <div className="w-1 h-4 bg-gradient-to-b from-destructive to-destructive/50 rounded-full"></div>
                {t("common.deleteConfirm", {
                  item: t("calendar.title"),
                  name: calendarName,
                })}
              </div>
              <div className="text-sm text-muted-foreground bg-destructive/5 p-3 rounded-lg border border-destructive/20">
                {t("calendar.deleteWarning", {
                  default:
                    "This action cannot be undone. All shifts, presets, and notes will be permanently deleted.",
                })}
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {hasPassword && (
            <div className="space-y-2.5">
              <Label
                htmlFor="password"
                className="text-sm font-medium flex items-center gap-2"
              >
                <div className="w-1 h-4 bg-gradient-to-b from-destructive to-destructive/50 rounded-full"></div>
                {t("form.passwordLabel")}
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("form.passwordPlaceholder")}
                className="h-11 border-destructive/30 focus:border-destructive/50 focus:ring-destructive/20 bg-background/50"
                required
                autoFocus
              />
            </div>
          )}
          <DialogFooter className="gap-2.5 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none h-11 border-border/50 hover:bg-muted/50"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              className="flex-1 sm:flex-none h-11 shadow-lg shadow-destructive/25"
            >
              {t("common.delete")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
