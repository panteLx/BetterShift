"use client";

import { useState } from "react";
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
import { PRESET_COLORS } from "@/lib/constants";

interface CalendarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    name: string,
    color: string,
    password?: string,
    isLocked?: boolean
  ) => void;
}

export function CalendarDialog({
  open,
  onOpenChange,
  onSubmit,
}: CalendarDialogProps) {
  const t = useTranslations();
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0].value);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [lockCalendar, setLockCalendar] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) return;

    // Validate password if enabled
    if (usePassword) {
      if (!password) {
        setError(t("password.errorRequired"));
        return;
      }
      if (password !== confirmPassword) {
        setError(t("password.errorMatch"));
        return;
      }
    }

    // Can't lock without password
    if (lockCalendar && !usePassword) {
      setError(t("password.lockRequiresPassword"));
      return;
    }

    onSubmit(
      name.trim(),
      selectedColor,
      usePassword && password ? password : undefined,
      lockCalendar
    );
    setName("");
    setSelectedColor(PRESET_COLORS[0].value);
    setPassword("");
    setConfirmPassword("");
    setUsePassword(false);
    setLockCalendar(false);
    setError("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-0 gap-0 border border-border/50 bg-gradient-to-b from-background via-background to-muted/30 backdrop-blur-xl shadow-2xl">
        <DialogHeader className="border-b border-border/50 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6 pb-5 space-y-1.5">
          <DialogTitle className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            {t("calendar.create")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {t("calendar.createDescription", {
              default: "Create a new calendar to organize your shifts",
            })}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
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
              placeholder={t("calendar.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 border-border/50 focus:border-primary/50 focus:ring-primary/20 bg-background/50 backdrop-blur-sm transition-all"
              autoFocus
            />
          </div>
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <div className="w-1 h-4 bg-gradient-to-b from-primary to-primary/50 rounded-full"></div>
              {t("calendar.color")}
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
                onCheckedChange={(checked) => setUsePassword(!!checked)}
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
                    {t("password.password")}
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder={t("password.passwordPlaceholder")}
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
              </motion.div>
            )}
          </div>
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
              disabled={!name.trim()}
              className="flex-1 h-11 bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg shadow-primary/25 disabled:opacity-50 disabled:shadow-none"
            >
              {t("common.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
