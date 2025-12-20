"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "motion/react";
import { BaseSheet } from "@/components/ui/base-sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PRESET_COLORS } from "@/lib/constants";

interface CalendarSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    name: string,
    color: string,
    password?: string,
    isLocked?: boolean
  ) => void;
}

export function CalendarSheet({
  open,
  onOpenChange,
  onSubmit,
}: CalendarSheetProps) {
  const t = useTranslations();
  const initialColor = PRESET_COLORS[0].value;
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(initialColor);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [lockCalendar, setLockCalendar] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const hasChanges = () => {
    return (
      name.trim() !== "" ||
      selectedColor !== initialColor ||
      (usePassword && password !== "") ||
      (usePassword && confirmPassword !== "")
    );
  };

  const resetForm = () => {
    setName("");
    setSelectedColor(initialColor);
    setPassword("");
    setConfirmPassword("");
    setUsePassword(false);
    setLockCalendar(false);
    setError("");
  };

  const handleSave = async () => {
    setError("");

    if (!name.trim() || isSaving) return;

    // Validate password if enabled
    if (usePassword) {
      if (!password) {
        setError(t("validation.passwordRequired"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("validation.passwordMatch"));
        return;
      }
    }

    // Can't lock without password
    if (lockCalendar && !usePassword) {
      setError(t("calendar.lockRequiresPassword"));
      return;
    }

    setIsSaving(true);
    try {
      await onSubmit(
        name.trim(),
        selectedColor,
        usePassword && password ? password : undefined,
        lockCalendar
      );

      // Reset form on success
      resetForm();
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BaseSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("calendar.create")}
      description={t("calendar.createDescription", {
        default: "Create a new calendar to organize your shifts",
      })}
      showSaveButton
      onSave={handleSave}
      isSaving={isSaving}
      saveDisabled={!name.trim()}
      hasUnsavedChanges={hasChanges()}
      maxWidth="md"
    >
      <div className="space-y-6">
        <div className="space-y-2.5">
          <Label
            htmlFor="name"
            className="text-sm font-medium flex items-center gap-2"
          >
            <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
            {t("calendar.name")}
          </Label>
          <Input
            id="name"
            placeholder={t("form.namePlaceholder", {
              example: t("calendar.name"),
            })}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50 backdrop-blur-sm transition-all"
            autoFocus
          />
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium flex items-center gap-2">
            <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
            {t("form.colorLabel")}
          </Label>
          <div className="grid grid-cols-4 gap-3 p-4 bg-muted/30 rounded-xl border border-border/30">
            {PRESET_COLORS.map((colorObj) => (
              <button
                key={colorObj.value}
                type="button"
                onClick={() => setSelectedColor(colorObj.value)}
                className={`
                    relative w-full aspect-square rounded-xl transition-all duration-200
                    hover:scale-110 active:scale-95
                    ${
                      selectedColor === colorObj.value
                        ? "ring-4 ring-primary/30 shadow-lg scale-105"
                        : "ring-2 ring-border/20 hover:ring-border/40"
                    }
                  `}
                style={{
                  backgroundColor: colorObj.value,
                  boxShadow:
                    selectedColor === colorObj.value
                      ? `0 8px 24px ${colorObj.value}40`
                      : `0 2px 8px ${colorObj.value}20`,
                }}
                aria-label={colorObj.name}
              >
                {selectedColor === colorObj.value && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute inset-0 flex items-center justify-center"
                  >
                    <div className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                      <div className="w-2 h-2 bg-primary rounded-full"></div>
                    </div>
                  </motion.div>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="usePassword"
              checked={usePassword}
              onCheckedChange={(checked: boolean) => setUsePassword(!!checked)}
            />
            <Label
              htmlFor="usePassword"
              className="text-sm font-medium cursor-pointer flex items-center gap-2"
            >
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("password.optional")}
            </Label>
          </div>
          {usePassword && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="space-y-3 pt-1"
            >
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">
                  {t("form.passwordLabel")}
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("form.passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-10 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/80"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm">
                  {t("password.confirmPassword")}
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder={t("password.confirmPasswordPlaceholder")}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-10 border-primary/30 focus:border-primary/50 focus:ring-primary/20 bg-background/80"
                />
              </div>
              <div className="flex items-center space-x-2 pt-1">
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
            </motion.div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-500 flex items-center gap-1.5 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
            {error}
          </p>
        )}
      </div>
    </BaseSheet>
  );
}
