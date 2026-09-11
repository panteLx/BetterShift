"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Field, inputClass } from "@/components/form-kit";
import { AdminFormPanel } from "@/components/admin/admin-form-panel";
import { useAdminUsers, type AdminUser } from "@/hooks/useAdminUsers";
import { useCanEditUser, useCanChangeUserRole } from "@/hooks/useAdminAccess";

interface UserEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AdminUser;
  onSuccess: () => void;
}

export function UserEditSheet({ open, onOpenChange, user, onSuccess }: UserEditSheetProps) {
  const t = useTranslations();
  const { updateUser, isLoading } = useAdminUsers();
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
    if (success) {
      onSuccess();
      onOpenChange(false);
    }
  };

  return (
    <AdminFormPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t("admin.editUser")}
      subtitle={user.name || user.email}
      onSave={handleSave}
      isSaving={isLoading}
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
          <Select value={role} onValueChange={setRole}>
            <SelectTrigger id="admin-user-role" className="h-10 w-full rounded-[9px] px-3 text-[14px] data-[size=default]:h-10">
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
    </AdminFormPanel>
  );
}
