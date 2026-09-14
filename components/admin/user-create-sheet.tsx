"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { RoleSelect } from "@/components/admin/role-select";
import { PasswordFieldsGroup, usePasswordFields } from "@/components/admin/password-fields";
import { useAdminUserActions } from "@/hooks/useAdminUsers";
import { useIsSuperAdmin } from "@/hooks/useAdminAccess";

interface UserCreateSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserCreateSheet({ open, onOpenChange }: UserCreateSheetProps) {
  const t = useTranslations();
  const { createUser, isCreating } = useAdminUserActions();
  const isSuperAdmin = useIsSuperAdmin();
  const passwordFields = usePasswordFields();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("user");

  const isValid =
    name.trim().length > 0 && email.trim().length > 0 && passwordFields.isValid;
  const hasChanges = !!(name || email || passwordFields.password || passwordFields.confirmPassword);

  const reset = () => {
    setName("");
    setEmail("");
    setRole("user");
    passwordFields.reset();
  };

  const handleSave = async () => {
    if (!isValid) return;
    const success = await createUser({
      name,
      email,
      password: passwordFields.password,
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
          <RoleSelect id="admin-create-user-role" value={role} onValueChange={setRole} />
        </Field>
      )}

      <PasswordFieldsGroup
        idPrefix="admin-create-user"
        passwordLabel={t("common.labels.password")}
        passwordHint={t("admin.mustChangePasswordHint")}
        fields={passwordFields}
      />
    </AdminFormPanel>
  );
}
