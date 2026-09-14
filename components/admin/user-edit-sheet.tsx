"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Field, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { RoleSelect } from "@/components/admin/role-select";
import { useAdminUserActions, type AdminUser } from "@/hooks/useAdminUsers";
import { useCanEditUser, useCanChangeUserRole } from "@/hooks/useAdminAccess";

interface UserEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
}

export function UserEditSheet({ open, onOpenChange, user }: UserEditSheetProps) {
  const t = useTranslations();
  const { updateUser, isUpdating } = useAdminUserActions();
  const canEdit = useCanEditUser(user);
  const canChangeRole = useCanChangeUserRole(user);

  // Resets when the parent remounts this component via its key
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [role, setRole] = useState(user.role || "user");

  const hasChanges = name !== user.name || email !== user.email || role !== user.role;

  if (!canEdit) {
    return null;
  }

  const handleSave = async () => {
    const updates: { name?: string; email?: string; role?: string } = {};

    if (name !== user.name) updates.name = name;
    if (email !== user.email) updates.email = email;
    if (canChangeRole && role !== user.role) updates.role = role;

    const success = await updateUser(user.id, updates);
    if (success) onOpenChange(false);
  };

  return (
    <AdminFormPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.editUser")}
      subtitle={user.name || user.email}
      onSave={handleSave}
      isSaving={isUpdating}
      saveDisabled={!hasChanges}
      hasUnsavedChanges={hasChanges}
    >
      <Field label={t("common.labels.name")} htmlFor="admin-user-name">
        <Input
          id="admin-user-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("admin.namePlaceholder")}
          className={inputClass}
        />
      </Field>

      <Field label={t("common.labels.email")} htmlFor="admin-user-email">
        <Input
          id="admin-user-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("admin.emailPlaceholder")}
          className={inputClass}
        />
      </Field>

      {canChangeRole && (
        <Field label={t("admin.role")} htmlFor="admin-user-role" hint={t("admin.roleChangeWarning")}>
          <RoleSelect id="admin-user-role" value={role} onValueChange={setRole} />
        </Field>
      )}
    </AdminFormPanel>
  );
}
