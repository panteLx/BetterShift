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
import { Checkbox } from "@/components/ui/checkbox";

interface ManagePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  hasPassword: boolean;
  onSuccess: () => void;
}

export function ManagePasswordDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  hasPassword,
  onSuccess,
}: ManagePasswordDialogProps) {
  const t = useTranslations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRemovePassword(false);
      setError("");
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate inputs
    if (hasPassword && !currentPassword) {
      setError(t("password.errorRequired"));
      return;
    }

    if (!removePassword) {
      if (!newPassword) {
        setError(t("password.errorRequired"));
        return;
      }
      if (newPassword !== confirmPassword) {
        setError(t("password.errorMatch"));
        return;
      }
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/calendars/${calendarId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: hasPassword ? currentPassword : undefined,
          password: removePassword ? null : newPassword,
        }),
      });

      if (response.status === 401) {
        setError(t("password.errorIncorrect"));
        setLoading(false);
        return;
      }

      if (!response.ok) {
        setError(t("password.errorIncorrect"));
        setLoading(false);
        return;
      }

      // Clear cached password from localStorage
      localStorage.removeItem(`calendar_password_${calendarId}`);

      // If new password was set, cache it
      if (!removePassword && newPassword) {
        localStorage.setItem(`calendar_password_${calendarId}`, newPassword);
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to update password:", error);
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
            {t("password.manage", { name: calendarName })}
          </DialogTitle>
          <DialogDescription>
            {hasPassword
              ? t("password.currentlyProtected")
              : t("password.notProtected")}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {hasPassword && (
            <div className="space-y-2">
              <Label htmlFor="currentPassword">
                {t("password.currentPassword")}
              </Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder={t("password.currentPasswordPlaceholder")}
                autoFocus
              />
            </div>
          )}

          {hasPassword && (
            <div className="flex items-center space-x-2">
              <Checkbox
                id="removePassword"
                checked={removePassword}
                onCheckedChange={(checked) => setRemovePassword(!!checked)}
              />
              <Label
                htmlFor="removePassword"
                className="text-sm font-normal cursor-pointer"
              >
                {t("password.removePassword")}
              </Label>
            </div>
          )}

          {!removePassword && (
            <>
              <div className="space-y-2">
                <Label htmlFor="newPassword">
                  {hasPassword
                    ? t("password.newPassword")
                    : t("password.password")}
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={t("password.newPasswordPlaceholder")}
                  autoFocus={!hasPassword}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">
                  {t("password.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder={t("password.confirmPasswordPlaceholder")}
                />
              </div>
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("common.loading") : t("common.save")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
