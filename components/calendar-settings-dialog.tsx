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
import { PRESET_COLORS } from "@/lib/constants";
import { AlertTriangle, Trash2 } from "lucide-react";

interface CalendarSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calendarId: string;
  calendarName: string;
  calendarColor: string;
  hasPassword: boolean;
  isLocked: boolean;
  onSuccess: () => void;
  onDelete: (password?: string) => void;
}

export function CalendarSettingsDialog({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  calendarColor,
  hasPassword,
  isLocked,
  onSuccess,
  onDelete,
}: CalendarSettingsDialogProps) {
  const t = useTranslations();
  const [name, setName] = useState(calendarName);
  const [selectedColor, setSelectedColor] = useState(calendarColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [lockCalendar, setLockCalendar] = useState(isLocked);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (open) {
      setName(calendarName);
      setSelectedColor(calendarColor);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRemovePassword(false);
      setLockCalendar(isLocked);
      setError("");
      setShowDeleteConfirm(false);
    }
  }, [open, calendarName, calendarColor, isLocked]);

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
      setError(t("calendar.lockRequiresPassword"));
      return;
    }

    setLoading(true);

    try {
      const requestBody: {
        name?: string;
        color?: string;
        currentPassword?: string;
        isLocked: boolean;
        password?: string | null;
      } = {
        name: name !== calendarName ? name : undefined,
        color: selectedColor !== calendarColor ? selectedColor : undefined,
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
      console.error("Failed to update calendar:", error);
      setError(t("validation.passwordIncorrect"));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (hasPassword && !currentPassword) {
      setError(t("validation.passwordRequired"));
      return;
    }
    onDelete(hasPassword ? currentPassword : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-w-[95vw] max-h-[85vh] flex flex-col p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("calendar.settings", { name: calendarName })}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("calendar.settingsDescription")}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit}
          className="space-y-4 overflow-y-auto flex-1 px-6 pb-6"
        >
          {/* Calendar Name */}
          <div className="space-y-2.5 pt-6">
            <Label
              htmlFor="calendarName"
              className="text-sm font-medium flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("form.nameLabel")}
            </Label>
            <Input
              id="calendarName"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("form.namePlaceholder", {
                example: t("calendar.name"),
              })}
              className="h-11 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/50"
              required
            />
          </div>

          {/* Calendar Color */}
          <div className="space-y-2.5">
            <Label className="text-sm font-medium flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("form.colorLabel")}
            </Label>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((colorObj) => (
                <button
                  key={colorObj.value}
                  type="button"
                  onClick={() => setSelectedColor(colorObj.value)}
                  className={`h-11 rounded-lg transition-all ${
                    selectedColor === colorObj.value
                      ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                      : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: colorObj.value }}
                  title={colorObj.name}
                />
              ))}
            </div>
          </div>

          {/* Password Section Header */}
          <div className="pt-2 pb-1">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <div className="flex-1 h-px bg-border"></div>
              <span>{t("password.optional")}</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>
          </div>

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
              />
              <p className="text-xs text-muted-foreground">
                {t("calendar.currentlyProtected")}
              </p>
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
                  {t("calendar.lockCalendar")}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("calendar.lockCalendarHint")}
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

          {/* Delete Section */}
          <div className="pt-4 mt-4 border-t border-border/50">
            <div className="space-y-3">
              {!showDeleteConfirm ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="w-full h-11 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("calendar.deleteCalendar")}
                </Button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-3"
                >
                  <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
                    <div className="flex items-start gap-2.5 text-destructive mb-2">
                      <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold">
                          {t("common.deleteConfirm", {
                            item: t("calendar.title"),
                            name: calendarName,
                          })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {t("calendar.deleteWarning")}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowDeleteConfirm(false)}
                      className="flex-1 h-11"
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      onClick={handleDelete}
                      className="flex-1 h-11 shadow-lg shadow-destructive/25"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t("common.delete")}
                    </Button>
                  </div>
                </motion.div>
              )}
            </div>
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
