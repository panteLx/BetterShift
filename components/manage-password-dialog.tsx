"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { removeCachedPassword, setCachedPassword } from "@/lib/password-cache";

interface ManagePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  hasPassword: boolean;
  isLocked: boolean;
  onSuccess: () => void;
}

export function ManagePasswordDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  hasPassword,
  isLocked,
  onSuccess,
}: ManagePasswordDialogProps) {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [lockCalendar, setLockCalendar] = useState(isLocked);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRemovePassword(false);
      setLockCalendar(isLocked);
      setError("");
    }
  }, [open, isLocked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Always require current password when calendar has password
    if (hasPassword && !currentPassword) {
      setError(t("validation.passwordRequired"));
      return;
    }

    // Validate new password fields if changing password
    const isChangingPassword = !removePassword && newPassword;
    if (isChangingPassword) {
      if (newPassword !== confirmPassword) {
        setError(t("validation.passwordMatch"));
        return;
      }
    }

    // If trying to lock without password
    if (lockCalendar && removePassword) {
      setError(t("password.lockRequiresPassword"));
      return;
    }

    setLoading(true);

    try {
      const requestBody: {
        currentPassword?: string;
        isLocked: boolean;
        password?: string | null;
      } = {
        currentPassword: hasPassword ? currentPassword : undefined,
        isLocked: lockCalendar,
      };

      // Include password fields if changing password
      if (removePassword) {
        requestBody.password = null;
      } else if (newPassword) {
        requestBody.password = newPassword;
      }

      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      if (response.status === 401) {
        setError(t("validation.passwordIncorrect"));
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(t("validation.passwordIncorrect"));
        setLoading(false);
        return;
      }

      // Handle localStorage based on what changed
      if (removePassword) {
        // Only remove from localStorage if password was actually removed
        removeCachedPassword(calendarId);
      } else if (newPassword) {
        // New password was set, update localStorage
        setCachedPassword(calendarId, newPassword);
      } else if (hasPassword && currentPassword) {
        // Only isLocked changed, keep the current password cached
        setCachedPassword(calendarId, currentPassword);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update password:", error);
      setError(t("validation.passwordIncorrect"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("password.manage", { name: calendarName })}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {hasPassword
                ? t("password.currentlyProtected")
                : t("password.notProtected")}
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {hasPassword && (
            <div className="space-y-2.5">
              <Label
                htmlFor="currentPassword"
                className="text-sm font-medium flex items-center gap-2"
              >
                <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                {t("password.currentPassword")}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("password.currentPasswordPlaceholder")}
                className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                autoFocus
              />
            </div>
          )}

          {hasPassword && (
            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
              <Checkbox
                id="removePassword"
                checked={removePassword}
                onCheckedChange={(checked) => {
                  const isChecked = !!checked;
                  setRemovePassword(isChecked);
                  // Automatically unlock if removing password
                  if (isChecked) {
                    setLockCalendar(false);
                  }
                }}
              />
              <Label
                htmlFor="removePassword"
                className="text-sm font-medium cursor-pointer"
              >
                {t("password.removePassword")}
              </Label>
            </div>
          )}

          {hasPassword && !removePassword && (
            <div className="flex items-center space-x-2 p-3 bg-muted/30 rounded-lg border border-border/30">
              <Checkbox
                id="lockCalendar"
                checked={lockCalendar}
                onCheckedChange={(checked) => setLockCalendar(!!checked)}
              />
              <div className="flex-1">
                <Label
                  htmlFor="lockCalendar"
                  className="text-sm font-medium cursor-pointer"
                >
                  {t("password.lockCalendar")}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("password.lockCalendarHint")}
                </p>
              </div>
            </div>
          )}

          {!removePassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="space-y-2.5">
                <Label
                  htmlFor="newPassword"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                  {hasPassword
                    ? t("password.newPassword")
                    : t("form.passwordLabel")}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("password.newPasswordPlaceholder")}
                  className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                  autoFocus={!hasPassword}
                />
              </div>

              <div className="space-y-2.5">
                <Label
                  htmlFor="confirmPassword"
                  className="text-sm font-medium flex items-center gap-2"
                >
                  <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
                  {t("password.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("password.confirmPasswordPlaceholder")}
                  className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
                />
              </div>
            </motion.div>
          )}

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

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
              disabled={loading}
              className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
            >
              {loading ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
