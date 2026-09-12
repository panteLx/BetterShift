"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, EyeOff, RefreshCw, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PanelDialog } from "@/components/panel-dialog";
import { Field, inputClass } from "@/components/form-kit";
import { StatusBanner } from "@/components/status-banner";
import { cn } from "@/lib/utils";
import type { AdminUser } from "@/hooks/useAdminUsers";

interface UserPasswordResetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onConfirm: (newPassword: string) => Promise<void>;
}

const CHARSET = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";

function randomPassword(length = 16) {
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, (v) => CHARSET[v % CHARSET.length]).join("");
}

function PasswordInput({
  id,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder: string;
}) {
  const t = useTranslations();
  const Icon = visible ? EyeOff : Eye;
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="new-password"
        className={cn(inputClass, "pr-10", visible && value && "font-mono")}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? t("adminUsers.hidePassword") : t("adminUsers.showPassword")}
        className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-tertiary transition-colors hover:text-fg-strong"
      >
        <Icon className="size-4" />
      </button>
    </div>
  );
}

export function UserPasswordResetDialog({
  open,
  onOpenChange,
  user,
  onConfirm,
}: UserPasswordResetDialogProps) {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const isValid = password.length >= 8 && passwordsMatch;

  const generateRandomPassword = () => {
    const newPassword = randomPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(password);
    toast.success(t("common.copied", { item: t("common.labels.password") }));
  };

  const reset = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleConfirm = async () => {
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      await onConfirm(password);
      reset();
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    reset();
    onOpenChange(false);
  };

  return (
    <PanelDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.resetPassword")}
      description={t("admin.resetPasswordFor", { name: user.name || user.email })}
      width="sm"
      bodyClassName="flex flex-col gap-4"
      footer={
        <>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {t("common.cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid || isSubmitting}
            className="h-10 flex-1 font-semibold"
          >
            {isSubmitting ? t("common.saving") : t("admin.setPassword")}
          </Button>
        </>
      }
    >
      <StatusBanner tone="warning" icon={TriangleAlert} title={t("admin.passwordResetWarning")}>
        {t("admin.passwordResetSecurityNote")}
      </StatusBanner>

      <Button
        type="button"
        variant="outline"
        onClick={generateRandomPassword}
        className="h-10 w-full rounded-[9px] font-semibold"
      >
        <RefreshCw className="size-4 text-fg-secondary" />
        {t("admin.generatePassword")}
      </Button>

      <Field label={t("common.labels.newPassword")} htmlFor="reset-password">
        <PasswordInput
          id="reset-password"
          value={password}
          onChange={setPassword}
          visible={showPassword}
          onToggle={() => setShowPassword(!showPassword)}
          placeholder={t("admin.passwordPlaceholder")}
        />
        {password && password.length < 8 && (
          <p className="text-[12px] text-danger">{t("validation.passwordTooShort")}</p>
        )}
      </Field>

      <Field label={t("common.labels.confirmPassword")} htmlFor="reset-password-confirm">
        <PasswordInput
          id="reset-password-confirm"
          value={confirmPassword}
          onChange={setConfirmPassword}
          visible={showConfirmPassword}
          onToggle={() => setShowConfirmPassword(!showConfirmPassword)}
          placeholder={t("admin.confirmPasswordPlaceholder")}
        />
        {confirmPassword && !passwordsMatch && (
          <p className="text-[12px] text-danger">{t("validation.passwordsNoMatch")}</p>
        )}
      </Field>

      {isValid && (
        <Button
          type="button"
          variant="secondary"
          onClick={copyPassword}
          className="h-10 w-full rounded-[9px] font-semibold"
        >
          <Copy className="size-4" />
          {t("admin.copyPassword")}
        </Button>
      )}
    </PanelDialog>
  );
}
