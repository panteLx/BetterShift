"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  removeCachedPassword,
  setCachedPassword,
  getCachedPassword,
} from "@/lib/password-cache";
import { PRESET_COLORS } from "@/lib/constants";
import { AlertTriangle, Trash2, Download } from "lucide-react";
import { ExportDialog } from "@/components/export-dialog";
import { ConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { useDirtyState } from "@/hooks/useDirtyState";

interface CalendarSettingsSheetProps {
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

interface FormState {
  name: string;
  selectedColor: string;
  lockCalendar: boolean;
  removePassword: boolean;
}

export function CalendarSettingsSheet({
  open,
  onOpenChange,
  calendarId,
  calendarName,
  calendarColor,
  hasPassword,
  isLocked,
  onSuccess,
  onDelete,
}: CalendarSettingsSheetProps) {
  const t = useTranslations();
  const [name, setName] = useState(calendarName);
  const [selectedColor, setSelectedColor] = useState(calendarColor);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [removePassword, setRemovePassword] = useState(false);
  const [lockCalendar, setLockCalendar] = useState(isLocked);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [canExport, setCanExport] = useState(false);
  const [passwordError, setPasswordError] = useState(false);
  const initialFormStateRef = useRef<FormState | null>(null);
  const currentPasswordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setName(calendarName);
      setSelectedColor(calendarColor);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setRemovePassword(false);
      setLockCalendar(isLocked);
      setPasswordError(false);
      setShowDeleteConfirm(false);
      setShowExportDialog(false);

      // Store initial form state for change detection
      initialFormStateRef.current = {
        name: calendarName,
        selectedColor: calendarColor,
        lockCalendar: isLocked,
        removePassword: false,
      };

      // Check if export is allowed (no password or password is cached)
      if (!hasPassword || !isLocked) {
        setCanExport(true);
      } else {
        const cachedPassword = getCachedPassword(calendarId);
        setCanExport(!!cachedPassword);
      }
    } else {
      initialFormStateRef.current = null;
    }
  }, [open, calendarName, calendarColor, isLocked, hasPassword, calendarId]);

  const hasChanges = () => {
    if (!initialFormStateRef.current) return false;

    const current: FormState = {
      name,
      selectedColor,
      lockCalendar,
      removePassword,
    };

    // Check basic fields
    const basicChanges =
      JSON.stringify(current) !== JSON.stringify(initialFormStateRef.current);

    // Check password fields
    const passwordChanges =
      newPassword.trim() !== "" || confirmPassword.trim() !== "";

    return basicChanges || passwordChanges;
  };

  const {
    isDirty,
    handleClose,
    showConfirmDialog,
    setShowConfirmDialog,
    handleConfirmClose,
  } = useDirtyState({
    open,
    onClose: onOpenChange,
    hasChanges,
  });

  const handleSubmit = async () => {
    // Always require current password when calendar has password
    if (hasPassword && !currentPassword) {
      setPasswordError(true);
      toast.error(t("validation.passwordRequired"));
      currentPasswordRef.current?.focus();
      return;
    }

    // Validate new password fields if changing password
    const isChangingPassword = !removePassword && newPassword;
    if (isChangingPassword) {
      if (newPassword !== confirmPassword) {
        toast.error(t("validation.passwordMatch"));
        return;
      }
    }

    // If trying to lock without password
    if (lockCalendar && removePassword) {
      toast.error(t("calendar.lockRequiresPassword"));
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
        toast.error(t("validation.passwordIncorrect"));
        setPasswordError(true);
        currentPasswordRef.current?.focus();
        setLoading(false);
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        toast.error(
          errorData.error ||
            t("common.updateError", { item: t("calendar.title") })
        );
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
      toast.error(
        error instanceof Error
          ? error.message
          : t("common.updateError", { item: t("calendar.title") })
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    if (hasPassword && !currentPassword) {
      toast.error(t("validation.passwordRequired"));
      return;
    }
    onDelete(hasPassword ? currentPassword : undefined);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleClose}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-[600px] p-0 flex flex-col gap-0 border-l border-border/50 overflow-hidden"
        >
          <SheetHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-6 pt-6 pb-5 space-y-1.5">
            <SheetTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              {t("calendar.settings", { name: calendarName })}
            </SheetTitle>
            <SheetDescription className="text-sm text-muted-foreground">
              {t("calendar.settingsDescription")}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
            {/* Password Required Notice */}
            {hasPassword && (
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-primary">
                  <AlertTriangle className="h-5 w-5" />
                  <span className="font-semibold text-sm">
                    {t("calendar.passwordProtected")}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t("calendar.passwordRequiredToEdit")}
                </p>
              </div>
            )}

            {/* Calendar Name */}
            <div className="space-y-2.5">
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

            {/* Password Section */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <div className="flex-1 h-px bg-border"></div>
                <span>{t("password.management")}</span>
                <div className="flex-1 h-px bg-border"></div>
              </div>

              {hasPassword && (
                <div className="space-y-4 p-4 bg-muted/30 rounded-xl border border-border/30">
                  <div className="space-y-2.5">
                    <Label
                      htmlFor="currentPassword"
                      className="text-sm font-medium flex items-center gap-2"
                    >
                      <div className="w-1 h-4 bg-gradient-to-b from-amber-500 to-amber-600 rounded-full"></div>
                      {t("password.currentPassword")}
                      <span className="text-xs text-destructive">*</span>
                    </Label>
                    <Input
                      ref={currentPasswordRef}
                      id="currentPassword"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => {
                        setCurrentPassword(e.target.value);
                        setPasswordError(false);
                      }}
                      placeholder={t("password.currentPasswordPlaceholder")}
                      className={`h-11 bg-background ${
                        passwordError
                          ? "border-destructive focus:border-destructive focus:ring-destructive/20"
                          : "border-amber-500/30 focus:border-amber-500/50 focus:ring-amber-500/20"
                      }`}
                    />
                    {passwordError ? (
                      <p className="text-xs text-destructive">
                        {t("validation.passwordRequired")}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {t("calendar.currentPasswordRequired")}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 pt-2">
                    <Checkbox
                      id="removePassword"
                      checked={removePassword}
                      onCheckedChange={(checked: boolean) => {
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

                  {!removePassword && (
                    <div className="flex items-center space-x-2 pt-2">
                      <Checkbox
                        id="lockCalendar"
                        checked={lockCalendar}
                        onCheckedChange={(checked: boolean) =>
                          setLockCalendar(!!checked)
                        }
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
            </div>

            {/* Export Section */}
            {canExport && (
              <div className="pt-4 mt-4 border-t border-border/50">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowExportDialog(true)}
                  className="w-full h-11 border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {t("export.exportCalendar")}
                </Button>
              </div>
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
          </div>

          <SheetFooter className="border-t border-border/50 bg-muted/20 px-6 py-4 mt-auto">
            <div className="flex gap-2.5 w-full">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
                className="flex-1 h-11 border-border/50 hover:bg-muted/50"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !isDirty}
                className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
              >
                {loading ? t("common.saving") : t("common.save")}
              </Button>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <ExportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        calendarId={calendarId}
        calendarName={calendarName}
      />

      <ConfirmationDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        onConfirm={handleConfirmClose}
      />
    </>
  );
}
