"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { useAdminUserActions } from "@/hooks/useAdminUsers";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";
import { randomPassword } from "@/lib/password-utils";
import { cn } from "@/lib/utils";

interface UserCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export function UserCreateSheet({ open, onOpenChange }: UserCreateSheetProps) {
  const t = useTranslations();
  const { createUser, isCreating } = useAdminUserActions();
  const isSuperAdmin = useIsSuperAdmin();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("user");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const isValid =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    password.length >= 8 &&
    passwordsMatch;
  const hasChanges = !!(name || email || password || confirmPassword);

  const reset = () => {
    setName("");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setRole("user");
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

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

  const handleSave = async () => {
    if (!isValid) return;
    const success = await createUser({
      name,
      email,
      password,
      role: isSuperAdmin ? role : undefined,
    });
    if (success) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <AdminFormPanel
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t("admin.createUser")}
      subtitle={t("admin.createUserSubtitle")}
      onSave={handleSave}
      isSaving={isCreating}
      saveDisabled={!isValid}
      saveLabel={t("common.create")}
      hasUnsavedChanges={hasChanges}
    >
      <Field label={t("common.labels.name")} htmlFor="admin-create-user-name">
        <Input
          id="admin-create-user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.namePlaceholder")}
          className={inputClass}
        />
      </Field>

      <Field label={t("common.labels.email")} htmlFor="admin-create-user-email">
        <Input
          id="admin-create-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.emailPlaceholder")}
          className={inputClass}
        />
      </Field>

      {isSuperAdmin && (
        <Field label={t("admin.role")} htmlFor="admin-create-user-role">
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="admin-create-user-role" className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="user">{t("common.roles.user")}</SelectItem>
              <SelectItem value="admin">{t("common.roles.admin")}</SelectItem>
              <SelectItem value="superadmin">{t("common.roles.superadmin")}</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={generateRandomPassword}
        className="h-10 w-full rounded-[9px] font-semibold"
      >
        <RefreshCw className="size-4 text-fg-secondary" />
        {t("admin.generatePassword")}
      </Button>

      <Field label={t("common.labels.password")} htmlFor="admin-create-user-password" hint={t("admin.mustChangePasswordHint")}>
        <PasswordInput
          id="admin-create-user-password"
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

      <Field label={t("common.labels.confirmPassword")} htmlFor="admin-create-user-password-confirm">
        <PasswordInput
          id="admin-create-user-password-confirm"
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
    </AdminFormPanel>
  );
}
