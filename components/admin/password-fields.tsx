"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, inputClass } from "@/components/form-kit";
import { randomPassword, MIN_PASSWORD_LENGTH } from "@/lib/password-utils";
import { cn } from "@/lib/utils";

export function PasswordInput({
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

/** Password + confirm-password state shared by the create and reset-password forms. */
export function usePasswordFields() {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const isValid = password.length >= MIN_PASSWORD_LENGTH && passwordsMatch;

  const generate = () => {
    const newPassword = randomPassword();
    setPassword(newPassword);
    setConfirmPassword(newPassword);
    setShowPassword(true);
    setShowConfirmPassword(true);
  };

  const copy = () => {
    navigator.clipboard.writeText(password);
    toast.success(t("common.copied", { item: t("common.labels.password") }));
  };

  const reset = () => {
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  return {
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    showPassword,
    setShowPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    passwordsMatch,
    isValid,
    generate,
    copy,
    reset,
  };
}

/** Generate/reveal/confirm/copy UI for a password, shared by the create and reset-password forms. */
export function PasswordFieldsGroup({
  idPrefix,
  passwordLabel,
  passwordHint,
  fields,
}: {
  idPrefix: string;
  passwordLabel: string;
  passwordHint?: string;
  fields: ReturnType<typeof usePasswordFields>;
}) {
  const t = useTranslations();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={fields.generate}
        className="h-10 w-full rounded-[9px] font-semibold"
      >
        <RefreshCw className="size-4 text-fg-secondary" />
        {t("admin.generatePassword")}
      </Button>

      <Field label={passwordLabel} htmlFor={`${idPrefix}-password`} hint={passwordHint}>
        <PasswordInput
          id={`${idPrefix}-password`}
          value={fields.password}
          onChange={fields.setPassword}
          visible={fields.showPassword}
          onToggle={() => fields.setShowPassword(!fields.showPassword)}
          placeholder={t("admin.passwordPlaceholder")}
        />
        {fields.password && fields.password.length < MIN_PASSWORD_LENGTH && (
          <p className="text-[12px] text-danger">{t("validation.passwordTooShort")}</p>
        )}
      </Field>

      <Field label={t("common.labels.confirmPassword")} htmlFor={`${idPrefix}-password-confirm`}>
        <PasswordInput
          id={`${idPrefix}-password-confirm`}
          value={fields.confirmPassword}
          onChange={fields.setConfirmPassword}
          visible={fields.showConfirmPassword}
          onToggle={() => fields.setShowConfirmPassword(!fields.showConfirmPassword)}
          placeholder={t("admin.confirmPasswordPlaceholder")}
        />
        {fields.confirmPassword && !fields.passwordsMatch && (
          <p className="text-[12px] text-danger">{t("validation.passwordsNoMatch")}</p>
        )}
      </Field>

      {fields.isValid && (
        <Button
          type="button"
          variant="secondary"
          onClick={fields.copy}
          className="h-10 w-full rounded-[9px] font-semibold"
        >
          <Copy className="size-4" />
          {t("admin.copyPassword")}
        </Button>
      )}
    </>
  );
}
